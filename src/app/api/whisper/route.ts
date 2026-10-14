/**
 * LinguaMind Whisper 语音识别 API
 *
 * POST /api/whisper
 * Body: FormData { audio: File (webm/wav), language: "en" | "ko" }
 * Response: { text: string }
 *
 * 使用阿里云 DashScope 的 Whisper 模型
 */

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || ""

export async function POST(request: Request) {
  if (!DASHSCOPE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "DashScope API key not configured", mock: true, text: "" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File | null
    const language = (formData.get("language") as string) || "en"

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 将音频文件转为 base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")

    // 调用阿里云 DashScope Whisper API
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "whisper-1",
          input: {
            audio: base64Audio,
          },
          parameters: {
            language: language === "ko" ? "ko" : "en",
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Whisper API] Error:", errorText)
      return new Response(JSON.stringify({ error: "ASR failed", text: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const data = await response.json()
    const text = data.output?.text || ""

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[Whisper API] Error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        text: "",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
}
