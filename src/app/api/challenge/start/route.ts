/**
 * 随机挑战 - 启动接口
 *
 * POST /api/challenge/start
 * Body: { language, difficulty? }
 * Response: { scene, totalRounds }
 *
 * 随机抽取一个场景，隐藏标题/描述/tips，
 * 只告知角色和开场白，让用户现场应变。
 */

import { englishScenes, koreanScenes } from "@/data/scenes"
import type { SceneNode } from "@/data/scenes"

interface StartRequest {
  language: "en" | "ko"
  difficulty?: "beginner" | "intermediate" | "advanced"
}

const TOTAL_ROUNDS = 10

function randomPick(arr: SceneNode[]): SceneNode {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function POST(request: Request) {
  let body: StartRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { language, difficulty } = body

  const pool = language === "en" ? englishScenes : koreanScenes
  const filtered = difficulty
    ? pool.filter(s => s.difficulty === difficulty)
    : pool

  if (filtered.length === 0) {
    return new Response(JSON.stringify({ error: "No scenes match criteria" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const scene = randomPick(filtered)

  // 返回场景数据但标记为隐藏模式
  return new Response(JSON.stringify({
    scene,
    totalRounds: TOTAL_ROUNDS,
    // 隐藏模式：前端不展示标题和tips
    hidden: true,
    challengeId: `${scene.id}-${Date.now()}`,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
