export type SaveStorage = Readonly<{
  read: () => string | null
  write: (value: string) => void | Promise<void>
  clear: () => void | Promise<void>
}>
