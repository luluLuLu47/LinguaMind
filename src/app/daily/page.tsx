"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import { useSpeechRecognition } from "@/lib/use-speech-recognition"
import {
  Mic,
  Send,
  Loader2,
  Trophy,
  Flame,
  Star,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Volume2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Sparkles,
} from "lucide-react"
import type { DailySentence } from "@/data/daily-sentences"
import type { PronunciationScore, SentenceScore } from "@/lib/dashscope"

// localStorage keys
const STORAGE_KEY = "linguamind_daily"
interface DailyRecord {
  date: string // YYYY-MM-DD
  sentenceId: string
  pronounceScore: number | null
  sentenceScore: number | null
}

function loadRecords(): DailyRecord[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

function saveRecord(record: DailyRecord) {
  const records = loadRecords()
  const existing = records.findIndex((r) => r.date === record.date)
  if (existing >= 0) {
    records[existing] = record
  } else {
    records.push(record)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function getStreak(records: DailyRecord[]): number {
  if (records.length === 0) return 0
  const sorted = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < sorted.length; i++) {
    const recordDate = new Date(sorted[i].date)
    recordDate.setHours(0, 0, 0, 0)
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)

    if (recordDate.getTime() === expectedDate.getTime()) {
      streak++
    } else if (i === 0 && recordDate.getTime() < expectedDate.getTime()) {
      // 今天还没打卡，从昨天开始算
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (recordDate.getTime() === yesterday.getTime()) {
        streak++
        continue
      }
      break
    } else {
      break
    }
  }
  return streak
}

export default function DailyPage() {
  const router = useRouter()
  const { config } = useLanguage()
  const lang = config.code as "en" | "ko"

  // 状态
  const [sentence, setSentence] = useState<DailySentence | null>(null)
  const [source, setSource] = useState<"ai" | "preset">("preset")
  const [loading, setLoading] = useState(true)

  // 跟读挑战
  const [userTranscript, setUserTranscript] = useState("")
  const [pronounceScore, setPronounceScore] = useState<PronunciationScore | null>(null)
  const [pronounceLoading, setPronounceLoading] = useState(false)
  const [showPronounceInput, setShowPronounceInput] = useState(false)

  // 造句练习
  const [userSentence, setUserSentence] = useState("")
  const [sentenceScore, setSentenceScore] = useState<SentenceScore | null>(null)
  const [sentenceLoading, setSentenceLoading] = useState(false)

  // 历史记录
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // 打卡天数 & 积分
  const [streak, setStreak] = useState(0)
  const [totalScore, setTotalScore] = useState(0)

  // 语音识别：浏览器原生 Web Speech API（免费、实时）
  const {
    isListening: isRecording,
    isSupported: isSpeechSupported,
    interimTranscript: speechInterim,
    error: speechError,
    startListening: startSpeech,
    stopListening: stopSpeech,
  } = useSpeechRecognition({
    lang: lang,
    onResult: (text) => {
      setUserTranscript((prev) => (prev ? prev + " " + text : text))
    },
  })

  // 加载今日句子
  const loadTodaySentence = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daily/sentence?lang=${lang}`)
      const data = await res.json()
      setSentence(data.sentence)
      setSource(data.source || "preset")
    } catch {
      // 兜底：取第一条预设
      const { englishSentences, koreanSentences } = await import("@/data/daily-sentences")
      setSentence(lang === "en" ? englishSentences[0] : koreanSentences[0])
      setSource("preset")
    } finally {
      setLoading(false)
    }
  }, [lang])

  // 初始化
  useEffect(() => {
    loadTodaySentence()
    const recs = loadRecords()
    setRecords(recs)
    setStreak(getStreak(recs))
    setTotalScore(
      recs.reduce((sum, r) => sum + (r.pronounceScore || 0) + (r.sentenceScore || 0), 0)
    )
  }, [loadTodaySentence])

  // 语言切换时重新加载
  useEffect(() => {
    loadTodaySentence()
  }, [lang, loadTodaySentence])

  // 录音：点击麦克风 → Web Speech API 实时识别
  const startRecording = () => {
    if (!isSpeechSupported) {
      setShowPronounceInput(true)
      return
    }
    setUserTranscript("")
    startSpeech()
  }

  const stopRecording = () => {
    stopSpeech()
  }

  // 发音评分
  const handlePronounceScore = async () => {
    if (!sentence || !userTranscript.trim()) return
    setPronounceLoading(true)
    try {
      const res = await fetch("/api/daily/pronounce-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sentence.text,
          userTranscript: userTranscript.trim(),
          lang,
        }),
      })
      const data = await res.json()
      setPronounceScore(data)

      // 保存记录
      const today = new Date().toISOString().split("T")[0]
      saveRecord({
        date: today,
        sentenceId: sentence.id,
        pronounceScore: data.overallScore,
        sentenceScore: sentenceScore?.score || null,
      })
      setRecords(loadRecords())
    } catch {
      // 降级
      setPronounceScore({
        overallScore: 75,
        accuracy: 75,
        fluency: 75,
        completeness: 75,
        wordScores: [],
        feedback: "评分服务暂时不可用。",
      })
    } finally {
      setPronounceLoading(false)
    }
  }

  // 造句评分
  const handleSentenceScore = async () => {
    if (!sentence || !userSentence.trim()) return
    setSentenceLoading(true)
    try {
      const res = await fetch("/api/daily/sentence-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: userSentence.trim(),
          targetExpression: sentence.text,
          lang,
        }),
      })
      const data = await res.json()
      setSentenceScore(data)

      const today = new Date().toISOString().split("T")[0]
      saveRecord({
        date: today,
        sentenceId: sentence.id,
        pronounceScore: pronounceScore?.overallScore || null,
        sentenceScore: data.score,
      })
      setRecords(loadRecords())
    } catch {
      setSentenceScore({
        score: 70,
        grammarCorrect: true,
        expressionUsed: true,
        naturalness: 70,
        feedback: "评分服务暂时不可用。",
      })
    } finally {
      setSentenceLoading(false)
    }
  }

  // 播放发音
  const playPronunciation = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play()
      audio.onended = () => URL.revokeObjectURL(url)
    } catch {
      // 降级：使用浏览器 TTS
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang === "en" ? "en-US" : "ko-KR"
      speechSynthesis.speak(utterance)
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-yellow-500"
    return "text-red-500"
  }

  const scoreBg = (score: number) => {
    if (score >= 80) return "bg-green-50 border-green-200"
    if (score >= 60) return "bg-yellow-50 border-yellow-200"
    return "bg-red-50 border-red-200"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: config.primaryColor }} />
      </div>
    )
  }

  if (!sentence) {
    return (
      <div className="text-center py-20 text-neutral-500">
        暂无今日句子，请稍后再试。
      </div>
    )
  }

  const todayRecord = records.find(
    (r) => r.date === new Date().toISOString().split("T")[0]
  )
  const isCompleted = todayRecord?.pronounceScore && todayRecord?.sentenceScore

  return (
    <div className="space-y-6 pb-24">
      {/* 头部：返回 & 打卡 & 积分 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            title={lang === "en" ? "Back" : "뒤로가기"}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Mic className="h-6 w-6" style={{ color: config.primaryColor }} />
          <h1 className="text-2xl font-bold">
            {lang === "en" ? "Daily Phrase" : "오늘의 표현"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* 连续打卡 */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: config.primaryColor + "15",
              color: config.primaryColor,
            }}
          >
            <Flame className="h-4 w-4" />
            <span>{streak} {lang === "en" ? "days" : "일"}</span>
          </div>
          {/* 总积分 */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: config.primaryColor + "15",
              color: config.primaryColor,
            }}
          >
            <Trophy className="h-4 w-4" />
            <span>{totalScore} pts</span>
          </div>
        </div>
      </div>

      {/* 今日句子卡片 */}
      <div
        className="rounded-2xl border-2 p-6 relative overflow-hidden"
        style={{ borderColor: config.primaryColor + "30" }}
      >
        {/* AI 生成标记 */}
        {source === "ai" && (
          <div className="absolute top-3 right-3 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
            <Sparkles className="h-3 w-3" />
            AI
          </div>
        )}

        {/* 主句 */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <p
              className="text-2xl md:text-3xl font-bold mb-2"
              style={{ color: config.primaryColor }}
            >
              {sentence.text}
            </p>
            <p className="text-sm text-neutral-500 mb-1">{sentence.phonetic}</p>
            <p className="text-base text-neutral-700">{sentence.translation}</p>
          </div>
          <button
            onClick={() => playPronunciation(sentence.text)}
            className="flex-shrink-0 p-3 rounded-full hover:bg-neutral-100 transition-colors"
            title={lang === "en" ? "Listen" : "듣기"}
          >
            <Volume2 className="h-5 w-5" style={{ color: config.primaryColor }} />
          </button>
        </div>

        {/* 例句 */}
        <div className="bg-neutral-50 rounded-xl p-4 mb-3">
          <p className="text-sm text-neutral-600 italic mb-1">{sentence.example}</p>
          <p className="text-xs text-neutral-400">{sentence.exampleTranslation}</p>
        </div>

        {/* 标签 & 难度 */}
        <div className="flex items-center gap-2 flex-wrap">
          {sentence.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600"
            >
              {tag}
            </span>
          ))}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: config.primaryColor + "15",
              color: config.primaryColor,
            }}
          >
            {lang === "en"
              ? ["", "Beginner", "Intermediate", "Advanced"][sentence.difficulty]
              : ["", "초급", "중급", "고급"][sentence.difficulty]}
          </span>
        </div>

        {/* 小贴士 */}
        <div className="mt-3 flex items-start gap-2 text-xs text-neutral-500">
          <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{sentence.tip}</span>
        </div>
      </div>

      {/* ===== 跟读挑战 ===== */}
      <div className="rounded-2xl border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mic className="h-5 w-5" style={{ color: config.primaryColor }} />
          {lang === "en" ? "Pronunciation Challenge" : "발음 챌린지"}
        </h2>

        {!userTranscript && !pronounceScore ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500">
              {lang === "en"
                ? "Read the sentence above aloud and record yourself."
                : "위 문장을 소리 내어 읽고 녹음해보세요."}
            </p>

            <div className="flex gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!isSpeechSupported}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-white"
                }`}
                style={isRecording ? {} : { backgroundColor: config.primaryColor }}
                title={!isSpeechSupported ? "请用 Chrome/Edge 浏览器" : ""}
              >
                <Mic className="h-4 w-4" />
                {isRecording
                  ? lang === "en"
                    ? "Listening... Click to stop"
                    : "인식 중... 중지"
                  : lang === "en"
                    ? "Start Speaking"
                    : "말하기 시작"}
              </button>
              <button
                onClick={() => setShowPronounceInput(true)}
                className="px-4 py-3 rounded-xl border text-sm text-neutral-600 hover:bg-neutral-50"
              >
                {lang === "en" ? "Type instead" : "직접 입력"}
              </button>
            </div>

            {/* 实时识别文字显示 */}
            {(isRecording || userTranscript || speechInterim) && (
              <div className="p-3 rounded-xl bg-neutral-50 border text-sm">
                <span className="text-neutral-800">{userTranscript}</span>
                <span className="text-neutral-400">{speechInterim}</span>
                {isRecording && !userTranscript && !speechInterim && (
                  <span className="text-neutral-400">
                    {lang === "en" ? "Listening..." : "듣고 있습니다..."}
                  </span>
                )}
              </div>
            )}
            {speechError && (
              <p className="text-sm text-red-500">{speechError}</p>
            )}

            {showPronounceInput && (
              <div className="space-y-2">
                <textarea
                  value={userTranscript}
                  onChange={(e) => setUserTranscript(e.target.value)}
                  placeholder={
                    lang === "en"
                      ? "Type what you read..."
                      : "읽은 내용을 입력하세요..."
                  }
                  className="w-full p-3 rounded-xl border text-sm min-h-[80px] focus:outline-none focus:ring-2"
                  style={{ "--tw-ring-color": config.primaryColor } as React.CSSProperties}
                />
              </div>
            )}
          </div>
        ) : pronounceScore ? (
          /* 评分结果 */
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className="text-4xl font-bold"
                style={{ color: config.primaryColor }}
              >
                {pronounceScore.overallScore}
              </div>
              <div className="text-sm text-neutral-500">
                <div className="flex items-center gap-2">
                  {lang === "en" ? "Accuracy" : "정확도"}:{" "}
                  <span className="font-medium">{pronounceScore.accuracy}</span>
                </div>
                <div className="flex items-center gap-2">
                  {lang === "en" ? "Fluency" : "유창성"}:{" "}
                  <span className="font-medium">{pronounceScore.fluency}</span>
                </div>
                <div className="flex items-center gap-2">
                  {lang === "en" ? "Completeness" : "완성도"}:{" "}
                  <span className="font-medium">{pronounceScore.completeness}</span>
                </div>
              </div>
            </div>

            {/* 单词级评分 */}
            {pronounceScore.wordScores.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pronounceScore.wordScores.map((ws, i) => (
                  <span
                    key={i}
                    className={`text-sm px-2 py-1 rounded-lg border ${
                      ws.level === "green"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : ws.level === "yellow"
                          ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                          : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {ws.word} {ws.score}
                  </span>
                ))}
              </div>
            )}

            <p className="text-sm text-neutral-600 bg-blue-50 rounded-xl p-3">
              {pronounceScore.feedback}
            </p>

            <button
              onClick={() => {
                setUserTranscript("")
                setPronounceScore(null)
                setShowPronounceInput(false)
              }}
              className="text-sm underline"
              style={{ color: config.primaryColor }}
            >
              {lang === "en" ? "Try again" : "다시 도전"}
            </button>
          </div>
        ) : (
          /* 录音完成，等待评分 */
          <div className="space-y-4">
            <div className="bg-neutral-50 rounded-xl p-4">
              <p className="text-xs text-neutral-400 mb-1">
                {lang === "en" ? "Your transcript:" : "인식된 텍스트:"}
              </p>
              <p className="text-sm font-medium">{userTranscript}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePronounceScore}
                disabled={pronounceLoading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: config.primaryColor }}
              >
                {pronounceLoading ? (
                  <Loader2 key="loading" className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 key="icon" className="h-4 w-4" />
                )}
                {lang === "en" ? "Score My Pronunciation" : "발음 평가하기"}
              </button>
              <button
                onClick={() => {
                  setUserTranscript("")
                  setShowPronounceInput(false)
                }}
                className="px-4 py-3 rounded-xl border text-sm text-neutral-600 hover:bg-neutral-50"
              >
                {lang === "en" ? "Re-record" : "다시 녹음"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== 造句练习 ===== */}
      <div className="rounded-2xl border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Star className="h-5 w-5" style={{ color: config.primaryColor }} />
          {lang === "en" ? "Make a Sentence" : "문장 만들기"}
        </h2>

        {!sentenceScore ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500">
              {lang === "en"
                ? `Use "${sentence.text}" in your own sentence.`
                : `"${sentence.text}"를 사용해서 문장을 만들어보세요.`}
            </p>
            <textarea
              value={userSentence}
              onChange={(e) => setUserSentence(e.target.value)}
              placeholder={
                lang === "en"
                  ? "Write your sentence here..."
                  : "여기에 문장을 작성하세요..."
              }
              className="w-full p-3 rounded-xl border text-sm min-h-[80px] focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": config.primaryColor } as React.CSSProperties}
            />
            <button
              onClick={handleSentenceScore}
              disabled={sentenceLoading || !userSentence.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: config.primaryColor }}
            >
              {sentenceLoading ? (
                <Loader2 key="loading" className="h-4 w-4 animate-spin" />
              ) : (
                <Send key="icon" className="h-4 w-4" />
              )}
              {lang === "en" ? "Check My Sentence" : "문장 확인하기"}
            </button>
          </div>
        ) : (
          /* 造句评分结果 */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="text-3xl font-bold"
                style={{ color: config.primaryColor }}
              >
                {sentenceScore.score}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  {sentenceScore.grammarCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  {lang === "en" ? "Grammar" : "문법"}:{" "}
                  {sentenceScore.grammarCorrect
                    ? lang === "en"
                      ? "Correct"
                      : "정확함"
                    : lang === "en"
                      ? "Needs work"
                      : "수정 필요"}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {sentenceScore.expressionUsed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  {lang === "en" ? "Expression used" : "표현 사용"}:{" "}
                  {sentenceScore.expressionUsed
                    ? lang === "en"
                      ? "Yes"
                      : "사용함"
                    : lang === "en"
                      ? "No"
                      : "사용 안 함"}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>{lang === "en" ? "Naturalness" : "자연스러움"}:</span>
                  <span className={scoreColor(sentenceScore.naturalness)}>
                    {sentenceScore.naturalness}
                  </span>
                </div>
              </div>
            </div>

            {sentenceScore.correctedSentence && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
                <p className="text-yellow-700 font-medium mb-1">
                  {lang === "en" ? "Suggested correction:" : "수정 제안:"}
                </p>
                <p className="text-yellow-800">{sentenceScore.correctedSentence}</p>
              </div>
            )}

            <p className="text-sm text-neutral-600 bg-blue-50 rounded-xl p-3">
              {sentenceScore.feedback}
            </p>

            <button
              onClick={() => {
                setUserSentence("")
                setSentenceScore(null)
              }}
              className="text-sm underline"
              style={{ color: config.primaryColor }}
            >
              {lang === "en" ? "Try another sentence" : "다른 문장 만들기"}
            </button>
          </div>
        )}
      </div>

      {/* ===== 历史记录 ===== */}
      <div className="rounded-2xl border overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
        >
          <span className="font-semibold">
            {lang === "en" ? "Recent History" : "최근 기록"}
          </span>
          {showHistory ? (
            <ChevronUp className="h-5 w-5 text-neutral-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-neutral-400" />
          )}
        </button>

        {showHistory && (
          <div className="px-4 pb-4 space-y-2">
            {records.length === 0 ? (
              <p className="text-sm text-neutral-400 py-4 text-center">
                {lang === "en" ? "No records yet. Start practicing!" : "아직 기록이 없어요. 시작해보세요!"}
              </p>
            ) : (
              [...records]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                .slice(0, 7)
                .map((record) => (
                  <div
                    key={record.date}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-50"
                  >
                    <span className="text-sm font-medium">{record.date}</span>
                    <div className="flex items-center gap-3">
                      {record.pronounceScore !== null && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${scoreColor(record.pronounceScore)}`}
                        >
                          🎤 {record.pronounceScore}
                        </span>
                      )}
                      {record.sentenceScore !== null && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${scoreColor(record.sentenceScore)}`}
                        >
                          ✏️ {record.sentenceScore}
                        </span>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {/* 完成提示 */}
      {isCompleted && (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: config.primaryColor + "10" }}
        >
          <Trophy
            className="h-10 w-10 mx-auto mb-2"
            style={{ color: config.primaryColor }}
          />
          <p className="text-lg font-semibold" style={{ color: config.primaryColor }}>
            {lang === "en" ? "Challenge Complete! 🎉" : "챌린지 완료! 🎉"}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {lang === "en"
              ? "Great job! Come back tomorrow for a new phrase."
              : "잘했어요! 내일 새로운 표현으로 돌아오세요."}
          </p>
        </div>
      )}
    </div>
  )
}
