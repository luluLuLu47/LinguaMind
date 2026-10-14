import { NextRequest, NextResponse } from "next/server"
import { tts as edgeTts } from "edge-tts"

// 语言 → Edge-TTS 语音名称映射
const VOICE_MAP: Record<string, string> = {
  en: "en-US-JennyNeural",
  ko: "ko-KR-SunHiNeural",
}

export async function POST(request: NextRequest) {
  try {
    const { text, lang }: { text: string; lang: "en" | "ko" } = await request.json()

    if (!text || !lang) {
      return NextResponse.json({ error: "Missing text or lang" }, { status: 400 })
    }

    const voice = VOICE_MAP[lang]
    if (!voice) {
      return NextResponse.json({ error: `Unsupported language: ${lang}` }, { status: 400 })
    }

    // 直接调用 edge-tts npm 包，返回 Buffer
    // 相比原 spawn 子进程方案：
    // - 无需启动 Python 进程，延迟降低 300-500ms
    // - 无需临时文件读写
    // - 无需手动清理
    const audioBuffer = await edgeTts(text, { voice })
    // Buffer → 纯 ArrayBuffer → Blob，兼容 TS 5 严格类型和 NextResponse BodyInit
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer
    const audioBlob = new Blob([arrayBuffer], { type: "audio/mpeg" })

    return new NextResponse(audioBlob, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    )
  }
}
