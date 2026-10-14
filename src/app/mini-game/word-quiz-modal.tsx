"use client"

import { useState, useCallback, useEffect } from "react"
import { X, Check, AlertCircle, Loader2, Volume2 } from "lucide-react"
import type { WordQuestion } from "./word-quiz"

/**
 * 单词选择题弹窗 — 棋类游戏通用组件
 *
 * 使用方式：
 * <WordQuizModal
 *   question={question}
 *   onResult={(correct) => { ... }}
 *   lang="en"
 * />
 *
 * 落子劫持机制：
 * - 玩家点击棋盘 → 弹出此弹窗
 * - 答对 → onResult(true) → 允许落子
 * - 答错 → onResult(false) → 跳过回合
 */

interface WordQuizModalProps {
  question: WordQuestion | null
  onResult: (correct: boolean) => void
  lang: "en" | "ko"
}

export function WordQuizModal({ question, onResult, lang }: WordQuizModalProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  // 题目变化时重置
  useEffect(() => {
    setSelected(null)
    setShowResult(false)
    setIsCorrect(false)
  }, [question])

  const speakWord = useCallback(async () => {
    if (!question) return
    setSpeaking(true)
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question.word, lang: "en" }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setSpeaking(false)
      }
      audio.play()
    } catch {
      setSpeaking(false)
    }
  }, [question])

  const handleSelect = useCallback((index: number) => {
    if (showResult || !question) return
    setSelected(index)
    const correct = index === question.answerIndex
    setIsCorrect(correct)
    setShowResult(true)

    // 1.5 秒后自动回调，让玩家看到对错反馈
    setTimeout(() => {
      onResult(correct)
    }, 1500)
  }, [showResult, question, onResult])

  if (!question) return null

  const t = lang === "en" ? {
    title: "Answer to Place Your Stone",
    prompt: "What does this word mean?",
    correct: "Correct! Stone placed.",
    wrong: "Wrong! Turn skipped.",
    pronounce: "Pronounce",
  } : {
    title: "맞춰야 돌을 놓을 수 있어요",
    prompt: "이 단어의 뜻은?",
    correct: "정답! 돌을 놓았습니다.",
    wrong: "틀렸어요! 차례를 넘깁니다.",
    pronounce: "발음 듣기",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          animation: "quizPopIn 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--accent)" }}>
            {t.title}
          </h3>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: question.source === "vocab"
                ? "var(--accent-secondary)"
                : "var(--surface-subtle)",
              color: question.source === "vocab" ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {question.source === "vocab"
              ? (lang === "en" ? "Your Word" : "내 단어")
              : (lang === "en" ? "Theme Word" : "주제 단어")}
          </span>
        </div>

        {/* Word display */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-4xl">{question.emoji}</span>
          <div className="flex-1">
            <p className="text-2xl font-bold tracking-wide">{question.word}</p>
            <p className="text-xs text-[var(--text-muted)]">{t.prompt}</p>
          </div>
          <button
            onClick={speakWord}
            disabled={speaking}
            className="p-2.5 rounded-xl transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-50"
            style={{ color: "var(--accent)" }}
            title={t.pronounce}
          >
            {speaking ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-2.5">
          {question.options.map((option, index) => {
            const isSelected = selected === index
            const isAnswer = index === question.answerIndex

            let bg = "var(--surface-subtle)"
            let border = "1px solid var(--border)"
            let textColor = "var(--text)"

            if (showResult) {
              if (isAnswer) {
                bg = "#dcfce7"
                border = "2px solid #22c55e"
                textColor = "#15803d"
              } else if (isSelected) {
                bg = "#fef2f2"
                border = "2px solid #ef4444"
                textColor = "#dc2626"
              }
            } else if (isSelected) {
              bg = "var(--accent-secondary)"
              border = "2px solid var(--accent)"
              textColor = "var(--accent)"
            }

            return (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                disabled={showResult}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-left font-medium transition-all hover:scale-[1.02] disabled:hover:scale-100"
                style={{
                  backgroundColor: bg,
                  border,
                  color: textColor,
                }}
              >
                <span>{option}</span>
                {showResult && isAnswer && (
                  <Check className="h-4 w-4 flex-shrink-0" />
                )}
                {showResult && isSelected && !isAnswer && (
                  <X className="h-4 w-4 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* Result feedback */}
        {showResult && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium"
            style={{
              backgroundColor: isCorrect ? "#dcfce7" : "#fef2f2",
              color: isCorrect ? "#15803d" : "#dc2626",
            }}
          >
            {isCorrect ? (
              <Check className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {isCorrect ? t.correct : t.wrong}
            {!isCorrect && (
              <span className="text-xs ml-1 opacity-80">
                {question.word} = {question.meaning}
              </span>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes quizPopIn {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
