import { readFileSync } from "node:fs"

/** JSON文字列内の # とエスケープを保ち、引用符の外のコメントだけを除く。 */
function withoutComment(line: string) {
  let quoted = false
  let escaped = false
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (escaped) escaped = false
    else if (quoted && character === "\\") escaped = true
    else if (character === '"') quoted = !quoted
    else if (!quoted && character === "#") return line.slice(0, index).trim()
  }
  return line.trim()
}

/** --script / --sets 共通の、空行とコメントを除いた入力。 */
export function readLineFile(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .map(withoutComment)
    .filter(Boolean)
}
