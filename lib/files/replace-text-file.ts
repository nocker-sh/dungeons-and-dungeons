import {
  closeSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { randomUUID } from "node:crypto"
import { dirname } from "node:path"

/** Replace only after writing an exclusively owned temporary beside the target. */
export function replaceTextFile(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  const descriptor = openSync(temporary, "wx")
  try {
    try {
      writeFileSync(descriptor, text)
    } finally {
      closeSync(descriptor)
    }
    renameSync(temporary, file)
  } finally {
    rmSync(temporary, { force: true })
  }
}
