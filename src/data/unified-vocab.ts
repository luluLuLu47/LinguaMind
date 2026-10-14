import { cetWords, type WordItem } from "./cet-words"
import { rawWords, type RawWord } from "./word-bank-raw"

export interface VocabWord {
  word: string
  phonetic: string
  meaning: string
  level: "cet4" | "cet6" | "kaoyan"
  emoji: string
  hasPhonetic: boolean
}

const DEFAULT_EMOJI = "📝"

function buildEmojiMap(raw: RawWord[]) {
  const map = new Map<string, string>()
  for (const w of raw) {
    if (!map.has(w.en)) {
      map.set(w.en, w.emoji)
    }
  }
  return map
}

function buildMeaningMap(raw: RawWord[]) {
  const map = new Map<string, string>()
  for (const w of raw) {
    if (!map.has(w.en)) {
      map.set(w.en, w.zh)
    }
  }
  return map
}

const emojiMap = buildEmojiMap(rawWords)
const meaningMap = buildMeaningMap(rawWords)

// 从 cet-words 构建（已有音标）
const unifiedMap = new Map<string, VocabWord>()

for (const w of cetWords) {
  const raw = rawWords.find(r => r.en === w.word)
  unifiedMap.set(w.word, {
    word: w.word,
    phonetic: w.phonetic,
    meaning: w.meaning,
    level: w.level,
    emoji: raw?.emoji ?? emojiMap.get(w.word) ?? DEFAULT_EMOJI,
    hasPhonetic: true,
  })
}

// 从 rawWords 补充（没有音标的词）
for (const w of rawWords) {
  if (unifiedMap.has(w.en)) continue
  unifiedMap.set(w.en, {
    word: w.en,
    phonetic: "",
    meaning: w.zh,
    level: w.level,
    emoji: w.emoji || DEFAULT_EMOJI,
    hasPhonetic: false,
  })
}

export const unifiedVocab: VocabWord[] = Array.from(unifiedMap.values())

export function getWordsByLevel(level: "cet4" | "cet6" | "kaoyan" | "all"): VocabWord[] {
  if (level === "all") return unifiedVocab
  return unifiedVocab.filter((w) => w.level === level)
}

export function getRandomWords(
  level: "cet4" | "cet6" | "kaoyan" | "all" = "all",
  count: number,
): VocabWord[] {
  const pool = getWordsByLevel(level)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function getVocabStats(): { cet4: number; cet6: number; kaoyan: number; total: number } {
  let cet4 = 0
  let cet6 = 0
  let kaoyan = 0
  for (const w of unifiedVocab) {
    if (w.level === "cet4") cet4++
    else if (w.level === "cet6") cet6++
    else if (w.level === "kaoyan") kaoyan++
  }
  return { cet4, cet6, kaoyan, total: unifiedVocab.length }
}
