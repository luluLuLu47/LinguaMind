/**
 * Vitest global setup
 *
 * - Mocks better-sqlite3 with in-memory database for unit tests
 * - Sets test environment variables
 */

import { vi } from "vitest"

// 使用 vitest stubEnv 替代直接赋值，避免只读属性错误
vi.stubEnv("NODE_ENV", "test")
vi.stubEnv("DEEPSEEK_API_KEY", "test-api-key")
vi.stubEnv("DEEPSEEK_BASE_URL", "http://localhost:9999")
vi.stubEnv("LLM_API_KEY", "test-llm-key")
vi.stubEnv("DASHSCOPE_API_KEY", "test-dashscope-key")
