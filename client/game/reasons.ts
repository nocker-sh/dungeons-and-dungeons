import { StateIntegrityError } from "@/lib/wiz/integrity/state-integrity-error"

export function reasons(error: unknown): string[] {
  if (error instanceof StateIntegrityError) return [...error.problems]
  const code = (error as { code?: string } | null)?.code
  if (code === "CONTENT_VERSION_MISMATCH")
    return ["以前の版のゲームで保存したデータです（保存の形が変わりました）"]
  if (code === "SCHEMA_VERSION_MISMATCH") return ["保存の形式が違います"]
  if (error instanceof SyntaxError) return ["保存データが壊れています"]
  if (error instanceof Error) return [error.message.split("\n")[0]]
  return ["保存データの形が読めません"]
}
