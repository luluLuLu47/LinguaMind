"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, Users, MessageSquare, BookOpen, Calendar, TrendingUp } from "lucide-react";

interface AdminStats {
  overview: {
    totalUsers: number;
    activeToday: number;
    totalSessions: number;
    totalCheckins: number;
    totalVocab: number;
  };
  charts: {
    dailyActive: { d: string; cnt: number }[];
    languagePreference: { language: string; cnt: number }[];
    targetLevelPreference: { target_level: string; cnt: number }[];
    scenePreference: { scene_id: string; cnt: number }[];
  };
  tables: {
    recentUsers: Array<{
      username: string;
      email: string | null;
      display_name: string | null;
      avatar_emoji: string;
      target_level: string;
      created_at: string;
      last_login: string | null;
    }>;
    userActivity: Array<{
      username: string;
      display_name: string | null;
      avatar_emoji: string;
      target_level: string;
      created_at: string;
      last_login: string | null;
      sessions: number;
      checkins: number;
      vocab: number;
    }>;
  };
}

const LEVEL_LABELS: Record<string, string> = {
  cet4: "CET-4",
  cet6: "CET-6",
  postgrad: "考研",
  basic: "基础",
  medium: "中等",
  advanced: "高级",
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/");
      return;
    }
    loadStats();
  }, [user, loading, router]);

  async function loadStats() {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load stats");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neutral-400">加载中...</div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-500">无权访问</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neutral-400">加载中...</div>
      </div>
    );
  }

  const { overview, charts, tables } = stats;
  const maxDailyActive = Math.max(1, ...charts.dailyActive.map((d) => d.cnt));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">管理后台</h1>
          <p className="text-sm text-neutral-500">平台使用情况与用户数据</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="注册用户"
          value={overview.totalUsers}
          color="#3b82f6"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="今日活跃"
          value={overview.activeToday}
          color="#10b981"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="对话总数"
          value={overview.totalSessions}
          color="#8b5cf6"
        />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="打卡总数"
          value={overview.totalCheckins}
          color="#f59e0b"
        />
        <StatCard
          icon={<BookOpen className="h-4 w-4" />}
          label="收藏单词"
          value={overview.totalVocab}
          color="#ec4899"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily Active Chart */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">
            最近 7 天活跃用户
          </h2>
          <div className="flex items-end justify-between h-32 gap-2">
            {charts.dailyActive.map((d) => (
              <div key={d.d} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${(d.cnt / maxDailyActive) * 100}%`,
                    backgroundColor: "var(--accent)",
                    minHeight: d.cnt > 0 ? "4px" : "0",
                  }}
                  title={`${d.d}: ${d.cnt} 人`}
                />
                <span className="text-[10px] text-neutral-400">{d.d.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Language Preference */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">语言偏好</h2>
          <div className="space-y-2">
            {charts.languagePreference.length === 0 ? (
              <p className="text-xs text-neutral-400">暂无数据</p>
            ) : (
              charts.languagePreference.map((l) => {
                const total = charts.languagePreference.reduce((s, x) => s + x.cnt, 0);
                const pct = total > 0 ? Math.round((l.cnt / total) * 100) : 0;
                return (
                  <div key={l.language}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{l.language === "en" ? "英语" : "韩语"}</span>
                      <span className="text-neutral-400">
                        {l.cnt} 人 · {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            l.language === "en" ? "#3b82f6" : "#f59e0b",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Target Level Preference */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">目标等级偏好</h2>
          <div className="space-y-2">
            {charts.targetLevelPreference.length === 0 ? (
              <p className="text-xs text-neutral-400">暂无数据</p>
            ) : (
              charts.targetLevelPreference.map((l) => {
                const total = charts.targetLevelPreference.reduce(
                  (s, x) => s + x.cnt,
                  0
                );
                const pct = total > 0 ? Math.round((l.cnt / total) * 100) : 0;
                return (
                  <div key={l.target_level}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>
                        {LEVEL_LABELS[l.target_level] || l.target_level}
                      </span>
                      <span className="text-neutral-400">
                        {l.cnt} 人 · {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Scene Preference */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">
            热门对话场景 Top 10
          </h2>
          <div className="space-y-1">
            {charts.scenePreference.length === 0 ? (
              <p className="text-xs text-neutral-400">暂无数据</p>
            ) : (
              charts.scenePreference.map((s, i) => (
                <div
                  key={s.scene_id}
                  className="flex items-center justify-between py-1 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px]"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      {i + 1}
                    </span>
                    {s.scene_id}
                  </span>
                  <span className="text-neutral-400">{s.cnt} 次</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User Activity Table */}
      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        <div className="p-5 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">
            用户学习情况（最近 30 天）
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">用户</th>
                <th className="text-left px-4 py-2 font-medium">等级</th>
                <th className="text-right px-4 py-2 font-medium">对话数</th>
                <th className="text-right px-4 py-2 font-medium">打卡数</th>
                <th className="text-right px-4 py-2 font-medium">单词数</th>
                <th className="text-right px-4 py-2 font-medium">最后登录</th>
              </tr>
            </thead>
            <tbody>
              {tables.userActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-neutral-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                tables.userActivity.map((u) => (
                  <tr
                    key={u.username}
                    className="border-t border-neutral-50 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>{u.avatar_emoji}</span>
                        <span className="font-medium">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {LEVEL_LABELS[u.target_level] || u.target_level}
                    </td>
                    <td className="text-right px-4 py-2">{u.sessions}</td>
                    <td className="text-right px-4 py-2">{u.checkins}</td>
                    <td className="text-right px-4 py-2">{u.vocab}</td>
                    <td className="text-right px-4 py-2 text-neutral-400">
                      {u.last_login ? formatDateTime(u.last_login) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Users Table */}
      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        <div className="p-5 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">最近注册用户</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">用户</th>
                <th className="text-left px-4 py-2 font-medium">邮箱</th>
                <th className="text-left px-4 py-2 font-medium">等级</th>
                <th className="text-right px-4 py-2 font-medium">注册时间</th>
              </tr>
            </thead>
            <tbody>
              {tables.recentUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-neutral-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                tables.recentUsers.map((u) => (
                  <tr
                    key={u.username}
                    className="border-t border-neutral-50 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>{u.avatar_emoji}</span>
                        <span className="font-medium">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {u.email || "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {LEVEL_LABELS[u.target_level] || u.target_level}
                    </td>
                    <td className="text-right px-4 py-2 text-neutral-400">
                      {formatDateTime(u.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function formatDateTime(s: string): string {
  try {
    const d = new Date(s + "Z");
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return s;
  }
}
