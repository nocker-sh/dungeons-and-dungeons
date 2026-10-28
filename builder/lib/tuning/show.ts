import type { TuneTarget } from "@/builder/lib/tuning/types"

export const show = (target: TuneTarget, value: number) =>
  !Number.isFinite(value)
    ? "届かない"
    : target.unit === "rate"
      ? `${(value * 100).toFixed(1)}%`
      : value.toFixed(1)
