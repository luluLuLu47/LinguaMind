"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import { ChevronLeft, Gamepad2, Target, Sparkles, RefreshCw, Brain, Spade, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { WORD_THEMES } from "./word-banks"

export default function MiniGameLobbyPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = language as "en" | "ko"

  const t = lang === "en" ? {
    title: "Game Center",
    subtitle: "Learn English while having fun!",
    backHome: "Back to Home",
    games: "Available Games",
    difficultyBadge: "CET-4 / CET-6 / 考研",
    matchTitle: "Word Match",
    matchSubtitle: "Flip cards, match words & translations",
    matchDesc: "Memory pairing game using CET-4, CET-6 and postgraduate vocabulary.",
    gomokuTitle: "Word Gomoku",
    gomokuSubtitle: "Answer correctly to place your stone",
    gomokuDesc: "Classic 5-in-a-row with vocabulary quiz before every move.",
    landlordTitle: "Word Landlord",
    landlordSubtitle: "Bid, play & learn words",
    landlordDesc: "Dou Dizhu card game with word quizzes before every play.",
    themeTitle: "Vocabulary Levels",
    themeSubtitle: "All games use these word banks:",
    played: "Play",
    locked: "Locked",
  } : {
    title: "게임 센터",
    subtitle: "재미있게 영어를 배워요!",
    backHome: "홈으로",
    games: "게임 목록",
    difficultyBadge: "CET-4 / CET-6 / 대학원",
    matchTitle: "단어 짝맞추기",
    matchSubtitle: "카드를 뒤집어 단어와 뜻을 맞춰보세요",
    matchDesc: "CET-4, CET-6, 대학원 단어로 즐기는 메모리 짝맞추기 게임.",
    gomokuTitle: "단어 오목",
    gomokuSubtitle: "문제를 맞춰야 돌을 놓을 수 있어요",
    gomokuDesc: "매 차례 단어 퀴즈를 풀고 두는 고전 오목 게임.",
    landlordTitle: "단어 투쟁",
    landlordSubtitle: "부름, 출판, 단어 학습",
    landlordDesc: "매 패마다 단어 퀴즈가 있는 투쟁 카드 게임.",
    themeTitle: "단어 난이도",
    themeSubtitle: "모든 게임은 다음 단어장을 사용합니다:",
    played: "시작",
    locked: "잠김",
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gamepad2 className="h-6 w-6" style={{ color: "var(--accent)" }} />
              {t.title}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">{t.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Difficulty badge */}
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
        style={{
          backgroundColor: "var(--accent-secondary)",
          color: "var(--accent)",
        }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {t.difficultyBadge}
      </div>

      {/* Section title */}
      <div>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3 px-1">
          {t.games}
        </h2>

        {/* Game cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Word Match */}
          <Link href="/mini-game/match">
            <GameCard
              icon={<RefreshCw className="h-7 w-7" />}
              accentColor="#10b981"
              title={t.matchTitle}
              subtitle={t.matchSubtitle}
              description={t.matchDesc}
              btnLabel={t.played}
            />
          </Link>

          {/* Word Gomoku */}
          <Link href="/mini-game/gomoku">
            <GameCard
              icon={<Brain className="h-7 w-7" />}
              accentColor="#8b5cf6"
              title={t.gomokuTitle}
              subtitle={t.gomokuSubtitle}
              description={t.gomokuDesc}
              btnLabel={t.played}
            />
          </Link>

          {/* Word Landlord (Dou Dizhu) */}
          <Link href="/mini-game/landlord" className="sm:col-span-2">
            <GameCard
              icon={<Spade className="h-7 w-7" />}
              accentColor="#ef4444"
              title={t.landlordTitle}
              subtitle={t.landlordSubtitle}
              description={t.landlordDesc}
              btnLabel={t.played}
            />
          </Link>
        </div>
      </div>

      {/* Theme info */}
      <Card className="mt-2" style={{ border: "1px solid var(--border)" }}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <h3 className="text-sm font-bold">{t.themeTitle}</h3>
            <span className="text-xs text-[var(--text-muted)]">
              {t.themeSubtitle}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {WORD_THEMES.map((theme) => (
              <div
                key={theme.id}
                className="flex items-center gap-3 rounded-xl p-3"
                style={{ backgroundColor: "var(--surface-subtle)" }}
              >
                <span className="text-3xl">{theme.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {lang === "en" ? theme.nameEn : theme.nameZh}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {theme.words.length} {lang === "en" ? "words" : "단어"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ========================================
// 游戏卡片子组件
// ========================================
function GameCard({
  icon,
  accentColor,
  title,
  subtitle,
  description,
  btnLabel,
  locked = false,
}: {
  icon: React.ReactNode
  accentColor: string
  title: string
  subtitle: string
  description: string
  btnLabel: string
  locked?: boolean
}) {
  return (
    <Card
      data-card-interactive
      className={`cursor-pointer relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
        locked ? "opacity-70 cursor-not-allowed" : ""
      }`}
      style={{
        border: `1px solid var(--border)`,
        transform: locked ? undefined : "translateY(0)",
      }}
    >
      {/* 彩色装饰条 */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ backgroundColor: accentColor, opacity: 0.85 }}
      />
      <CardContent className="p-5 pt-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
                color: accentColor,
              }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold truncate flex items-center gap-2">
                {title}
                {locked && <Lock className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
              </h3>
              <p
                className="text-xs font-medium mt-0.5"
                style={{ color: accentColor }}
              >
                {subtitle}
              </p>
            </div>
          </div>
          {/* Play button pill */}
          <div
            className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              locked ? "opacity-60" : ""
            }`}
            style={{
              backgroundColor: locked ? "var(--surface-subtle)" : accentColor,
              color: locked ? "var(--text-muted)" : "#fff",
            }}
          >
            {btnLabel}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}
