import type { StudioConfig } from "@/development/studio/config"

export type AnimationTrack = {
  id: number
  label: string
  start: number
  duration: number
  properties: string[]
}
export type StudioInspection = {
  version: 1
  config: StudioConfig
  time: number
  ready: boolean
  errors: string[]
  text: string
  animations: AnimationTrack[]
  operations: { at: number; label: string; success: boolean }[]
  state: unknown
  party: unknown
  battle: unknown
  elements: {
    tag: string
    label: string
    x: number
    y: number
    width: number
    height: number
    outside: boolean
    filter: string
    opacity: string
    image: string | null
  }[]
}
export type StudioBridge = {
  ready: boolean
  readonly settled: boolean
  advance: (time: number) => Promise<StudioInspection>
  snapshot: () => Promise<StudioInspection>
  inspect: () => StudioInspection
  click: (label: string) => void
  guides: (enabled: boolean) => void
  configure: (config: StudioConfig) => void
}
declare global {
  interface Window {
    __devStudio?: StudioBridge
    __devStudioError?: string
  }
}
