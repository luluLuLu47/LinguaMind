/**
 * Unit tests for utils.ts
 */

import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("Utils: cn (className merge)", () => {
  it("should merge class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("should handle conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("should resolve Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("should handle empty inputs", () => {
    expect(cn()).toBe("")
  })

  it("should handle undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end")
  })
})
