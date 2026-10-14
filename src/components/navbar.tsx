"use client"

import { useState } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { LANGUAGE_CONFIGS } from "@/lib/types"
import { Languages, LogOut, UserCircle, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthModal } from "@/components/auth-modal"

export function Navbar() {
  const { language, setLanguage } = useLanguage()
  const { user, logout } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full border-b backdrop-blur-md bg-white/80"
        style={{ borderBottomColor: "var(--accent-border)" }}
      >
        <div className="w-full max-w-6xl mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-1 font-bold text-lg">
            <span style={{ color: "var(--accent)" }}>
              Lingua
            </span>
            <span className="text-neutral-900">Mind</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center gap-1">
              <Languages className="h-4 w-4 text-[var(--text-muted)] hidden sm:block" />
              <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100">
                {(Object.keys(LANGUAGE_CONFIGS) as Array<keyof typeof LANGUAGE_CONFIGS>).map((key) => {
                  const lang = LANGUAGE_CONFIGS[key]
                  const isActive = language === lang.code
                  return (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5",
                        isActive ? "text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                      )}
                      style={
                        isActive
                          ? { backgroundColor: lang.primaryColor }
                          : undefined
                      }
                    >
                      <span>{lang.flag}</span>
                      <span className="hidden sm:inline">{lang.nativeName}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 用户认证区域 */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <span className="text-lg">{user.avatarEmoji}</span>
                  <span className="text-sm font-medium hidden sm:inline">
                    {user.displayName || user.username}
                  </span>
                  <UserCircle className="h-4 w-4 text-neutral-400" />
                </button>

                {/* 下拉菜单 */}
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white rounded-xl shadow-lg border border-neutral-100 py-1">
                      <div className="px-3 py-2 border-b border-neutral-100">
                        <p className="text-sm font-medium truncate">{user.username}</p>
                        {user.email && (
                          <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                        )}
                      </div>
                      {user.role === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setShowMenu(false)}
                          className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition-colors"
                        >
                          <Shield className="h-4 w-4" />
                          管理后台
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          logout();
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 认证弹窗 */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}
