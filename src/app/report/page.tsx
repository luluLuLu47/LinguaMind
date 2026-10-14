"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import {
  BarChart3,
  MessageSquare,
  Clock,
  BookOpen,
  Target,
  TrendingUp,
  ChevronLeft,
  Loader2,
  Sparkles,
  AlertCircle,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface ReportData {
  weeklyStats: {
    totalConversations: number
    totalStudyMinutes: number
    newVocabulary: number
    averageAccuracy: number
  }
  accuracyTrend: Array<{ date: string; accuracy: number }>
  vocabularyGrowth: Array<{ date: string; count: number }>
  sceneDistribution: Array<{ scene: string; count: number }>
  errorTypes: Array<{ type: string; count: number }>
}

const CHART_COLORS = ["#2bb3a3", "#a78bfa", "#fbbf24", "#f472b6", "#60a5fa", "#34d399"]

export default function ReportPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = language as "en" | "ko"

  const [data, setData] = useState<ReportData | null>(null)
  const [advice, setAdvice] = useState<string>("")
  const [adviceSource, setAdviceSource] = useState<"ai" | "fallback">("fallback")
  const [loading, setLoading] = useState(true)
  const [adviceLoading, setAdviceLoading] = useState(true)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState<string | null>(null)

  // 触发浏览器下载：GET API，把响应转 blob，再点临时 <a>
  const triggerDownload = useCallback(async (
    endpoint: string,
    kind: string
  ) => {
    setExporting(kind)
    try {
      const res = await fetch(endpoint)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const disp = res.headers.get("Content-Disposition") || ""
      const match = disp.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : `linguamind_${kind}.bin`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      console.error(`[Export ${kind}] error:`, err)
      const msg = err instanceof Error ? err.message : String(err)
      alert((lang === "en" ? "Export failed: " : "导出失败：") + msg)
    } finally {
      setExporting(null)
    }
  }, [lang])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [summaryRes, adviceRes] = await Promise.all([
        fetch(`/api/report/summary?lang=${lang}`),
        fetch(`/api/report/advice?lang=${lang}`),
      ])

      if (!summaryRes.ok) throw new Error("Failed to load summary")
      const summaryData = await summaryRes.json()
      setData(summaryData)

      if (adviceRes.ok) {
        const adviceData = await adviceRes.json()
        setAdvice(adviceData.advice)
        setAdviceSource(adviceData.source || "fallback")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report data")
    } finally {
      setLoading(false)
      setAdviceLoading(false)
    }
  }, [lang])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-[var(--text-muted)]">
        <AlertCircle className="h-10 w-10" />
        <p>{error || "Failed to load report"}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-xl text-sm text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Retry
        </button>
      </div>
    )
  }

  const { weeklyStats } = data

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const statsCards = [
    {
      icon: MessageSquare,
      label: lang === "en" ? "Conversations" : "대화 횟수",
      value: weeklyStats.totalConversations,
      unit: lang === "en" ? "sessions" : "회",
      color: CHART_COLORS[0],
    },
    {
      icon: Clock,
      label: lang === "en" ? "Study Time" : "학습 시간",
      value: weeklyStats.totalStudyMinutes,
      unit: lang === "en" ? "min" : "분",
      color: CHART_COLORS[1],
    },
    {
      icon: BookOpen,
      label: lang === "en" ? "New Words" : "새 단어",
      value: weeklyStats.newVocabulary,
      unit: lang === "en" ? "words" : "개",
      color: CHART_COLORS[2],
    },
    {
      icon: Target,
      label: lang === "en" ? "Avg Accuracy" : "평균 정확도",
      value: weeklyStats.averageAccuracy,
      unit: "%",
      color: CHART_COLORS[3],
    },
  ]

  return (
    <div className="space-y-6 pb-8">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          title={lang === "en" ? "Back" : "뒤로가기"}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <BarChart3 className="h-6 w-6" style={{ color: "var(--accent)" }} />
        <h1 className="text-2xl font-bold">
          {lang === "en" ? "Learning Report" : "학습 리포트"}
        </h1>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-2"
            style={{ backgroundColor: "var(--card)" }}
          >
            <div className="flex items-center gap-2">
              <card.icon className="h-4 w-4" style={{ color: card.color }} />
              <span className="text-xs text-[var(--text-muted)]">{card.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold" style={{ color: card.color }}>
                {card.value}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 准确率趋势 */}
        <div className="rounded-2xl border border-[var(--border)] p-5" style={{ backgroundColor: "var(--card)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: "var(--accent)" }} />
            {lang === "en" ? "Accuracy Trend" : "정확도 추이"}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.accuracyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                fontSize={12}
                tick={{ fill: "var(--text-muted)" }}
              />
              <YAxis domain={[0, 100]} fontSize={12} tick={{ fill: "var(--text-muted)" }} />
              <Tooltip
                labelFormatter={formatDate as any}
                formatter={(value: any) => [`${value}%`, lang === "en" ? "Accuracy" : "정확도"]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--accent)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 词汇增长 */}
        <div className="rounded-2xl border border-[var(--border)] p-5" style={{ backgroundColor: "var(--card)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: "var(--accent)" }} />
            {lang === "en" ? "Vocabulary Growth" : "어휘 증가"}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.vocabularyGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                fontSize={12}
                tick={{ fill: "var(--text-muted)" }}
              />
              <YAxis fontSize={12} tick={{ fill: "var(--text-muted)" }} />
              <Tooltip
                labelFormatter={formatDate as any}
                formatter={(value: any) => [
                  `${value}`,
                  lang === "en" ? "Words" : "단어",
                ]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                }}
              />
              <Bar
                dataKey="count"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 场景分布 */}
        <div className="rounded-2xl border border-[var(--border)] p-5" style={{ backgroundColor: "var(--card)" }}>
          <h3 className="text-sm font-semibold mb-4">
            {lang === "en" ? "Scene Distribution" : "장면 분포"}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.sceneDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="count"
                nameKey="scene"
                label={({ scene, count }: any) => `${scene} (${count})`}
                labelLine={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
              >
                {data.sceneDistribution.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 错误类型 */}
        <div className="rounded-2xl border border-[var(--border)] p-5" style={{ backgroundColor: "var(--card)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" style={{ color: "var(--accent)" }} />
            {lang === "en" ? "Common Errors" : "주요 오류"}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.errorTypes}
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
              <XAxis type="number" fontSize={12} tick={{ fill: "var(--text-muted)" }} />
              <YAxis
                dataKey="type"
                type="category"
                fontSize={12}
                tick={{ fill: "var(--text-muted)" }}
                width={80}
              />
              <Tooltip
                formatter={(value: any) => [
                  `${value}`,
                  lang === "en" ? "Times" : "회",
                ]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                }}
              />
              <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI 学习建议 */}
      <div
        className="rounded-2xl border-2 p-6 relative overflow-hidden"
        style={{
          borderColor: "var(--accent-border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold">
            {lang === "en" ? "AI Learning Coach" : "AI 학습 코치"}
          </h2>
          {adviceSource === "ai" && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "var(--accent-secondary)",
                color: "var(--accent)",
              }}
            >
              AI
            </span>
          )}
        </div>

        {adviceLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {lang === "en" ? "Generating personalized advice..." : "맞춤 조언 생성 중..."}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
            {advice}
          </div>
        )}
      </div>

      {/* 数据导出面板 */}
      <div
        className="rounded-2xl border border-[var(--border)] p-5"
        style={{ backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg font-semibold">
              {lang === "en" ? "Export Your Data" : "데이터 내보내기"}
            </h2>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {lang === "en"
              ? "Backup your progress or analyze in Excel"
              : "학습 기록 백업 및 엑셀 분석용"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. 完整备份 JSON */}
          <button
            onClick={() => triggerDownload(`/api/export/all?format=json&lang=${lang}`, "backup-json")}
            disabled={exporting !== null}
            className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4 text-left transition-all hover:border-[var(--accent)] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4" style={{ color: "var(--accent)" }} />
              <span className="font-medium text-sm">
                {lang === "en" ? "Full Backup (JSON)" : "전체 백업 (JSON)"}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {lang === "en"
                ? "6 tables incl. sessions, messages, checkins, stats, vocab, games"
                : "대화·메시지·출석·통계·단어·게임 6가지 데이터 포함"}
            </p>
          </button>

          {/* 2. 学习统计 CSV */}
          <button
            onClick={() => triggerDownload(`/api/export/all?format=csv&lang=${lang}`, "stats-csv")}
            disabled={exporting !== null}
            className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4 text-left transition-all hover:border-[var(--accent)] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" style={{ color: "#f59e0b" }} />
              <span className="font-medium text-sm">
                {lang === "en" ? "Daily Stats (CSV)" : "일일 통계 (CSV)"}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {lang === "en"
                ? "learning_stats one row per day, open directly in Excel"
                : "learning_stats 일별 행 데이터，엑셀에서 바로 열기 가능"}
            </p>
          </button>

          {/* 3. 对话历史 TXT */}
          <button
            onClick={() => triggerDownload(`/api/export/sessions?format=txt&lang=${lang}`, "sessions-txt")}
            disabled={exporting !== null}
            className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4 text-left transition-all hover:border-[var(--accent)] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: "#22c55e" }} />
              <span className="font-medium text-sm">
                {lang === "en" ? "Sessions (TXT)" : "대화 기록 (TXT)"}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {lang === "en"
                ? "Human-readable dialog transcripts with coach feedback"
                : "읽기 쉬운 대화본 형식，코치 피드백 포함"}
            </p>
          </button>

          {/* 4. 对话历史 JSON */}
          <button
            onClick={() => triggerDownload(`/api/export/sessions?format=json&lang=${lang}`, "sessions-json")}
            disabled={exporting !== null}
            className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4 text-left transition-all hover:border-[var(--accent)] hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4" style={{ color: "#8b5cf6" }} />
              <span className="font-medium text-sm">
                {lang === "en" ? "Sessions (JSON)" : "대화 기록 (JSON)"}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {lang === "en"
                ? "Structured sessions with nested messages, ready to import"
                : "메시지 포함 구조화된 세션，가져오기/분석에 용이"}
            </p>
          </button>
        </div>

        {exporting && (
          <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--accent)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {lang === "en" ? "Preparing download..." : "파일 준비 중..."} ({exporting})
          </div>
        )}
      </div>

      {/* 提示 */}
      <p className="text-xs text-[var(--text-muted)] text-center">
        {lang === "en"
          ? "Data is updated daily. Keep practicing to see your progress!"
          : "데이터는 매일 업데이트됩니다. 꾸준히 연습해서 성장을 확인하세요!"}
      </p>
    </div>
  )
}
