import { NextResponse } from "next/server";
import { getUserFromCookie, hasAuthToken } from "@/lib/auth";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const user = getUserFromCookie(cookieHeader);

  if (!user) {
    // 区分两种状态（修复：此前统一返回 200，前端难以感知令牌失效）：
    // - 未携带 auth-token → 访客，正常状态，返回 200
    // - 携带了令牌但校验失败/过期 → 登录态失效，返回 401
    // 两种响应体都带 { user: null }，兼容旧前端逻辑
    const status = hasAuthToken(cookieHeader) ? 401 : 200;
    return NextResponse.json({ user: null }, { status });
  }

  return NextResponse.json({ user });
}
