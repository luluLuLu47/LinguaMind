"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import { ChevronLeft, BookOpen, Volume2, CheckCircle, XCircle, Sparkles, Trophy, RotateCcw, Plus, Target, PenTool, Download, FileSpreadsheet, FileJson, Loader2 } from "lucide-react"
import { getRandomWords, getWordsByLevel, unifiedVocab, getVocabStats, type VocabWord } from "@/data/unified-vocab"
import { englishPhonetics, type PhoneticItem } from "@/data/english-phonetics"
import { koreanLetters, type KoreanLetterItem } from "@/data/korean-letters"

type Mode = "menu" | "spelling" | "recognition" | "library" | "phonetic"
type Level = "cet4" | "cet6" | "kaoyan" | "all"

// ── 学习进度持久化 ──

interface WordProgress {
  word: string
  studied: number      // 学习次数
  correct: number       // 正确次数
  wrong: number         // 错误次数
  lastStudyDate: string // YYYY-MM-DD
  mastery: number       // 0-5 mastery level (0=new, 5=mastered)
}

const PROGRESS_KEY = "linguamind_word_progress"
const BATCH_KEY = "linguamind_word_batch"

function loadProgress(): Record<string, WordProgress> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}")
  } catch { return {} }
}

function saveProgress(progress: Record<string, WordProgress>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// 获取待复习的单词（艾宾浩斯简化版：错3个复习，掌握5级为已掌握）
function getReviewWords(progress: Record<string, WordProgress>): string[] {
  const today = getTodayStr()
  return Object.values(progress)
    .filter(p => p.mastery > 0 && p.mastery < 5 && p.lastStudyDate !== today)
    .map(p => p.word)
}

// 获取未学过的新单词
function getNewWords(progress: Record<string, WordProgress>, level: Level): string[] {
  const pool = level === "all" ? unifiedVocab : unifiedVocab.filter(w => w.level === level)
  return pool.filter(w => !progress[w.word] || progress[w.word].mastery === 0).map(w => w.word)
}

// 从词库中查找单词详情
function findWord(word: string): VocabWord | undefined {
  return unifiedVocab.find(w => w.word === word)
}

// 更新单词学习进度
function updateProgress(
  progress: Record<string, WordProgress>,
  word: string,
  correct: boolean
): Record<string, WordProgress> {
  const existing = progress[word] || {
    word, studied: 0, correct: 0, wrong: 0, lastStudyDate: "", mastery: 0,
  }
  const updated: WordProgress = {
    ...existing,
    studied: existing.studied + 1,
    correct: correct ? existing.correct + 1 : existing.correct,
    wrong: correct ? existing.wrong : existing.wrong + 1,
    lastStudyDate: getTodayStr(),
  }
  // mastery 规则：连续正确3次升一级，连续错误2次降一级（最低0）
  if (correct && updated.correct >= existing.correct + 1) {
    updated.mastery = Math.min(5, existing.mastery + (updated.correct % 3 === 0 ? 1 : 0))
  }
  if (!correct && updated.wrong >= existing.wrong + 1 && updated.wrong % 2 === 0) {
    updated.mastery = Math.max(0, existing.mastery - 1)
  }
  return { ...progress, [word]: updated }
}

// ── 批次管理 ──

interface BatchInfo {
  words: string[]
  mode: Mode
  level: Level
  date: string
}

function loadBatch(): BatchInfo | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(BATCH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveBatch(batch: BatchInfo) {
  localStorage.setItem(BATCH_KEY, JSON.stringify(batch))
}

function clearBatch() {
  localStorage.removeItem(BATCH_KEY)
}

// 生成学习批次：新词 + 复习词
function generateBatch(level: Level, progress: Record<string, WordProgress>, size = 10): BatchInfo {
  const newWords = getNewWords(progress, level)
  const reviewWords = getReviewWords(progress)

  // 复习词占 30%（至少3个），新词占 70%
  const reviewCount = Math.min(Math.max(3, Math.floor(size * 0.3)), reviewWords.length)
  const newCount = size - reviewCount

  const selectedReview = reviewWords.sort(() => Math.random() - 0.5).slice(0, reviewCount)
  const selectedNew = newWords.sort(() => Math.random() - 0.5).slice(0, newCount)

  // 如果新词不够，用复习词补足
  const result = [...selectedNew]
  const remaining = newCount - selectedNew.length
  if (remaining > 0) {
    const extra = reviewWords
      .filter(w => !selectedReview.includes(w))
      .sort(() => Math.random() - 0.5)
      .slice(0, remaining)
    result.push(...extra)
  }
  result.push(...selectedReview)

  // 去重
  const unique = Array.from(new Set(result))
  return {
    words: unique.slice(0, size),
    mode: "spelling",
    level,
    date: getTodayStr(),
  }
}

// ── 主页面 ──

export default function WordsPage() {
  const router = useRouter()
  const { config } = useLanguage()
  const [mode, setMode] = useState<Mode>("menu")
  const [level, setLevel] = useState<Level>("cet4")
  const [savedWords, setSavedWords] = useState<Array<{word: string; meaning: string; phonetic: string | null; saved_at: string; review_count: number; last_reviewed: string | null}>>([])
  const [progress, setProgress] = useState<Record<string, WordProgress>>({})

  useEffect(() => {
    setProgress(loadProgress())
    fetchSavedWords()
  }, [])

  async function fetchSavedWords() {
    try {
      const res = await fetch("/api/vocabulary/list?lang=en")
      const data = await res.json()
      setSavedWords(data.words || [])
    } catch { /* ignore */ }
  }

  function handleExitToMenu() {
    setMode("menu")
    // 返回菜单时刷新进度显示
    setProgress(loadProgress())
    fetchSavedWords()
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <BookOpen className="h-6 w-6" style={{ color: config.primaryColor }} />
        <h1 className="text-2xl font-bold">Word Learning</h1>
      </div>

      {mode === "menu" && (
        <MenuView
          level={level}
          setLevel={setLevel}
          progress={progress}
          onStartSpelling={() => setMode("spelling")}
          onStartRecognition={() => setMode("recognition")}
          onStartPhonetic={() => setMode("phonetic")}
          onViewLibrary={() => setMode("library")}
          savedCount={savedWords.length}
          primaryColor={config.primaryColor}
        />
      )}

      {mode === "spelling" && (
        <SpellingTest
          level={level}
          primaryColor={config.primaryColor}
          onExit={handleExitToMenu}
          progress={progress}
          setProgress={setProgress}
        />
      )}

      {mode === "recognition" && (
        <RecognitionTest
          level={level}
          primaryColor={config.primaryColor}
          onExit={handleExitToMenu}
          progress={progress}
          setProgress={setProgress}
        />
      )}

      {mode === "phonetic" && (
        <PhoneticLearning
          primaryColor={config.primaryColor}
          onExit={handleExitToMenu}
        />
      )}

      {mode === "library" && (
        <LibraryView
          words={savedWords}
          primaryColor={config.primaryColor}
          onExit={handleExitToMenu}
          onRefresh={fetchSavedWords}
        />
      )}
    </div>
  )
}

// ── Menu ───────────────────────────────────────────────────────

function MenuView({
  level,
  setLevel,
  progress,
  onStartSpelling,
  onStartRecognition,
  onStartPhonetic,
  onViewLibrary,
  savedCount,
  primaryColor,
}: {
  level: Level
  setLevel: (l: Level) => void
  progress: Record<string, WordProgress>
  onStartSpelling: () => void
  onStartRecognition: () => void
  onStartPhonetic: () => void
  onViewLibrary: () => void
  savedCount: number
  primaryColor: string
}) {
  const totalStudied = Object.keys(progress).length
  const mastered = Object.values(progress).filter(p => p.mastery >= 5).length
  const needReview = getReviewWords(progress).length
  const newAvailable = getNewWords(progress, level).length
  const stats = getVocabStats()

  return (
    <div className="space-y-6">
      {/* 难度选择 */}
      <div className="flex gap-2">
        {(["cet4", "cet6", "kaoyan", "all"] as Level[]).map(l => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              level === l ? "text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
            style={level === l ? { backgroundColor: primaryColor } : {}}
          >
            {l === "cet4" ? "CET-4" : l === "cet6" ? "CET-6" : l === "kaoyan" ? "考研" : "All"}
          </button>
        ))}
      </div>

      {/* 学习统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-neutral-50 text-center">
          <div className="text-xl font-bold" style={{ color: primaryColor }}>{totalStudied}</div>
          <div className="text-xs text-neutral-500">Studied</div>
        </div>
        <div className="p-3 rounded-xl bg-neutral-50 text-center">
          <div className="text-xl font-bold text-green-600">{mastered}</div>
          <div className="text-xs text-neutral-500">Mastered</div>
        </div>
        <div className="p-3 rounded-xl bg-neutral-50 text-center">
          <div className="text-xl font-bold text-orange-500">{needReview}</div>
          <div className="text-xs text-neutral-500">To Review</div>
        </div>
      </div>

      {/* 词库统计 */}
      <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50">
        <div className="text-xs font-medium text-neutral-500 mb-2">词库统计 · Vocabulary</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-sm font-bold" style={{ color: primaryColor }}>{stats.cet4}</div>
            <div className="text-[10px] text-neutral-500">CET-4</div>
          </div>
          <div>
            <div className="text-sm font-bold text-violet-600">{stats.cet6}</div>
            <div className="text-[10px] text-neutral-500">CET-6</div>
          </div>
          <div>
            <div className="text-sm font-bold text-rose-600">{stats.kaoyan}</div>
            <div className="text-[10px] text-neutral-500">考研</div>
          </div>
          <div>
            <div className="text-sm font-bold text-neutral-700">{stats.total}</div>
            <div className="text-[10px] text-neutral-500">总计</div>
          </div>
        </div>
      </div>

      {/* 学习入口 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FeatureCard
          icon="🔊"
          title="Phonetic Learning"
          desc="Learn IPA syllables & pronunciation"
          onClick={onStartPhonetic}
          color={primaryColor}
        />
        <FeatureCard
          icon="✍️"
          title="Spelling Test"
          desc={`${newAvailable} new words available`}
          onClick={onStartSpelling}
          color={primaryColor}
        />
        <FeatureCard
          icon="🎯"
          title="Word Recognition"
          desc="Choose the correct meaning"
          onClick={onStartRecognition}
          color={primaryColor}
        />
        <FeatureCard
          icon="📚"
          title={`My Word Book (${savedCount})`}
          desc="Words saved from dialogues"
          onClick={onViewLibrary}
          color={primaryColor}
        />
      </div>
    </div>
  )
}

function FeatureCard({
  icon, title, desc, onClick, color,
}: {
  icon: string; title: string; desc: string; onClick: () => void; color: string
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-5 rounded-2xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-neutral-500 mt-1">{desc}</p>
    </button>
  )
}

// ── Spelling Test ──────────────────────────────────────────────

function SpellingTest({
  level,
  primaryColor,
  onExit,
  progress,
  setProgress,
}: {
  level: Level
  primaryColor: string
  onExit: () => void
  progress: Record<string, WordProgress>
  setProgress: (p: Record<string, WordProgress>) => void
}) {
  const [batch, setBatch] = useState<BatchInfo | null>(() => {
    const existing = loadBatch()
    if (existing && existing.mode === "spelling" && existing.level === level) {
      // 检查批次是否还在同一天
      if (existing.date === getTodayStr()) return existing
    }
    return null
  })

  const [index, setIndex] = useState(0)
  const [input, setInput] = useState("")
  const [result, setResult] = useState<"correct" | "wrong" | null>(null)
  const [score, setScore] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [finished, setFinished] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 初始化批次
  useEffect(() => {
    if (!batch) {
      const newBatch = generateBatch(level, progress)
      setBatch(newBatch)
      saveBatch(newBatch)
    }
  }, [batch, level, progress])

  const words = batch?.words.map(findWord).filter(Boolean) as VocabWord[] || []
  const current = words[index]

  const speakWord = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = "en-US"
    utter.rate = 0.8
    window.speechSynthesis.speak(utter)
  }, [])

  useEffect(() => {
    if (current) speakWord(current.word)
  }, [index, current, speakWord])

  useEffect(() => {
    if (!showAnswer && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showAnswer, index])

  function check() {
    if (!input.trim() || !current) return
    const correct = input.trim().toLowerCase() === current.word.toLowerCase()
    setResult(correct ? "correct" : "wrong")
    if (correct) setScore(s => s + 1)
    setShowAnswer(true)
    const updated = updateProgress(progress, current.word, correct)
    setProgress(updated)
    saveProgress(updated)
  }

  function next() {
    if (index + 1 >= words.length) {
      setFinished(true)
      clearBatch()
    } else {
      setIndex(i => i + 1)
      setInput("")
      setResult(null)
      setShowAnswer(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (showAnswer) {
        next()
      } else {
        check()
      }
    }
  }

  function tryAgain() {
    // 用同一批次重试
    setIndex(0)
    setScore(0)
    setFinished(false)
    setInput("")
    setResult(null)
    setShowAnswer(false)
  }

  function newBatch() {
    clearBatch()
    const newB = generateBatch(level, progress)
    setBatch(newB)
    saveBatch(newB)
    setIndex(0)
    setScore(0)
    setFinished(false)
    setInput("")
    setResult(null)
    setShowAnswer(false)
  }

  if (finished) {
    const pct = words.length > 0 ? Math.round((score / words.length) * 100) : 0
    return (
      <div className="text-center space-y-6 py-8">
        <div className="text-6xl">
          {pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "💪"}
        </div>
        <div>
          <h2 className="text-3xl font-bold" style={{ color: primaryColor }}>
            {score}/{words.length}
          </h2>
          <p className="text-neutral-500 mt-1">{pct}% Accuracy</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={tryAgain}
            className="px-6 py-2.5 rounded-xl text-white font-medium flex items-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
          <button
            onClick={newBatch}
            className="px-6 py-2.5 rounded-xl font-medium bg-neutral-100 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Words
          </button>
          <button onClick={onExit} className="px-6 py-2.5 rounded-xl font-medium bg-neutral-100">
            Back
          </button>
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="text-center py-8 text-neutral-500">Loading...</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 进度 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-500">Progress: {index + 1}/{words.length}</span>
        <span className="font-semibold" style={{ color: primaryColor }}>Score: {score}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / words.length) * 100}%`, backgroundColor: primaryColor }}
        />
      </div>

      {/* 拼写卡片 */}
      <div className="p-6 rounded-2xl border-2 space-y-6 text-center" style={{ borderColor: `${primaryColor}30` }}>
        <div>
          <p className="text-sm text-neutral-500 mb-3">Listen and spell the word</p>
          <button
            onClick={() => speakWord(current.word)}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-transform hover:scale-105"
            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
          >
            <Volume2 className="h-10 w-10" />
          </button>
          <p className="text-xs text-neutral-400 mt-2">{current.phonetic}</p>
          <p className="text-sm text-neutral-500 mt-1">{current.meaning}</p>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type the word..."
          className={`w-full px-4 py-3 text-lg text-center rounded-xl border-2 outline-none transition-all ${
            result === "correct" ? "border-green-500 bg-green-50" :
            result === "wrong" ? "border-red-500 bg-red-50" :
            "border-neutral-200 focus:border-neutral-400"
          }`}
          disabled={showAnswer}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {showAnswer && (
          <div className="text-sm">
            {result === "correct" ? (
              <p className="flex items-center justify-center gap-1 text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" /> Correct!
              </p>
            ) : (
              <p className="flex items-center justify-center gap-1 text-red-600 font-medium">
                <XCircle className="w-4 h-4" /> The correct word is: <strong>{current.word}</strong>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {!showAnswer ? (
            <button
              onClick={check}
              disabled={!input.trim()}
              className="px-6 py-2.5 rounded-xl text-white font-medium transition-opacity disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}
            >
              Check
            </button>
          ) : (
            <button
              onClick={next}
              className="px-6 py-2.5 rounded-xl text-white font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              {index + 1 >= words.length ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Recognition Test ────────────────────────────────────────────

function RecognitionTest({
  level,
  primaryColor,
  onExit,
  progress,
  setProgress,
}: {
  level: Level
  primaryColor: string
  onExit: () => void
  progress: Record<string, WordProgress>
  setProgress: (p: Record<string, WordProgress>) => void
}) {
  const [batch, setBatch] = useState<BatchInfo | null>(() => {
    const existing = loadBatch()
    if (existing && existing.mode === "recognition" && existing.level === level) {
      if (existing.date === getTodayStr()) return existing
    }
    return null
  })

  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!batch) {
      const newBatch = generateBatch(level, progress)
      newBatch.mode = "recognition"
      setBatch(newBatch)
      saveBatch(newBatch)
    }
  }, [batch, level, progress])

  const words = batch?.words.map(findWord).filter(Boolean) as VocabWord[] || []
  const current = words[index]

  // Options are generated once per word (not re-shuffled on re-render)
  const options = useMemo(() => {
    if (!current) return []
    const distractors = unifiedVocab.filter(w => w.word !== current.word)
    const pool = distractors.length >= 3
      ? distractors.sort(() => Math.random() - 0.5).slice(0, 3)
      : getRandomWords(level, 3).filter(w => w.word !== current.word)
    const all = [current, ...pool]
    return all.sort(() => Math.random() - 0.5)
  }, [current, level])

  function choose(meaning: string) {
    if (selected || !current) return
    setSelected(meaning)
    const correct = meaning === current.meaning
    if (correct) setScore(s => s + 1)
    const updated = updateProgress(progress, current.word, correct)
    setProgress(updated)
    saveProgress(updated)
  }

  function next() {
    if (index + 1 >= words.length) {
      setFinished(true)
      clearBatch()
    } else {
      setIndex(i => i + 1)
      setSelected(null)
    }
  }

  function tryAgain() {
    setIndex(0); setScore(0); setFinished(false); setSelected(null)
  }

  function newBatch() {
    clearBatch()
    const newB = generateBatch(level, progress)
    newB.mode = "recognition"
    setBatch(newB)
    saveBatch(newB)
    setIndex(0); setScore(0); setFinished(false); setSelected(null)
  }

  if (finished) {
    const pct = words.length > 0 ? Math.round((score / words.length) * 100) : 0
    return (
      <div className="text-center space-y-6 py-8">
        <div className="text-6xl">{pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "💪"}</div>
        <div>
          <h2 className="text-3xl font-bold" style={{ color: primaryColor }}>
            {score}/{words.length}
          </h2>
          <p className="text-neutral-500 mt-1">{pct}% Accuracy</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={tryAgain}
            className="px-6 py-2.5 rounded-xl text-white font-medium flex items-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
          <button
            onClick={newBatch}
            className="px-6 py-2.5 rounded-xl font-medium bg-neutral-100 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Words
          </button>
          <button onClick={onExit} className="px-6 py-2.5 rounded-xl font-medium bg-neutral-100">
            Back
          </button>
        </div>
      </div>
    )
  }

  if (!current) {
    return <div className="text-center py-8 text-neutral-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-500">Progress: {index + 1}/{words.length}</span>
        <span className="font-semibold" style={{ color: primaryColor }}>Score: {score}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / words.length) * 100}%`, backgroundColor: primaryColor }}
        />
      </div>

      <div className="p-6 rounded-2xl border-2 space-y-6 text-center" style={{ borderColor: `${primaryColor}30` }}>
        <div>
          <p className="text-sm text-neutral-500 mb-2">What does this word mean?</p>
          <h2 className="text-3xl font-bold">{current.word}</h2>
          <p className="text-sm text-neutral-400 mt-1">{current.phonetic}</p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {options.map(opt => {
            const isCorrect = opt.meaning === current.meaning
            const isSelected = selected === opt.meaning
            let cls = "p-3 rounded-xl text-sm text-left border-2 transition-all"
            if (selected) {
              if (isCorrect) cls += " border-green-500 bg-green-50 text-green-700"
              else if (isSelected) cls += " border-red-500 bg-red-50 text-red-700"
              else cls += " border-neutral-200 opacity-50"
            } else {
              cls += " border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
            }
            return (
              <button
                key={opt.meaning}
                onClick={() => choose(opt.meaning)}
                disabled={!!selected}
                className={cls}
              >
                {opt.meaning}
              </button>
            )
          })}
        </div>

        {selected && (
          <button
            onClick={next}
            className="w-full py-2.5 rounded-xl text-white font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            {index + 1 >= words.length ? "Finish" : "Next"}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Library View ────────────────────────────────────────────────

interface SavedWord {
  word: string
  meaning: string
  phonetic: string | null
  saved_at: string
  review_count: number
  last_reviewed: string | null
}

function LibraryView({
  words,
  primaryColor,
  onExit,
  onRefresh,
}: {
  words: SavedWord[]
  primaryColor: string
  onExit: () => void
  onRefresh: () => void
}) {
  const [query, setQuery] = useState("")
  const [exporting, setExporting] = useState<string | null>(null)
  const speakWord = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = "en-US"
    utter.rate = 0.8
    window.speechSynthesis.speak(utter)
  }, [])

  const exportVocab = useCallback(async (format: "csv" | "json") => {
    setExporting(format)
    try {
      const res = await fetch(`/api/export/vocabulary?lang=en&format=${format}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const disp = res.headers.get("Content-Disposition") || ""
      const match = disp.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : `linguamind_vocab.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      console.error("[Export vocab] error:", err)
      alert("Export failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExporting(null)
    }
  }, [])

  const filtered = query
    ? words.filter(w =>
        w.word.toLowerCase().includes(query.toLowerCase()) ||
        w.meaning.includes(query)
      )
    : words

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">My Word Book ({words.length})</h2>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="text-sm text-neutral-500 hover:text-neutral-700">
            Refresh
          </button>
          {words.length > 0 && (
            <>
              <button
                onClick={() => exportVocab("csv")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 text-neutral-700 hover:border-amber-400 hover:text-amber-700 transition-colors disabled:opacity-50"
                title="Export CSV for Anki / Excel"
              >
                {exporting === "csv" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                CSV
              </button>
              <button
                onClick={() => exportVocab("json")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 text-neutral-700 hover:border-violet-400 hover:text-violet-700 transition-colors disabled:opacity-50"
                title="Export JSON backup"
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileJson className="h-3.5 w-3.5" />
                )}
                JSON
              </button>
            </>
          )}
        </div>
      </div>

      {words.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <Download className="h-3 w-3" />
          CSV 列顺序：word, language, meaning, phonetic, scene_id, saved_at, review_count, last_reviewed — 可直接导入 Anki
        </div>
      )}

      {/* Search */}
      {words.length > 0 && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search words..."
          className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 focus:border-neutral-400 outline-none text-sm transition-all"
        />
      )}

      {words.length === 0 ? (
        <div className="p-8 text-center text-neutral-400">
          <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No saved words yet</p>
          <p className="text-xs mt-1">Save words from dialogue sessions to build your vocabulary.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-neutral-400 text-sm">
          No words match "{query}"
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w, i) => (
            <div key={i} className="p-3 rounded-xl bg-neutral-50 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{w.word}</span>
                  {w.phonetic && (
                    <span className="text-xs text-neutral-400">{w.phonetic}</span>
                  )}
                  {w.review_count > 0 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                    >
                      ×{w.review_count}
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-600 mt-0.5 truncate">{w.meaning}</p>
              </div>
              <button
                onClick={() => speakWord(w.word)}
                className="p-2 rounded-lg hover:bg-neutral-200 transition-colors flex-shrink-0"
                style={{ color: primaryColor }}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Phonetic Learning ───────────────────────────────────────────

function PhoneticLearning({
  primaryColor,
  onExit,
}: {
  primaryColor: string
  onExit: () => void
}) {
  const [tab, setTab] = useState<"english" | "korean">("english")
  const [slow, setSlow] = useState(false)

  const speak = useCallback((text: string, lang: "en-US" | "ko-KR") => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = slow ? 0.55 : 0.8
    window.speechSynthesis.speak(utter)
  }, [slow])

  const englishGroups = useMemo(() => {
    const order = ["前元音", "中元音", "后元音", "合口双元音", "集中双元音", "爆破音", "摩擦音", "破擦音", "鼻音", "边音", "半元音"]
    return order
      .map(cat => ({ category: cat, items: englishPhonetics.filter(p => p.category === cat) }))
      .filter(g => g.items.length > 0)
  }, [])

  const koreanGroups = useMemo(() => {
    const order = ["基本辅音", "紧音", "基本元音", "复合元音"]
    return order
      .map(cat => ({ category: cat, items: koreanLetters.filter(l => l.category === cat) }))
      .filter(g => g.items.length > 0)
  }, [])

  return (
    <div className="space-y-6">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-xl text-sm bg-neutral-100 hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-sm text-neutral-500 font-medium">Phonetic Learning</span>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("english")}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === "english" ? "text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
          style={tab === "english" ? { backgroundColor: primaryColor } : {}}
        >
          English Phonics ({englishPhonetics.length})
        </button>
        <button
          onClick={() => setTab("korean")}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === "korean" ? "text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
          style={tab === "korean" ? { backgroundColor: primaryColor } : {}}
        >
          Korean Letters ({koreanLetters.length})
        </button>
      </div>

      {/* 慢速模式 */}
      <label className="flex items-center gap-2 text-sm text-neutral-500 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={slow}
          onChange={(e) => setSlow(e.target.checked)}
          style={{ accentColor: primaryColor }}
        />
        Slow mode (0.55x) - 慢速跟读
      </label>

      {/* 英语音标 */}
      {tab === "english" && (
        <div className="space-y-6">
          {englishGroups.map(group => (
            <section key={group.category}>
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <span className="inline-block w-1 h-4 rounded-full" style={{ backgroundColor: primaryColor }} />
                {group.category}
                <span className="text-xs text-neutral-400 font-normal">({group.items.length})</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {group.items.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => speak(item.example, "en-US")}
                    className="text-left p-3 rounded-2xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5 group"
                    style={{ borderColor: `${primaryColor}20`, backgroundColor: `${primaryColor}04` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl font-mono font-bold" style={{ color: primaryColor }}>
                        {item.symbol}
                      </span>
                      <Volume2 className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                    </div>
                    <div className="text-sm font-medium text-neutral-700">{item.example}</div>
                    <div className="text-xs font-mono text-neutral-400">{item.examplePhonetic}</div>
                    <div className="text-[11px] text-neutral-500 mt-1 leading-tight">{item.description}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 韩语字母 */}
      {tab === "korean" && (
        <div className="space-y-6">
          {koreanGroups.map(group => (
            <section key={group.category}>
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <span className="inline-block w-1 h-4 rounded-full" style={{ backgroundColor: primaryColor }} />
                {group.category}
                <span className="text-xs text-neutral-400 font-normal">({group.items.length})</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {group.items.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => speak(item.example, "ko-KR")}
                    className="text-left p-3 rounded-2xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5 group"
                    style={{ borderColor: `${primaryColor}20`, backgroundColor: `${primaryColor}04` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                        {item.symbol}
                      </span>
                      <Volume2 className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                    </div>
                    <div className="text-xs font-mono text-neutral-500">/{item.romanization}/</div>
                    <div className="text-sm font-medium text-neutral-700 mt-1">{item.example}</div>
                    <div className="text-[11px] text-neutral-400">{item.exampleMeaning}</div>
                    <div className="text-[11px] text-neutral-500 mt-1 leading-tight">{item.description}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 提示 */}
      <div className="text-center text-xs text-neutral-400 pt-2">
        {tab === "english"
          ? "Click any card to hear the pronunciation"
          : "Click any card to hear Korean pronunciation"}
      </div>
    </div>
  )
}
