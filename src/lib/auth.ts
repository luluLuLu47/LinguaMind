/**
 * 认证库 — 注册/登录/JWT 生成与验证
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db";

// 安全：JWT 密钥必须由环境变量提供，未配置时拒绝启动（而非回退到硬编码）
const _jwtSecret = process.env.JWT_SECRET;
if (!_jwtSecret || _jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET 环境变量未设置或长度不足 32 位。请在 .env.local 中配置强随机密钥。"
  );
}
const JWT_SECRET: string = _jwtSecret;
const JWT_EXPIRES_IN = "7d";
const BCRYPT_ROUNDS = 10;

// 输入校验正则
const USERNAME_REGEX = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  display_name: string | null;
  avatar_emoji: string;
  target_level: string;
  daily_goal: number;
  role: "user" | "admin";
  created_at: string;
  last_login: string | null;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarEmoji: string;
  targetLevel: string;
  dailyGoal: number;
  role: "user" | "admin";
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: "user" | "admin";
}

function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    targetLevel: row.target_level,
    dailyGoal: row.daily_goal,
    role: row.role,
  };
}

/** 注册新用户 */
export async function registerUser(
  username: string,
  password: string,
  email?: string
): Promise<{ user: SafeUser; token: string }> {
  const db = getDb();

  // 校验用户名：2-20位，仅允许字母数字下划线和中文
  if (!username || !USERNAME_REGEX.test(username)) {
    throw new Error("用户名需 2-20 位，仅支持字母、数字、下划线、中文");
  }

  // 校验密码：至少 8 位，必须包含字母和数字
  if (!password || password.length < 8) {
    throw new Error("密码至少 8 位");
  }
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
    throw new Error("密码必须包含字母和数字");
  }

  // 校验邮箱格式（如提供）
  if (email && !EMAIL_REGEX.test(email)) {
    throw new Error("邮箱格式不正确");
  }

  // 检查用户名是否已存在
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username) as { id: string } | undefined;

  if (existing) {
    throw new Error("Username already exists");
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, display_name)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, username, email || null, passwordHash, username);

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
  const user = toSafeUser(row);
  const token = signToken({ userId: id, username, role: user.role });

  // 更新最后登录时间
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(id);

  // 迁移匿名用户的数据到新注册用户
  migrateAnonymousData(id);

  return { user, token };
}

/**
 * 将匿名用户（anonymous）的数据迁移到新注册用户。
 * 用户先匿名使用后注册，之前的学习记录会自动关联到新账号。
 *
 * 修复：整体包裹在单个事务中，保证原子性。此前多条 UPDATE 依赖
 * better-sqlite3 同步执行的隐式原子性——一旦后续有人在 INSERT 与
 * 迁移之间插入 await（如发送欢迎邮件），并发注册就可能把同一批
 * 匿名数据撕裂迁移给两个账号。事务化后该保证是显式的、可依赖的。
 */
const migrateAnonymousData = (() => {
  // 惰性编译事务（getDb 需在首次调用时初始化完成）
  let _tx: ((userId: string) => void) | null = null;
  return function runMigrate(userId: string) {
    const db = getDb();
    if (!_tx) {
      const ANON = "anonymous";
      _tx = db.transaction((uid: string) => {
        // 迁移对话会话
        db.prepare(`UPDATE dialogue_sessions SET user_id = ? WHERE user_id = ?`).run(uid, ANON);
        // 迁移对话消息（通过 session 关联）
        db.prepare(
          `UPDATE dialogue_messages SET user_id = ?
           WHERE user_id = ? OR session_id IN (SELECT id FROM dialogue_sessions WHERE user_id = ?)`
        ).run(uid, ANON, uid);
        // 迁移每日打卡
        db.prepare(`UPDATE daily_checkins SET user_id = ? WHERE user_id = ?`).run(uid, ANON);
        // 迁移学习统计
        db.prepare(`UPDATE learning_stats SET user_id = ? WHERE user_id = ?`).run(uid, ANON);
        // 迁移生词本
        db.prepare(`UPDATE vocabulary SET user_id = ? WHERE user_id = ?`).run(uid, ANON);
        // 迁移游戏记录
        db.prepare(`UPDATE game_history SET user_id = ? WHERE user_id = ?`).run(uid, ANON);
      });
    }
    _tx(userId);
  };
})();

/** 登录 */
export async function loginUser(
  username: string,
  password: string
): Promise<{ user: SafeUser; token: string }> {
  const db = getDb();

  const row = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;

  if (!row) {
    throw new Error("User not found");
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw new Error("Invalid password");
  }

  const user = toSafeUser(row);
  const token = signToken({ userId: row.id, username: row.username, role: user.role });

  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(row.id);

  return { user, token };
}

/** 获取用户信息（通过 ID） */
export function getUserById(userId: string): SafeUser | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;

  if (!row) return null;
  return toSafeUser(row);
}

/** 生成 JWT */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** 验证 JWT */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/** 从请求 Cookie 中获取当前用户 */
export function getUserFromCookie(cookieHeader: string | null): SafeUser | null {
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );

  const token = cookies["auth-token"];
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return getUserById(payload.userId);
}

/**
 * 判断请求是否携带了 auth-token cookie（不论是否有效）。
 * 用于 /api/auth/me 区分两种状态：
 *   - 未携带令牌 → 正常未登录（200）
 *   - 携带令牌但校验失败 → 登录态失效（401）
 */
export function hasAuthToken(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some((c) => c.trim().startsWith("auth-token=") && c.trim().length > "auth-token=".length);
}

/** 匿名用户标识（未登录时数据归属） */
export const ANONYMOUS_USER_ID = "anonymous";

/**
 * 从请求中获取用户 ID（用于数据隔离）。
 * 未登录返回 'anonymous'，登录返回真实 user.id。
 */
export function getUserIdFromRequest(req: Request): string {
  const cookieHeader = req.headers.get("cookie");
  const user = getUserFromCookie(cookieHeader);
  return user?.id ?? ANONYMOUS_USER_ID;
}

/** 从请求中获取已登录用户（强制要求登录时使用） */
export function requireUserFromRequest(req: Request): SafeUser {
  const cookieHeader = req.headers.get("cookie");
  const user = getUserFromCookie(cookieHeader);
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

/** 从请求中获取管理员用户（强制要求管理员权限） */
export function requireAdminFromRequest(req: Request): SafeUser {
  const user = requireUserFromRequest(req);
  if (user.role !== "admin") {
    throw new Error("Admin permission required");
  }
  return user;
}

/** 判断 JWT payload 中的 role 是否为管理员 */
export function isAdminPayload(payload: JwtPayload | null): boolean {
  return payload?.role === "admin";
}
