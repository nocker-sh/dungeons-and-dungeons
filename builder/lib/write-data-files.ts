import { replaceTextFile } from "@/lib/files/replace-text-file"

type File = Readonly<{ file: string; before: string; after: string }>

/** Restore attempted files if a synchronous write fails; retain both causes if restoration fails. */
export function writeDataFiles(files: readonly File[]): void {
  const attempted: File[] = []
  try {
    for (const file of files) {
      attempted.push(file)
      replaceTextFile(file.file, file.after)
    }
  } catch (cause) {
    const failures: unknown[] = [cause]
    for (const file of attempted.reverse()) {
      try {
        replaceTextFile(file.file, file.before)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 1)
      throw new AggregateError(failures, "Data write and restoration failed")
    throw cause
  }
}
