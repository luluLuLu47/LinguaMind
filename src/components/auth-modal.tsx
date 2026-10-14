"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { X, User, Mail, Lock, Loader2 } from "lucide-react";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, email || undefined);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 bg-white rounded-3xl shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {mode === "login" ? "Login" : "Create Account"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 切换标签 */}
        <div className="flex gap-1 p-1 rounded-xl bg-neutral-100">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "login" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "register" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 用户名 */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={20}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 outline-none text-sm transition-all"
            />
          </div>

          {/* 邮箱（仅注册） */}
          {mode === "register" && (
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 outline-none text-sm transition-all"
              />
            </div>
          )}

          {/* 密码 */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="password"
              placeholder={mode === "register" ? "密码至少8位，含字母和数字" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 outline-none text-sm transition-all"
            />
          </div>

          {/* 注册时显示密码要求提示 */}
          {mode === "register" && (
            <p className="text-[10px] text-neutral-400 px-1">
              密码至少 8 位，必须包含字母和数字
            </p>
          )}

          {/* 错误提示 */}
          {error && (
            <p className="text-xs text-red-500 px-1">{error}</p>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--accent, #6366f1)" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              "Login"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* 切换提示 */}
        <p className="text-center text-xs text-neutral-400">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="font-medium text-neutral-700 hover:underline"
            style={{ color: "var(--accent, #6366f1)" }}
          >
            {mode === "login" ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
