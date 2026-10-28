export type LayoutPattern = {
  slug: string
  title: string
  scene: string
  at: number
  actions: { at: number; label: string }[]
  seed?: number
  hp?: number[]
  foes?: string[]
}
