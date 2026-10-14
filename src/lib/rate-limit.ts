/**
 * 内存速率限制器 — LinguaMind
 *
 * 基于 IP 的滑动窗口计数器，防止恶意刷 LLM API。
 * 适用于单实例部署（多实例需改用 Redis）。
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

// IP -> 路由 -> 计数桶
const buckets = new Map<string, Map<string, RateBucket>>();

// 定期清理过期桶（每 5 分钟）
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_BUCKET_AGE = 60 * 60 * 1000; // 1 小时

setInterval(() => {
  const now = Date.now();
  for (const [ip, routes] of buckets) {
    for (const [route, bucket] of routes) {
      if (now > bucket.resetAt + MAX_BUCKET_AGE) {
        routes.delete(route);
      }
    }
    if (routes.size === 0) {
      buckets.delete(ip);
    }
  }
}, CLEANUP_INTERVAL);

export interface RateLimitOptions {
  /** 时间窗口（毫秒），默认 60 秒 */
  windowMs?: number;
  /** 窗口内最大请求数，默认 20 */
  max?: number;
}

export interface RateLimitResult {
  success: boolean;
  /** 剩余可用次数 */
  remaining: number;
  /** 重置时间戳（毫秒） */
  resetAt: number;
  /** 错误消息 */
  message?: string;
}

/**
 * 检查速率限制。
 *
 * @param ip 客户端 IP
 * @param route 路由标识（如 "chat"）
 * @param options 限制配置
 * @returns 是否允许请求
 */
export function checkRateLimit(
  ip: string,
  route: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 20;
  const now = Date.now();

  let routes = buckets.get(ip);
  if (!routes) {
    routes = new Map();
    buckets.set(ip, routes);
  }

  let bucket = routes.get(route);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    routes.set(route, bucket);
  }

  bucket.count++;

  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      message: `请求过于频繁，请 ${retryAfter} 秒后再试`,
    };
  }

  return {
    success: true,
    remaining: max - bucket.count,
    resetAt: bucket.resetAt,
  };
}

// IPv4 / IPv6 简化校验（仅用于限流键清洗，非严格校验）
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

function isValidIp(value: string): boolean {
  return (IPV4_REGEX.test(value) || IPV6_REGEX.test(value)) && value.length <= 45;
}

/**
 * 从 Next.js 请求中提取客户端 IP。
 *
 * 安全策略（修复：此前直接信任 x-forwarded-for，可被客户端任意伪造绕过限流）：
 * - 仅当环境变量 TRUST_PROXY=true（即部署在可信反向代理之后，如 Nginx / cpolar）时，
 *   才解析代理头；否则一律忽略，所有直连请求共享 "direct" 限流桶。
 * - 信任代理时取 x-real-ip（单值）或 x-forwarded-for 从右往左第一个 IP：
 *   可信代理会把真实客户端 IP 追加到 XFF 最右侧，攻击者伪造的左侧值不会生效。
 * - 解析结果做 IP 格式校验，非法值回退 "direct"，防止注入任意限流键。
 */
export function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY !== "true") {
    return "direct";
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // 从右往左取第一个（最右侧为可信代理追加的真实客户端 IP）
    const parts = forwarded.split(",").map(s => s.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isValidIp(parts[i])) return parts[i];
    }
  }
  return "direct";
}

/**
 * 应用于 LLM 密集型 API 的默认限制。
 * 每分钟最多 20 次请求。
 */
export const LLM_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: 20,
};

/**
 * 应用于认证 API 的默认限制。
 * 每分钟最多 5 次登录/注册尝试（防暴力破解）。
 */
export const AUTH_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: 5,
};

/**
 * 登录接口的「用户名维度」限流。
 * 与 IP 维度叠加：即使攻击者伪造 IP 绕过 IP 限流，
 * 对同一用户名的暴力破解仍会被此限制拦截。
 */
export const AUTH_USERNAME_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: 5,
};

/**
 * 注册接口的全局维度限流。
 * 防止伪造大量不同 IP 绕过 IP 限流后批量灌库（每个新用户名都是不同的键，
 * 用户名维度对注册无效，只能靠全局速率兜底）。
 */
export const REGISTER_GLOBAL_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: 50,
};

/**
 * 应用于语音转文字 API 的默认限制。
 * 每分钟最多 10 次。
 */
export const WHISPER_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  max: 10,
};
