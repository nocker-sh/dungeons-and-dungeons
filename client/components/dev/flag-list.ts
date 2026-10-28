import { settersOf } from "@/client/components/dev/setters-of"

export const flagList = (flags: readonly string[], withSetters = false) =>
  flags.length
    ? flags
        .map((flag) =>
          withSetters ? `${flag}（${settersOf(flag).join("、")}）` : flag
        )
        .join(" / ")
    : "なし"
