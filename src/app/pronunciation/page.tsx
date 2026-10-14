"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, Volume2, ChevronDown, ChevronUp, ChevronLeft, Loader2 } from "lucide-react"
import { englishPhonetics, type PhoneticItem } from "@/data/english-phonetics"
import { koreanLetters, type KoreanLetterItem } from "@/data/korean-letters"
import { cn } from "@/lib/utils"

type FilterType = "all" | "vowel" | "consonant" | "diphthong"

// 统一类型，便于分组操作
type UnifiedItem = PhoneticItem | KoreanLetterItem

export default function PronunciationPage() {
  const router = useRouter()
  const { language, config } = useLanguage()
  const [filter, setFilter] = useState<FilterType>("all")
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 根据语言获取数据
  const items = language === "en" ? englishPhonetics : koreanLetters
  const isEnglish = language === "en"

  // 获取所有分类（用于分组展示）
  const categories = useMemo(() => {
    const cats = new Set(items.map((item) => item.category))
    return Array.from(cats)
  }, [items])

  // 过滤后的数据
  const filteredItems = useMemo(() => {
    if (filter === "all") return items
    return items.filter((item) => item.type === filter)
  }, [items, filter])

  // 按分类分组
  const groupedItems = useMemo(() => {
    const groups: Record<string, UnifiedItem[]> = {}
    for (const item of filteredItems) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return groups
  }, [filteredItems])

  // 使用 Edge-TTS API 播放发音
  const playSound = useCallback(
    async (text: string, key: string) => {
      try {
        // 如果正在播放同一个音频，停止
        if (playingKey === key && audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
          setPlayingKey(null)
          return
        }

        setPlayingKey(key)

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: language === "en" ? "en" : "ko" }),
        })

        if (!response.ok) {
          throw new Error("TTS request failed")
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)

        // 释放旧音频
        if (audioRef.current) {
          audioRef.current.pause()
          URL.revokeObjectURL(audioRef.current.src)
        }

        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          setPlayingKey(null)
          URL.revokeObjectURL(url)
        }

        audio.onerror = () => {
          setPlayingKey(null)
          URL.revokeObjectURL(url)
        }

        await audio.play()
      } catch (error) {
        console.error("TTS play error:", error)
        setPlayingKey(null)
      }
    },
    [language, playingKey]
  )

  // 过滤按钮配置
  const filterButtons: { label: string; value: FilterType }[] = isEnglish
    ? [
        { label: "All", value: "all" },
        { label: "Vowels", value: "vowel" },
        { label: "Diphthongs", value: "diphthong" },
        { label: "Consonants", value: "consonant" },
      ]
    : [
        { label: "All", value: "all" },
        { label: "Vowels (모음)", value: "vowel" },
        { label: "Consonants (자음)", value: "consonant" },
      ]

  // 统计数字
  const stats = useMemo(() => {
    const vowels = items.filter((i) => i.type === "vowel").length
    const consonants = items.filter((i) => i.type === "consonant").length
    const diphthongs = isEnglish
      ? (items as PhoneticItem[]).filter((i) => i.type === "diphthong").length
      : 0
    return { vowels, consonants, diphthongs, total: items.length }
  }, [items, isEnglish])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          title={isEnglish ? "Back" : "뒤로가기"}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <BookOpen className="h-6 w-6" style={{ color: config.primaryColor }} />
        <div>
          <h1 className="text-2xl font-bold">
            {isEnglish ? "Phonetics" : "한글 자모"}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {isEnglish
              ? `${stats.total} phonetic symbols · Click to listen`
              : `${stats.total}개 자모 · 눌러서 듣기`}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox
          label={isEnglish ? "Total" : "전체"}
          value={stats.total}
          color={config.primaryColor}
          bgColor={config.secondaryColor}
        />
        <StatBox
          label={isEnglish ? "Vowels" : "모음"}
          value={stats.vowels}
          color={config.primaryColor}
          bgColor={config.secondaryColor}
        />
        {isEnglish ? (
          <StatBox
            label="Diphthongs"
            value={stats.diphthongs}
            color={config.primaryColor}
            bgColor={config.secondaryColor}
          />
        ) : (
          <StatBox
            label="복합모음"
            value={items.filter((i) => i.type === "vowel" && i.category === "复合元音").length}
            color={config.primaryColor}
            bgColor={config.secondaryColor}
          />
        )}
        <StatBox
          label={isEnglish ? "Consonants" : "자음"}
          value={stats.consonants}
          color={config.primaryColor}
          bgColor={config.secondaryColor}
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              filter === btn.value
                ? "text-white shadow-sm"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
            style={
              filter === btn.value
                ? { backgroundColor: config.primaryColor }
                : undefined
            }
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Phonetics Grid by Category */}
      <div className="space-y-8">
        {categories.map((category) => {
          const categoryItems = groupedItems[category]
          if (!categoryItems || categoryItems.length === 0) return null

          return (
            <div key={category}>
              <h2 className="text-sm font-medium text-neutral-500 mb-3 px-1">
                {category}{" "}
                <span className="text-neutral-300">({categoryItems.length})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {categoryItems.map((item) => {
                  const itemKey = `${category}-${item.symbol}`
                  const isExpanded = expandedItem === itemKey
                  const isPlaying = playingKey === itemKey

                  return (
                    <PhoneticCard
                      key={itemKey}
                      item={item}
                      isEnglish={isEnglish}
                      isExpanded={isExpanded}
                      isPlaying={isPlaying}
                      primaryColor={config.primaryColor}
                      secondaryColor={config.secondaryColor}
                      onPlay={() => {
                        // 播放示例单词
                        playSound(item.example, itemKey)
                      }}
                      onPlaySymbol={() => {
                        // 韩语播放字母本身的发音，英语播放示例单词
                        const text = isEnglish ? item.example : item.symbol
                        playSound(text, itemKey)
                      }}
                      onToggleExpand={() => {
                        setExpandedItem(isExpanded ? null : itemKey)
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tip */}
      <Card className="bg-gradient-to-br from-neutral-50 to-white">
        <CardContent className="p-4 flex items-start gap-3">
          <Volume2
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            style={{ color: config.primaryColor }}
          />
          <div>
            <p className="text-sm text-neutral-700">
              {isEnglish
                ? "Click any card to hear the example word. Use the filters to focus on specific sound types."
                : "카드를 눌러 예시 단어를 들어보세요. 필터로 특정 자모 유형만 볼 수 있어요."}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {isEnglish
                ? "Tip: Practice each sound by repeating after the audio."
                : "팁: 오디오를 따라 말하며 각 소리를 연습하세요."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== 统计小卡片 =====
function StatBox({
  label,
  value,
  color,
  bgColor,
}: {
  label: string
  value: number
  color: string
  bgColor: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 p-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ backgroundColor: bgColor, color }}
        >
          {value}
        </div>
        <div className="text-xs text-neutral-400">{label}</div>
      </CardContent>
    </Card>
  )
}

// ===== 发音卡片 =====
interface PhoneticCardProps {
  item: PhoneticItem | KoreanLetterItem
  isEnglish: boolean
  isExpanded: boolean
  isPlaying: boolean
  primaryColor: string
  secondaryColor: string
  onPlay: () => void
  onPlaySymbol: () => void
  onToggleExpand: () => void
}

function PhoneticCard({
  item,
  isEnglish,
  isExpanded,
  isPlaying,
  primaryColor,
  secondaryColor,
  onPlay,
  onPlaySymbol,
  onToggleExpand,
}: PhoneticCardProps) {
  const phoneticItem = item as PhoneticItem
  const koreanItem = item as KoreanLetterItem

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all hover:shadow-md cursor-pointer group",
        isPlaying && "ring-2 shadow-lg"
      )}
      style={isPlaying ? { "--tw-ring-color": primaryColor } as React.CSSProperties : undefined}
      onClick={onPlaySymbol}
    >
      <CardContent className="p-0">
        {/* 符号区 */}
        <div
          className="flex items-center justify-center py-6 relative"
          style={{ backgroundColor: secondaryColor }}
        >
          <span
            className="text-3xl font-bold"
            style={{ color: primaryColor }}
          >
            {item.symbol}
          </span>
          {/* 播放按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlay()
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            aria-label="Play example"
          >
            {isPlaying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: primaryColor }} />
            ) : (
              <Volume2 className="h-3.5 w-3.5" style={{ color: primaryColor }} />
            )}
          </button>
        </div>

        {/* 信息区 */}
        <div className="p-3 space-y-1.5">
          {/* 罗马音（韩语）/ 示例单词音标（英语） */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {isEnglish ? "Example" : "Romanization"}
            </span>
            <span className="text-xs font-medium text-neutral-600">
              {isEnglish ? phoneticItem.example : koreanItem.romanization}
            </span>
          </div>

          {/* 英语显示音标，韩语显示含义 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {isEnglish ? "Phonetic" : "Meaning"}
            </span>
            <span className="text-xs text-neutral-500">
              {isEnglish
                ? phoneticItem.examplePhonetic
                : koreanItem.exampleMeaning}
            </span>
          </div>

          {/* 展开/收起 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors pt-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Details
              </>
            )}
          </button>

          {/* 展开后显示发音说明 */}
          {isExpanded && (
            <div className="pt-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 leading-relaxed">
                {item.description}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
