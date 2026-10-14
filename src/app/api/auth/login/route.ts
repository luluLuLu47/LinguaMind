import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  AUTH_RATE_LIMIT,
  AUTH_USERNAME_RATE_LIMIT,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 速率限制（双层）：
  // 1) IP 维度：每分钟最多 5 次登录尝试（防暴力破解）
  // 2) 用户名维度：每分钟同一用户名最多 5 次（即使攻击者伪造 IP，也拦得住对单个账号的爆破）
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "auth-login", AUTH_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: rl.message },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // 用户名维度限流（仅针对指定用户名的尝试计数）
    const rlUser = checkRateLimit(
      `u:${String(username)}`,
      "auth-login-user",
      AUTH_USERNAME_RATE_LIMIT
    );
    if (!rlUser.success) {
      return NextResponse.json(
        { error: rlUser.message },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rlUser.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { user, token } = await loginUser(username, password);

    const res = NextResponse.json({ user });
    res.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    const status =
      message.includes("not found") || message.includes("Invalid") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
