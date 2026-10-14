"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useLanguage } from "@/lib/language-context"
import { useSpeechRecognition } from "@/lib/use-speech-recognition"
import { englishScenes, koreanScenes, sceneCategories } from "@/data/scenes"
import type { SceneNode } from "@/data/scenes"
import {
  Send, Mic, MicOff, ChevronRight, ChevronLeft,
  Sparkles, X, Volume2, Loader2, BookOpen,
  Zap, Trophy, Target, RotateCcw, Timer,
} from "lucide-react"

// ============================================================
// 类型定义
// ============================================================

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
}

interface LearningFeedback {
  errors: Array<{
    type: "grammar" | "vocabulary" | "pronunciation"
    severity: "critical" | "minor"
    original: string
    correction: string
    explanation: string
  }>
  newVocabulary: Array<{
    word: string
    phonetic: string
    meaning: string
    example: string
  }>
  stats: {
    accuracy: number
    fluency: number
    nervousness: "low" | "medium" | "high"
  }
}

interface RoundScore {
  round: number
  score: number
  comment: string
}

interface ChallengeResult {
  totalScore: number
  maxScore: number
  grade: "S" | "A" | "B" | "C"
  comment: string
  roundScores: RoundScore[]
  sceneTitle: string
}

// ============================================================
// 辅助函数
// ============================================================

const GRADE_COLORS: Record<string, string> = {
  S: "#f59e0b",
  A: "#10b981",
  B: "#3b82f6",
  C: "#6b7280",
}

const GRADE_LABELS: Record<string, string> = {
  S: "🏆 Perfect",
  A: "🌟 Excellent",
  B: "👍 Good",
  C: "💪 Keep Going",
}

const TOTAL_CHALLENGE_ROUNDS = 10

// 根据分类ID过滤场景（匹配场景ID前缀）
function filterByCategory(scenes: SceneNode[], categoryId: string): SceneNode[] {
  if (categoryId === "all") return scenes
  return scenes.filter(s => s.id.includes(`-${categoryId}`) || s.id.includes(categoryId))
}

// 生成会话 ID（浏览器/Node 兼容）
function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ============================================================
// 对话页面主组件
// ============================================================

export default function DialoguePage() {
  const { language, config } = useLanguage()

  const scenes = language === "en" ? englishScenes : koreanScenes
  const categories = sceneCategories[language]

  // 模式：normal | challenge
  const [mode, setMode] = useState<"normal" | "challenge">("normal")
  const [showScenePicker, setShowScenePicker] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [selectedScene, setSelectedScene] = useState<SceneNode | null>(null)

  // 挑战模式
  const [showDifficultyPicker, setShowDifficultyPicker] = useState(false)
  const [challengeRound, setChallengeRound] = useState(0)
  const [challengeScores, setChallengeScores] = useState<RoundScore[]>([])
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null)

  // 对话
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 语音：使用浏览器原生 Web Speech API（免费、实时）
  const {
    isListening: isRecording,
    isSupported: isSpeechSupported,
    startListening: startSpeech,
    stopListening: stopSpeech,
  } = useSpeechRecognition({
    lang: language,
    onResult: (text) => {
      setInput((prev) => (prev ? prev + " " + text : text))
    },
  })

  // 会话历史保存
  const sessionIdRef = useRef<string>("")
  const historySavedRef = useRef<boolean>(false)

  // 学习面板
  const [showPanel, setShowPanel] = useState(true)
  const [feedback, setFeedback] = useState<LearningFeedback | null>(null)
  const [feedbackHistory, setFeedbackHistory] = useState<LearningFeedback[]>([])
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set())

  // 过滤场景
  const filteredScenes = filterByCategory(scenes, activeCategory)

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // =========================================
  // 保存对话会话到后端
  // =========================================
  const saveHistory = useCallback(async (opts: {
    scene: SceneNode | null
    msgs: Message[]
    roundScores?: RoundScore[]
  }) => {
    const sid = sessionIdRef.current
    if (!sid || !opts.scene || historySavedRef.current) return
    historySavedRef.current = true

    const rs = opts.roundScores ?? []
    const totalRounds = rs.length > 0 ? rs.length : undefined
    const avgScore = rs.length > 0
      ? rs.reduce((s, r) => s + r.score, 0) / rs.length
      : undefined

    try {
      await fetch("/api/history/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          sceneId: opts.scene.id,
          sceneTitle: opts.scene.title,
          language,
          messages: opts.msgs
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => ({ role: m.role, content: m.content })),
          totalRounds,
          avgScore,
        }),
      })
    } catch (err) {
      console.error("[History] Save error:", err)
      historySavedRef.current = false
    }
  }, [language])

  // 挑战模式完成时保存会话
  useEffect(() => {
    if (challengeResult && mode === "challenge") {
      void saveHistory({
        scene: selectedScene,
        msgs: messages,
        roundScores: challengeResult.roundScores,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeResult])

  // =========================================
  // 普通模式：选择场景
  // =========================================
  const handleSelectScene = useCallback((scene: SceneNode) => {
    sessionIdRef.current = newSessionId()
    historySavedRef.current = false
    setMode("normal")
    setSelectedScene(scene)
    setShowScenePicker(false)
    setChallengeResult(null)
    setChallengeScores([])
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: scene.openingLine,
      timestamp: Date.now(),
    }])
    setFeedback(null)
  }, [])

  // =========================================
  // 挑战模式：开始
  // =========================================
  const handleStartChallenge = useCallback(async (difficulty?: "beginner" | "intermediate" | "advanced") => {
    sessionIdRef.current = newSessionId()
    historySavedRef.current = false
    setShowDifficultyPicker(false)
    setShowScenePicker(false)
    setMode("challenge")
    setChallengeRound(0)
    setChallengeScores([])
    setChallengeResult(null)
    setIsLoading(true)

    try {
      const res = await fetch("/api/challenge/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, difficulty }),
      })
      const data = await res.json()

      if (data.scene) {
        setSelectedScene(data.scene)
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: data.scene.openingLine,
          timestamp: Date.now(),
        }])
        setFeedback(null)
      }
    } catch (err) {
      console.error("[Challenge] Start error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [language])

  // =========================================
  // 挑战模式：发送消息（回合制）
  // =========================================
  const handleChallengeSend = useCallback(async () => {
    if (!input.trim() || !selectedScene || isLoading) return

    const round = challengeRound + 1
    const isLastRound = round >= TOTAL_CHALLENGE_ROUNDS

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    }

    const allMessages = [...messages, userMessage]
    const chatMessages = allMessages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setChallengeRound(round)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantId, role: "assistant", content: "", timestamp: Date.now(),
    }])

    try {
      const response = await fetch("/api/challenge/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatMessages,
          scene: selectedScene,
          language,
          round,
          totalRounds: TOTAL_CHALLENGE_ROUNDS,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let eventType = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)

              if (eventType === "dialogue") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + parsed.content } : m
                ))
              } else if (eventType === "roundScore") {
                setChallengeScores(prev => [...prev, parsed as RoundScore])
              } else if (eventType === "feedback") {
                const newFb = parsed as LearningFeedback
                setFeedback(newFb)
                setFeedbackHistory(prev => [...prev, newFb])
              } else if (eventType === "challengeComplete") {
                // 最后一轮完成后计算总分
                setChallengeScores(prev => {
                  const allScores = [...prev]
                  const total = allScores.reduce((sum, s) => sum + s.score, 0)
                  const maxScore = allScores.length * 10
                  const ratio = maxScore > 0 ? total / maxScore : 0
                  let grade: ChallengeResult["grade"] = "C"
                  if (ratio >= 0.9) grade = "S"
                  else if (ratio >= 0.75) grade = "A"
                  else if (ratio >= 0.6) grade = "B"

                  const comments: Record<string, string> = {
                    S: language === "en" ? "Outstanding! You're a natural communicator!" : "대단해요! 타고난 소통가네요!",
                    A: language === "en" ? "Great job! Keep it up!" : "잘했어요! 계속해요!",
                    B: language === "en" ? "Good effort! Focus on the highlighted areas." : "좋은 노력이에요!",
                    C: language === "en" ? "Keep going! Every conversation makes you better." : "계속해요! 모든 대화가 당신을 더 나아지게 해요.",
                  }

                  setChallengeResult({
                    totalScore: total,
                    maxScore,
                    grade,
                    comment: comments[grade],
                    roundScores: allScores,
                    sceneTitle: selectedScene?.title || "",
                  })
                  return allScores
                })
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      console.error("[Challenge] SSE error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [input, selectedScene, isLoading, language, messages, challengeRound])

  // =========================================
  // 普通模式：发送消息
  // =========================================
  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedScene || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    }

    const allMessages = [...messages, userMessage]
    const chatMessages = allMessages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantId, role: "assistant", content: "", timestamp: Date.now(),
    }])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, scene: selectedScene, language }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let eventType = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              if (eventType === "dialogue") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + parsed.content } : m
                ))
              } else if (eventType === "feedback") {
                const newFb = parsed as LearningFeedback
                setFeedback(newFb)
                setFeedbackHistory(prev => [...prev, newFb])
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      console.error("[Chat] SSE error:", err)
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? {
          ...m,
          content: language === "en"
            ? "Sorry, something went wrong. Please try again."
            : "죄송합니다. 문제가 발생했습니다. 다시 시도해 주세요.",
        } : m
      ))
    } finally {
      setIsLoading(false)
    }
  }, [input, selectedScene, isLoading, language, messages])

  // 发送入口：根据模式分发
  const doSend = mode === "challenge" ? handleChallengeSend : handleSend

  // 语音：点击麦克风 → Web Speech API 实时识别
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopSpeech()
      return
    }
    startSpeech()
  }, [isRecording, startSpeech, stopSpeech])

  const toggleSaveWord = useCallback(async (word: string) => {
    const isSaved = savedWords.has(word)
    setSavedWords(prev => {
      const next = new Set(prev)
      next.has(word) ? next.delete(word) : next.add(word)
      return next
    })
    if (!isSaved) {
      const vocab = feedbackHistory
        .flatMap(f => f.newVocabulary)
        .find(v => v.word === word)
      try {
        await fetch("/api/vocabulary/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word,
            language,
            meaning: vocab?.meaning || "",
            phonetic: vocab?.phonetic || "",
            sceneId: selectedScene?.id || null,
          }),
        })
      } catch (err) {
        console.error("[Vocab] Save error:", err)
      }
    }
  }, [savedWords, feedbackHistory, language, selectedScene])

  const difficultyColor = (d: string) => {
    switch (d) {
      case "beginner": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      case "intermediate": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "advanced": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      default: return ""
    }
  }

  // =========================================
  // 重置：回到场景选择
  // =========================================
  const handleReset = () => {
    // 普通模式：返回场景前保存会话（挑战模式在完成时已保存）
    if (mode === "normal") {
      void saveHistory({ scene: selectedScene, msgs: messages })
    }
    setShowScenePicker(true)
    setMode("normal")
    setSelectedScene(null)
    setMessages([])
    setFeedback(null)
    setFeedbackHistory([])
    setChallengeResult(null)
    setChallengeScores([])
    setChallengeRound(0)
  }

  // =========================================
  // 挑战结束面板
  // =========================================
  if (challengeResult) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-2xl border border-border bg-card text-center space-y-6">
          <div className="text-6xl">{GRADE_LABELS[challengeResult.grade].split(" ")[0]}</div>
          <div>
            <h2 className="text-3xl font-black" style={{ color: GRADE_COLORS[challengeResult.grade] }}>
              {challengeResult.grade}
            </h2>
            <p className="text-muted-foreground mt-1">{challengeResult.comment}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-secondary">
              <div className="text-muted-foreground text-xs">
                {language === "en" ? "Total Score" : "총점"}
              </div>
              <div className="text-2xl font-bold" style={{ color: config.primaryColor }}>
                {challengeResult.totalScore}/{challengeResult.maxScore}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-secondary">
              <div className="text-muted-foreground text-xs">
                {language === "en" ? "Scene" : "장면"}
              </div>
              <div className="text-sm font-semibold mt-1">{challengeResult.sceneTitle}</div>
            </div>
          </div>

          {/* 每轮分数 */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground text-left">
              {language === "en" ? "Round Scores" : "라운드 점수"}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {challengeResult.roundScores.map((rs, i) => (
                <div
                  key={i}
                  className="px-2 py-1 rounded text-xs font-mono"
                  style={{
                    backgroundColor: rs.score >= 8 ? "#dcfce7" : rs.score >= 6 ? "#fef9c3" : "#fee2e2",
                    color: rs.score >= 8 ? "#166534" : rs.score >= 6 ? "#854d0e" : "#991b1b",
                  }}
                  title={rs.comment}
                >
                  R{i + 1}: {rs.score}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setChallengeResult(null)
                handleStartChallenge()
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: config.primaryColor }}
            >
              <RotateCcw className="w-4 h-4 inline mr-1" />
              {language === "en" ? "Try Again" : "다시 도전"}
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-secondary hover:bg-secondary/80 transition-colors"
            >
              {language === "en" ? "Back to Scenes" : "시나리오로 돌아가기"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================
  // 场景选择界面
  // =========================================
  if (showScenePicker) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col">
        {/* 难度选择弹窗 */}
        {showDifficultyPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDifficultyPicker(false)}>
            <div
              className="bg-card rounded-2xl p-6 mx-4 max-w-sm w-full border border-border shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5" style={{ color: config.primaryColor }} />
                  {language === "en" ? "Challenge Mode" : "도전 모드"}
                </h3>
                <button onClick={() => setShowDifficultyPicker(false)} className="p-1 rounded-lg hover:bg-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {language === "en"
                  ? `10 rounds. Random scene. Your responses are scored each round. Ready?`
                  : `10라운드. 랜덤 시나리오. 매 라운드 점수가 매겨집니다. 준비됐나요?`}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleStartChallenge("beginner")}
                  className="w-full p-3 rounded-xl text-left bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
                >
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {language === "en" ? "Beginner" : "초급"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {language === "en" ? "Everyday topics, simple grammar" : "일상 주제, 간단한 문법"}
                  </span>
                </button>
                <button
                  onClick={() => handleStartChallenge("intermediate")}
                  className="w-full p-3 rounded-xl text-left bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-950/40 transition-colors"
                >
                  <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                    {language === "en" ? "Intermediate" : "중급"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {language === "en" ? "Work, travel, social situations" : "직장, 여행, 사교 상황"}
                  </span>
                </button>
                <button
                  onClick={() => handleStartChallenge("advanced")}
                  className="w-full p-3 rounded-xl text-left bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                >
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    {language === "en" ? "Advanced" : "고급"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {language === "en" ? "Complex topics, nuanced expression" : "복잡한 주제, 섬세한 표현"}
                  </span>
                </button>
                <button
                  onClick={() => handleStartChallenge()}
                  className="w-full p-3 rounded-xl text-left bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <span className="font-semibold">🎲 {language === "en" ? "Any Difficulty" : "모든 난이도"}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {language === "en" ? "Surprise me!" : "깜짝 도전!"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 头部 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: config.primaryColor }}>
            {language === "en" ? "Choose a Scene" : "시나리오 선택"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "en"
              ? "Pick a real-life scenario to practice your conversation skills"
              : "실제 상황에서 대화 연습을 시작하세요"}
          </p>
        </div>

        {/* 随机挑战入口 */}
        <button
          onClick={() => setShowDifficultyPicker(true)}
          className="mb-4 p-4 rounded-xl border-2 border-dashed text-left transition-all hover:shadow-lg group relative overflow-hidden"
          style={{ borderColor: config.primaryColor + "60", backgroundColor: config.primaryColor + "08" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: config.primaryColor + "20" }}>
              🎲
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg" style={{ color: config.primaryColor }}>
                  {language === "en" ? "Random Challenge" : "랜덤 도전"}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  NEW
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {language === "en"
                  ? "10 rounds · Random scenes · Scored each round · Get your grade!"
                  : "10라운드 · 랜덤 시나리오 · 매 라운드 점수 · 등급 확인!"}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-secondary">
              <Zap className="w-3 h-3" />
              S/A/B/C
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 分类过滤 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              activeCategory === "all" ? "text-white" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
            style={activeCategory === "all" ? { backgroundColor: config.primaryColor } : {}}
          >
            {language === "en" ? "All" : "전체"}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat.id ? "text-white" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
              style={activeCategory === cat.id ? { backgroundColor: config.primaryColor } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* 场景卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
          {filteredScenes.map(scene => (
            <button
              key={scene.id}
              onClick={() => handleSelectScene(scene)}
              className="text-left p-5 rounded-xl border border-border bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${difficultyColor(scene.difficulty)}`}>
                    {scene.difficulty}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{scene.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{scene.description}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{scene.role}</span>
                <span>·</span>
                <span>{scene.userRole}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {scene.targetVocabulary.slice(0, 3).map(w => (
                  <span key={w} className="px-2 py-0.5 bg-secondary rounded text-xs">{w}</span>
                ))}
                {scene.targetVocabulary.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-muted-foreground">+{scene.targetVocabulary.length - 3}</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {filteredScenes.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {language === "en" ? "No scenes found for this category." : "이 카테고리에 시나리오가 없습니다."}
          </div>
        )}
      </div>
    )
  }

  // =========================================
  // 对话界面（普通 + 挑战共用）
  // =========================================
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col">
      {/* 顶部栏 */}
      {selectedScene && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-card border border-border">
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            title={language === "en" ? "Back to scenes" : "시나리오로 돌아가기"}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* 挑战模式：隐藏标题 */}
              {mode === "challenge" ? (
                <>
                  <h2 className="font-semibold truncate">
                    🎲 {language === "en" ? "Challenge" : "도전"}
                  </h2>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {language === "en" ? `Round ${challengeRound}/${TOTAL_CHALLENGE_ROUNDS}` : `${challengeRound}/${TOTAL_CHALLENGE_ROUNDS}라운드`}
                  </span>
                </>
              ) : (
                <>
                  <h2 className="font-semibold truncate">{selectedScene.title}</h2>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${difficultyColor(selectedScene.difficulty)}`}>
                    {selectedScene.difficulty}
                  </span>
                </>
              )}
            </div>
            {mode === "challenge" ? (
              <p className="text-xs text-muted-foreground">
                {language === "en" ? "Hidden scene — adapt on the fly!" : "숨겨진 시나리오 — 즉흥적으로 대응하세요!"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground truncate">
                {selectedScene.role} · {selectedScene.userRole}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* 挑战模式回合分数预览 */}
            {mode === "challenge" && challengeScores.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-xs font-mono mr-1">
                <Target className="w-3 h-3" />
                {challengeScores.reduce((s, rs) => s + rs.score, 0)}
              </div>
            )}

            {/* 普通模式学习提示 */}
            {mode === "normal" && (
              <button
                onClick={() => {
                  const tipMsg: Message = {
                    id: `tip-${Date.now()}`,
                    role: "system",
                    content: `💡 **Tips:**\n${selectedScene.tips.map(t => `· ${t}`).join("\n")}`,
                    timestamp: Date.now(),
                  }
                  setMessages(prev => [...prev, tipMsg])
                }}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                title={language === "en" ? "Show tips" : "학습 팁 보기"}
              >
                <BookOpen className="w-4 h-4" />
              </button>
            )}

            {/* 面板切换 */}
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={`p-1.5 rounded-lg transition-colors ${showPanel ? "text-foreground" : "text-muted-foreground"}`}
              style={showPanel ? { backgroundColor: config.primaryColor + "20" } : {}}
              title={showPanel
                ? (language === "en" ? "Hide panel" : "패널 숨기기")
                : (language === "en" ? "Show panel" : "패널 보이기")
              }
            >
              {showPanel ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* 主体 */}
      <div className="flex-1 flex gap-0 overflow-hidden rounded-xl border border-border bg-card">
        {/* 左侧对话区 */}
        <div className={`flex flex-col min-w-0 ${showPanel ? "w-full lg:w-[60%]" : "w-full"}`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-white"
                      : msg.role === "system"
                        ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-foreground"
                        : "bg-secondary text-secondary-foreground"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: config.primaryColor } : {}}
                >
                  {msg.role === "system" ? (
                    <div className="whitespace-pre-line text-xs">{msg.content}</div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="p-3 border-t border-border">
            <div className="flex items-end gap-2">
              <button
                onClick={toggleRecording}
                disabled={!isSpeechSupported}
                className={`p-2.5 rounded-xl transition-colors shrink-0 disabled:opacity-50 ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
                title={
                  !isSpeechSupported
                    ? "当前浏览器不支持语音识别，请用 Chrome/Edge"
                    : isRecording
                    ? (language === "en" ? "Click to stop" : "중지")
                    : (language === "en" ? "Click to speak" : "말하기")
                }
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    doSend()
                  }
                }}
                placeholder={
                  isRecording
                    ? (language === "en" ? "Listening... click mic to stop" : "인식 중... 중지하려면 마이크 클릭")
                    : mode === "challenge"
                      ? (language === "en" ? "Respond naturally... (10 rounds challenge)" : "자연스럽게 응답하세요... (10라운드 도전)")
                      : (language === "en" ? "Type your message..." : "메시지를 입력하세요...")
                }
                className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm resize-none outline-none focus:ring-2 transition-all min-h-[42px] max-h-[120px]"
                style={{ "--tw-ring-color": config.primaryColor } as React.CSSProperties}
                rows={1}
                disabled={isLoading}
              />

              <button
                onClick={doSend}
                disabled={!input.trim() || isLoading}
                className="p-2.5 rounded-xl text-white shrink-0 transition-opacity disabled:opacity-40"
                style={{ backgroundColor: config.primaryColor }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 右侧学习面板 */}
        {showPanel && (
          <div className="hidden lg:flex lg:w-[40%] flex-col border-l border-border overflow-y-auto">
            <LearningPanel
              feedback={feedback}
              feedbackHistory={feedbackHistory}
              savedWords={savedWords}
              onToggleSave={toggleSaveWord}
              language={language}
              config={config}
              mode={mode}
              challengeRound={challengeRound}
              totalRounds={TOTAL_CHALLENGE_ROUNDS}
              challengeScores={challengeScores}
            />
          </div>
        )}
      </div>

      {/* 移动端学习面板 */}
      {showPanel && (
        <div className="lg:hidden mt-3 rounded-xl border border-border bg-card p-4">
          <LearningPanel
            feedback={feedback}
            feedbackHistory={feedbackHistory}
            savedWords={savedWords}
            onToggleSave={toggleSaveWord}
            language={language}
            config={config}
            mode={mode}
            challengeRound={challengeRound}
            totalRounds={TOTAL_CHALLENGE_ROUNDS}
            challengeScores={challengeScores}
            compact
          />
        </div>
      )}
    </div>
  )
}

// ============================================================
// 学习面板子组件
// ============================================================

function LearningPanel({
  feedback,
  feedbackHistory,
  savedWords,
  onToggleSave,
  language,
  config,
  mode = "normal",
  challengeRound = 0,
  totalRounds = 10,
  challengeScores = [],
  compact = false,
}: {
  feedback: LearningFeedback | null
  feedbackHistory: LearningFeedback[]
  savedWords: Set<string>
  onToggleSave: (word: string) => void
  language: "en" | "ko"
  config: { primaryColor: string; secondaryColor: string }
  mode?: "normal" | "challenge"
  challengeRound?: number
  totalRounds?: number
  challengeScores?: RoundScore[]
  compact?: boolean
}) {
  if (!feedback && mode === "normal") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <Sparkles className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">
          {language === "en"
            ? "Start a conversation to see your learning feedback here"
            : "대화를 시작하면 학습 피드백이 여기에 표시됩니다"}
        </p>
      </div>
    )
  }

  const statsLabels = language === "en"
    ? { accuracy: "Accuracy", fluency: "Fluency", nervousness: "Confidence" }
    : { accuracy: "정확도", fluency: "유창성", nervousness: "자신감" }

  // 累积所有历史反馈中的错误和词汇
  const allErrors = feedbackHistory.flatMap((f, idx) =>
    f.errors.map(err => ({ ...err, roundIdx: idx + 1 }))
  )
  const allVocab = feedbackHistory.flatMap((f, idx) =>
    f.newVocabulary.map(v => ({ ...v, roundIdx: idx + 1 }))
  )

  return (
    <div className={`${compact ? "" : "p-4"} space-y-4`}>
      {/* 挑战模式：回合进度 + 分数 */}
      {mode === "challenge" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold flex items-center gap-1">
              <Target className="w-4 h-4" />
              {language === "en" ? "Challenge Progress" : "도전 진행"}
            </span>
            <span className="text-muted-foreground text-xs">
              {challengeRound}/{totalRounds}
            </span>
          </div>
          {/* 进度条 */}
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(challengeRound / totalRounds) * 100}%`,
                backgroundColor: config.primaryColor,
              }}
            />
          </div>
          {/* 最近几轮分数 */}
          {challengeScores.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {challengeScores.slice(-5).map((rs, i) => (
                <div
                  key={i}
                  className="px-2 py-0.5 rounded text-xs font-mono"
                  style={{
                    backgroundColor: rs.score >= 8 ? "#dcfce7" : rs.score >= 6 ? "#fef9c3" : "#fee2e2",
                    color: rs.score >= 8 ? "#166534" : rs.score >= 6 ? "#854d0e" : "#991b1b",
                  }}
                  title={rs.comment}
                >
                  R{rs.round}: {rs.score}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!feedback ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {language === "en" ? "Waiting for your first response..." : "첫 응답을 기다리는 중..."}
        </div>
      ) : (
        <>
          {/* 统计 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-secondary">
              <div className="text-lg font-bold" style={{ color: config.primaryColor }}>{feedback.stats.accuracy}%</div>
              <div className="text-xs text-muted-foreground">{statsLabels.accuracy}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary">
              <div className="text-lg font-bold" style={{ color: config.primaryColor }}>
                {"⭐".repeat(feedback.stats.fluency)}
              </div>
              <div className="text-xs text-muted-foreground">{statsLabels.fluency}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary">
              <div className="text-lg font-bold" style={{ color: config.primaryColor }}>
                {feedback.stats.nervousness === "low" ? "🟢" : feedback.stats.nervousness === "medium" ? "🟡" : "🔴"}
              </div>
              <div className="text-xs text-muted-foreground">{statsLabels.nervousness}</div>
            </div>
          </div>

          {/* 错误（累积） */}
          {allErrors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <span>⚠️</span>
                {language === "en" ? "Needs Improvement" : "개선 필요"}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  ({allErrors.length})
                </span>
              </h4>
              <div className="space-y-2">
                {allErrors.map((err, i) => (
                  <div
                    key={`err-${err.roundIdx}-${i}`}
                    className={`p-2.5 rounded-lg text-xs ${
                      err.severity === "critical"
                        ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                        : "bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800"
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        err.severity === "critical"
                          ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                          : "bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200"
                      }`}>{err.type}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {language === "en" ? `Round ${err.roundIdx}` : `라운드 ${err.roundIdx}`}
                      </span>
                    </div>
                    <p className="line-through text-muted-foreground">{err.original}</p>
                    <p className="font-medium text-green-700 dark:text-green-400">→ {err.correction}</p>
                    {!compact && <p className="mt-1 text-muted-foreground">{err.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 词汇（累积，去重） */}
          {allVocab.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <span>💡</span>
                {language === "en" ? "New Vocabulary" : "새로운 어휘"}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  ({new Set(allVocab.map(v => v.word)).size})
                </span>
              </h4>
              <div className="space-y-2">
                {Array.from(new Map(allVocab.map(v => [v.word, v])).values()).map((vocab) => (
                  <div key={vocab.word} className="p-2.5 rounded-lg bg-secondary text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{vocab.word}</span>
                      <button
                        onClick={() => onToggleSave(vocab.word)}
                        className={`p-1 rounded transition-colors ${
                          savedWords.has(vocab.word) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-muted-foreground">{vocab.phonetic}</p>
                    <p className="text-muted-foreground">{vocab.meaning}</p>
                    {!compact && <p className="mt-1 italic text-muted-foreground/70">{vocab.example}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {allErrors.length === 0 && allVocab.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {language === "en" ? "Great job! No issues found." : "잘했어요! 문제가 발견되지 않았습니다."}
            </div>
          )}
        </>
      )}
    </div>
  )
}
