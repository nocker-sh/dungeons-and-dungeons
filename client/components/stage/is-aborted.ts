import { AnimationAborted } from "@/client/components/canvas/animation"

export function isAborted(error: unknown) {
  return error instanceof AnimationAborted
}
