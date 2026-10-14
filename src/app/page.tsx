"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useLanguage } from "@/lib/language-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Mic,
  BookOpen,
  MessageCircle,
  Calendar,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Flame,
  Target,
  Zap,
  PenTool,
} from "lucide-react"

interface HomeStats {
  streak: number
  totalDialogues: number
  totalWords: number
  todayScenes: number
  todayCompleted: boolean
  heatmapData: { date: string; level: number }[]
}

export default function HomePage() {
  const { language, config } = useLanguage()
  const [stats, setStats] = useState<HomeStats>({
    streak: 0,
    totalDialogues: 0,
    totalWords: 0,
    todayScenes: 0,
    todayCompleted: false,
    heatmapData: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [language])

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await fetch(`/api/home/stats?lang=${language}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      try {
        const raw = localStorage.getItem("linguamind_daily")
        const daily = raw ? JSON.parse(raw) : {}
        const today = new Date().toISOString().slice(0, 10)
        const todayData = daily[today]
        setStats(prev => ({
          ...prev,
          todayCompleted: todayData?.completed === true,
        }))
      } catch { /* ignore */ }
    } finally {
      setLoading(false)
    }
  }

  const greeting = getGreeting(language)
  const dailyQuote = getDailyQuote(language)

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">
          {language === "en"
            ? "Every day is a chance to get better. Let's go!"
            : "매일이 더 나아질 기회예요. 시작해볼까요!"}
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          <>
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </>
        ) : (
          <>
            <Link href="/report">
              <StatCard
                icon={<Flame className="h-4 w-4" />}
                label={language === "en" ? "Day Streak" : "연속"}
                value={`${stats.streak}`}
              />
            </Link>
            <Link href="/report">
              <StatCard
                icon={<MessageCircle className="h-4 w-4" />}
                label={language === "en" ? "Dialogues" : "대화"}
                value={`${stats.totalDialogues}`}
              />
            </Link>
            <Link href="/words">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                label={language === "en" ? "Words" : "단어"}
                value={`${stats.totalWords}`}
              />
            </Link>
          </>
        )}
      </div>

      {/* Today's Status */}
      {loading ? (
        <div className="skeleton h-48" />
      ) : (
        <Card
          className="border-2"
          style={{ borderColor: "var(--accent-border)" }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5" style={{ color: "var(--accent)" }} />
              {language === "en" ? "Today's Status" : "오늘의 현황"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--surface-subtle)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
                  {stats.todayScenes}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {language === "en" ? "Scenes Practiced" : "연습한 장면"}
                </p>
              </div>
              <div className="bg-[var(--surface-subtle)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
                  {stats.todayCompleted ? "Done" : "-"}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {language === "en" ? "Daily Challenge" : "오늘의 도전"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                {language === "en" ? "Today's progress" : "오늘 진행률"}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                {stats.todayCompleted
                  ? (language === "en" ? "Done!" : "완료!")
                  : `${stats.todayScenes}/3`}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: stats.todayCompleted ? "100%" : `${Math.min(stats.todayScenes * 33, 66)}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 px-1">
          {language === "en" ? "Quick Start" : "빠른 시작"}
        </h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickActionCard
            href="/dialogue"
            icon={<MessageCircle className="h-5 w-5" />}
            title={language === "en" ? "Dialogue" : "대화"}
            subtitle={language === "en" ? "Practice" : "연습"}
          />
          <QuickActionCard
            href="/words"
            icon={<PenTool className="h-5 w-5" />}
            title={language === "en" ? "Words" : "단어"}
            subtitle={language === "en" ? "Learn" : "학습"}
          />
          <QuickActionCard
            href="/daily"
            icon={<Zap className="h-5 w-5" />}
            title={language === "en" ? "Daily" : "오늘의 문장"}
            subtitle={language === "en" ? "Challenge" : "도전"}
            badge={!stats.todayCompleted}
          />
          <QuickActionCard
            href="/report"
            icon={<TrendingUp className="h-5 w-5" />}
            title={language === "en" ? "Report" : "리포트"}
            subtitle={language === "en" ? "Stats" : "통계"}
          />
        </div>
      </div>

      {/* Learning Heatmap */}
      {loading ? (
        <div className="skeleton h-40" />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" style={{ color: "var(--accent)" }} />
              {language === "en" ? "Learning Heatmap" : "학습 히트맵"}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                {language === "en" ? "(Last 90 days)" : "(최근 90일)"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HeatmapGrid data={stats.heatmapData} />
            <div className="flex items-center justify-end gap-1.5 mt-3">
              <span className="text-xs text-[var(--text-muted)]">
                {language === "en" ? "Less" : "적음"}
              </span>
              {[0, 1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: getHeatColor(level) }}
                />
              ))}
              <span className="text-xs text-[var(--text-muted)]">
                {language === "en" ? "More" : "많음"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Quote */}
      <Card className="bg-gradient-to-br from-neutral-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Sparkles
              className="h-5 w-5 flex-shrink-0 mt-0.5"
              style={{ color: "var(--accent)" }}
            />
            <div>
              <p className="text-sm italic text-[var(--text-secondary)]">
                {dailyQuote.text}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {dailyQuote.translation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Heatmap Grid ───────────────────────────────────────────────

function HeatmapGrid({
  data,
}: {
  data: { date: string; level: number }[]
}) {
  const today = new Date()
  const weeks: { date: string; level: number }[][] = []
  const dataMap = new Map(data.map(d => [d.date, d.level]))

  const start = new Date(today)
  start.setDate(start.getDate() - 90)
  start.setDate(start.getDate() - start.getDay())

  let current = new Date(start)
  for (let w = 0; w < 14; w++) {
    const week: { date: string; level: number }[] = []
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().slice(0, 10)
      const isFuture = current > today
      week.push({
        date: dateStr,
        level: isFuture ? -1 : (dataMap.get(dateStr) ?? 0),
      })
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }

  const monthLabels: { col: number; label: string }[] = []
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w][0]
    if (!firstDay) continue
    const m = parseInt(firstDay.date.slice(5, 7)) - 1
    const prevW = w > 0 ? weeks[w - 1][0] : null
    const prevM = prevW ? parseInt(prevW.date.slice(5, 7)) - 1 : -1
    if (m !== prevM) {
      monthLabels.push({ col: w, label: months[m] })
    }
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""]

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-[700px]">
        {/* Month labels */}
        <div className="flex ml-8">
          {monthLabels.map((ml, i) => (
            <div
              key={i}
              className="text-xs text-[var(--text-muted)]"
              style={{
                marginLeft: i === 0 ? `${ml.col * 14}px` : `${(ml.col - monthLabels[i - 1].col) * 14}px`,
              }}
            >
              {ml.label}
            </div>
          ))}
        </div>

        {/* Grid with day labels */}
        <div className="flex">
          <div className="flex flex-col gap-0.5 mr-1.5">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="w-7 h-3 flex items-center justify-end text-[10px] text-neutral-300"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex gap-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="w-3 h-3 rounded-sm"
                    style={{
                      backgroundColor:
                        day.level === -1
                          ? "transparent"
                          : getHeatColor(day.level),
                    }}
                    title={day.level === -1 ? "" : `${day.date}: Level ${day.level}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function QuickActionCard({
  href,
  icon,
  title,
  subtitle,
  badge,
}: {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
  badge?: boolean
}) {
  return (
    <Link href={href}>
      <Card data-card-interactive className="cursor-pointer relative">
        {badge && (
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
        )}
        <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: "var(--accent-secondary)",
              color: "var(--accent)",
            }}
          >
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card data-card-interactive>
      <CardContent className="flex flex-col items-center gap-1 p-3">
        <div style={{ color: "var(--accent)" }}>{icon}</div>
        <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
          {value}
        </div>
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
      </CardContent>
    </Card>
  )
}

// ── Helpers ────────────────────────────────────────────────────

function getHeatColor(level: number): string {
  if (level <= 0) return "#f1f5f9"
  if (level === 1) return "color-mix(in srgb, var(--accent) 25%, transparent)"
  if (level === 2) return "color-mix(in srgb, var(--accent) 45%, transparent)"
  if (level === 3) return "color-mix(in srgb, var(--accent) 65%, transparent)"
  return "var(--accent)"
}

function getGreeting(language: string): string {
  const hour = new Date().getHours()
  if (language === "ko") {
    if (hour < 12) return "좋은 아침이에요"
    if (hour < 18) return "좋은 오후예요"
    return "좋은 저녁이에요"
  }
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function getDailyQuote(language: string) {
  const quotes = {
    en: {
      text: "In the middle of difficulty lies opportunity.",
      translation: "困难之中蕴藏着机遇。",
    },
    ko: {
      text: "시작이 반이다.",
      translation: "好的开始是成功的一半。",
    },
  }
  return quotes[language as "en" | "ko"] || quotes.en
}
