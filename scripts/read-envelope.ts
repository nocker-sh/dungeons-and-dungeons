import { readFileSync } from "node:fs"

export function readEnvelope(path: string): Record<string, unknown> {
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw error
  }
  const saved: unknown = JSON.parse(raw)
  if (!saved || typeof saved !== "object" || Array.isArray(saved))
    throw new SyntaxError("保存ファイルの形が違います")
  return saved as Record<string, unknown>
}
