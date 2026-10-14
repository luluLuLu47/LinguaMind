/**
 * 阿里云 DashScope (通义千问) API 通用调用模块
 *
 * 支持两种调用方式：
 * 1. DashScope 原生 API（功能最完整）
 * 2. OpenAI 兼容 API（简单场景快速接入）
 *
 * 本模块主要使用 OpenAI 兼容接口，因为：
 * - 调用格式与 DeepSeek 一致，代码复用度高
 * - 发音评分等场景不需要 DashScope 特有功能
 */

// 兼容任意 OpenAI 兼容协议的 LLM 服务（DashScope / 火山方舟 / DeepSeek 等）
// 优先读取 LLM_* 环境变量，回退到 DASHSCOPE_API_KEY 以保持向后兼容
const API_KEY = process.env.LLM_API_KEY || process.env.DASHSCOPE_API_KEY || ""

// OpenAI 兼容接口 base_url（默认 DashScope 兼容模式，可经 LLM_BASE_URL 覆盖）
const BASE_URL = process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"

// 默认模型（可经 LLM_MODEL 覆盖，例如火山引擎的 doubao-1.5-pro-32k）
const DEFAULT_MODEL = process.env.LLM_MODEL || "qwen-turbo-latest"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  responseFormat?: "text" | "json_object"
}

export interface ChatCompletionResponse {
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

/**
 * 非流式调用通义千问（OpenAI 兼容接口）
 */
export async function qwenChat(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  if (!API_KEY) {
    throw new Error("LLM_API_KEY (or DASHSCOPE_API_KEY) is not configured")
  }

  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 2000,
    responseFormat = "text",
  } = options

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  }

  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" }
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Qwen API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ""

  return {
    content,
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  }
}

/**
 * 流式调用通义千问（OpenAI 兼容接口）
 * 返回一个 ReadableStream，可通过 SSE 方式逐 chunk 读取
 */
export async function qwenChatStream(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  if (!API_KEY) {
    throw new Error("LLM_API_KEY (or DASHSCOPE_API_KEY) is not configured")
  }

  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 2000,
  } = options

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Qwen API stream error (${response.status}): ${errorText}`)
  }

  if (!response.body) {
    throw new Error("Qwen API stream response has no body")
  }

  return response.body
}

/**
 * 发音评分（DashScope 原生接口）
 *
 * 使用当前配置的 LLM 模型（LLM_MODEL，默认 qwen-turbo-latest），通过 prompt 工程进行发音评估。
 * 阿里云没有专用的发音评分 API，这里通过 LLM 分析实现。
 *
 * @param text 标准文本（目标句子）
 * @param userTranscript 用户实际朗读的转录文本
 * @param lang 语言（en/ko）
 * @returns 评分结果
 */
export interface PronunciationScore {
  overallScore: number // 0-100 综合得分
  accuracy: number // 准确度 0-100
  fluency: number // 流利度 0-100
  completeness: number // 完整度 0-100
  wordScores: Array<{
    word: string
    score: number // 0-100
    level: "green" | "yellow" | "red" // 绿>=80 / 黄>=60 / 红<60
  }>
  feedback: string // 中文反馈建议
  degraded?: boolean // true 表示 LLM 评分失败，返回的是默认分数
}

export async function scorePronunciation(
  text: string,
  userTranscript: string,
  lang: "en" | "ko"
): Promise<PronunciationScore> {
  if (!API_KEY) {
    throw new Error("LLM_API_KEY (or DASHSCOPE_API_KEY) is not configured")
  }

  const langName = lang === "en" ? "English" : "Korean"
  const systemPrompt = `You are a professional ${langName} pronunciation evaluator. 
Analyze the user's pronunciation by comparing their transcript with the target sentence.
You MUST respond with valid JSON only, no other text.`

  const userPrompt = `Target sentence: "${text}"
User's transcript: "${userTranscript}"

Evaluate the pronunciation and return a JSON object with this exact structure:
{
  "overallScore": number (0-100),
  "accuracy": number (0-100),
  "fluency": number (0-100),
  "completeness": number (0-100),
  "wordScores": [
    { "word": "string", "score": number (0-100), "level": "green" | "yellow" | "red" }
  ],
  "feedback": "string (brief ${lang === "en" ? "Chinese" : "Chinese"} feedback, 1-2 sentences)"
}

Rules:
- overallScore = accuracy * 0.4 + fluency * 0.3 + completeness * 0.3
- accuracy: how correct each word is pronounced
- fluency: natural rhythm, stress, intonation
- completeness: how much of the target sentence was spoken (missing words = lower score)
- wordScores: one entry per word in the target sentence, comparing against transcript
- level: "green" if score >= 80, "yellow" if score >= 60, "red" if score < 60
- feedback: write in Chinese, be encouraging but honest, suggest specific improvements`

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Pronunciation scoring error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || "{}"

  try {
    return JSON.parse(content) as PronunciationScore
  } catch {
    // 如果 JSON 解析失败，返回默认评分
    return {
      overallScore: 70,
      accuracy: 70,
      fluency: 70,
      completeness: 70,
      wordScores: text.split(" ").map((word) => ({
        word,
        score: 70,
        level: "yellow" as const,
      })),
      feedback: "评分解析异常，请重试。",
    }
  }
}

/**
 * 造句评分
 *
 * @param sentence 用户造的句子
 * @param targetExpression 目标表达（今日学习的短语/句型）
 * @param lang 语言
 */
export interface SentenceScore {
  score: number // 0-100
  grammarCorrect: boolean
  expressionUsed: boolean
  naturalness: number // 0-100 自然度
  feedback: string // 中文反馈
  correctedSentence?: string // 如果语法有问题，给出修正版本
  degraded?: boolean // true 表示 LLM 评分失败，返回的是默认分数
}

export async function scoreSentence(
  sentence: string,
  targetExpression: string,
  lang: "en" | "ko"
): Promise<SentenceScore> {
  if (!API_KEY) {
    throw new Error("LLM_API_KEY (or DASHSCOPE_API_KEY) is not configured")
  }

  const langName = lang === "en" ? "English" : "Korean"

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a ${langName} teacher evaluating a student's sentence. Respond with JSON only.`,
        },
        {
          role: "user",
          content: `Target expression to practice: "${targetExpression}"
Student's sentence: "${sentence}"

Evaluate and return JSON:
{
  "score": number (0-100),
  "grammarCorrect": boolean,
  "expressionUsed": boolean (whether the target expression is correctly used),
  "naturalness": number (0-100, how natural it sounds),
  "feedback": "string (Chinese feedback, 1-2 sentences, encouraging)",
  "correctedSentence": string | null (if grammar has issues, provide corrected version; otherwise null)
}

Scoring: grammarCorrect(40pts) + expressionUsed(30pts) + naturalness(30pts)`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sentence scoring error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || "{}"

  try {
    return JSON.parse(content) as SentenceScore
  } catch {
    return {
      score: 70,
      grammarCorrect: true,
      expressionUsed: true,
      naturalness: 70,
      feedback: "评分解析异常，请重试。",
    }
  }
}
