/**
 * 单词题库 — 棋类游戏共享数据源
 *
 * 设计目标：
 * - 优先使用用户的 vocabulary 表（生词本），让玩家在游戏里复习自己不会的词
 * - 不足时用主题词库（word-banks.ts）补充
 * - 生成 4 选 1 选择题，干扰项从同池子里抽
 *
 * 复用方：五子棋、斗地主、连连看等所有棋类游戏
 */

import { WORD_THEMES, type ThemeWord } from "./word-banks"

export interface WordQuestion {
  /** 正确的英文单词 */
  word: string
  /** 中文释义 */
  meaning: string
  /** emoji 图标 */
  emoji: string
  /** 4 个选项（中文释义），含正确答案 */
  options: string[]
  /** 正确答案在 options 中的下标 */
  answerIndex: number
  /** 来源：用户生词本 or 主题词库 */
  source: "vocab" | "theme"
}

/** 从数组里随机取 n 个不重复元素 */
function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr]
  const result: T[] = []
  const used = new Set<number>()
  while (result.length < n) {
    const i = Math.floor(Math.random() * arr.length)
    if (!used.has(i)) {
      used.add(i)
      result.push(arr[i])
    }
  }
  return result
}

/** 把一个 ThemeWord[] 池子转成一道选择题 */
function makeQuestionFromPool(
  pool: ThemeWord[],
  correctIdx: number,
  source: "vocab" | "theme"
): WordQuestion {
  const correct = pool[correctIdx]
  // 干扰项：从池子里抽 3 个不同的释义
  const distractors = sample(
    pool.filter((_, i) => i !== correctIdx),
    3
  ).map(w => w.zh)

  // 打乱选项
  const allOptions = [correct.zh, ...distractors]
  // Fisher-Yates 洗牌
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]]
  }

  return {
    word: correct.en,
    meaning: correct.zh,
    emoji: correct.emoji,
    options: allOptions,
    answerIndex: allOptions.indexOf(correct.zh),
    source,
  }
}

/**
 * 从主题词库生成一批选择题
 * @param count 题目数量
 * @param excludeWords 已经出过的单词，避免重复
 */
export function generateQuestionsFromThemes(
  count: number,
  excludeWords: Set<string> = new Set()
): WordQuestion[] {
  // 把所有主题的词合并成一个大池子
  const pool: ThemeWord[] = []
  for (const theme of WORD_THEMES) {
    pool.push(...theme.words)
  }

  // 过滤掉已经出过的
  const available = pool.filter(w => !excludeWords.has(w.en))
  if (available.length === 0) return []

  // 随机选 count 个不同的词
  const selectedIndices = sample(
    available.map((_, i) => i),
    Math.min(count, available.length)
  )

  return selectedIndices.map(idx => makeQuestionFromPool(available, idx, "theme"))
}

/**
 * 从用户 vocabulary 列表生成选择题
 * @param vocabWords 用户生词本 [{word, meaning, language}]
 */
export function generateQuestionsFromVocab(
  vocabWords: Array<{ word: string; meaning: string; language: string }>,
  count: number,
  excludeWords: Set<string> = new Set()
): WordQuestion[] {
  const available = vocabWords.filter(w => !excludeWords.has(w.word))
  if (available.length === 0) return []

  // 把用户单词转成 ThemeWord 格式
  const pool: ThemeWord[] = available.map(w => ({
    en: w.word,
    zh: w.meaning,
    emoji: getEmojiForWord(w.word),
  }))

  // 如果用户单词不够 4 个，无法做 4 选 1，从主题词库补充干扰项
  if (pool.length < 4) {
    const themePool: ThemeWord[] = []
    for (const theme of WORD_THEMES) {
      themePool.push(...theme.words)
    }
    // 补充到至少 4 个
    const need = 4 - pool.length
    const extra = sample(themePool.filter(tw => !pool.some(p => p.en === tw.en)), need)
    pool.push(...extra)
  }

  const selectedIndices = sample(
    pool.map((_, i) => i),
    Math.min(count, pool.length)
  )

  return selectedIndices.map(idx => makeQuestionFromPool(pool, idx, "vocab"))
}

/**
 * 混合生成题库：优先用户生词，不足用主题词库补
 */
export function generateMixedQuestions(
  vocabWords: Array<{ word: string; meaning: string; language: string }>,
  count: number,
  excludeWords: Set<string> = new Set()
): WordQuestion[] {
  const questions: WordQuestion[] = []

  // 1. 先从用户生词本出题（最多占一半）
  const vocabCount = Math.min(Math.ceil(count / 2), vocabWords.length)
  if (vocabCount >= 1) {
    questions.push(...generateQuestionsFromVocab(vocabWords, vocabCount, excludeWords))
  }

  // 2. 不足的部分用主题词库补
  const remaining = count - questions.length
  if (remaining > 0) {
    const usedWords = new Set([...excludeWords, ...questions.map(q => q.word)])
    questions.push(...generateQuestionsFromThemes(remaining, usedWords))
  }

  return questions
}

/** 给单词生成 emoji（复用 mini-game/page.tsx 的逻辑） */
function getEmojiForWord(word: string): string {
  const emojiMap: Record<string, string> = {
    apple: "🍎", book: "📖", cat: "🐱", dog: "🐶", sun: "☀️",
    moon: "🌙", star: "⭐", fish: "🐟", water: "💧", food: "🍱",
    car: "🚗", house: "🏠", tree: "🌳", flower: "🌸", rain: "🌧️",
    snow: "❄️", fire: "🔥", heart: "❤️", eye: "👁️", hand: "✋",
    bird: "🐦", cow: "🐄", horse: "🐎", sheep: "🐑", chicken: "🐔",
    rice: "🍚", tea: "🍵", coffee: "☕", milk: "🥛", bread: "🍞",
    egg: "🥚", meat: "🥩", fruit: "🍎", sky: "🌌", mountain: "⛰️",
  }
  const lower = word.toLowerCase()
  if (emojiMap[lower]) return emojiMap[lower]

  const genericEmojis = ["📝", "💎", "🔷", "🔶", "🔺", "🔻", "♦️", "♠️"]
  let hash = 0
  for (let i = 0; i < word.length; i++) {
    hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
  }
  return genericEmojis[Math.abs(hash) % genericEmojis.length]
}
