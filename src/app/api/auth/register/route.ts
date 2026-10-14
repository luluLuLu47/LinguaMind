import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  AUTH_RATE_LIMIT,
  REGISTER_GLOBAL_RATE_LIMIT,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 速率限制（双层）：
  // 1) IP 维度：每分钟最多 5 次注册尝试（防单机批量注册）
  // 2) 全局维度：每分钟最多 50 次（防伪造大量不同 IP 绕过 IP 限流后灌库）
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, "auth-register", AUTH_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { error: rl.message },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }
  const rlGlobal = checkRateLimit("global", "auth-register-global", REGISTER_GLOBAL_RATE_LIMIT);
  if (!rlGlobal.success) {
    return NextResponse.json(
      { error: rlGlobal.message },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rlGlobal.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const { username, password, email } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const { user, token } = await registerUser(username, password, email);

    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
