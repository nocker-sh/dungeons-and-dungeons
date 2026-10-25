import type { Preview } from "./types"
import type { PreviewContext } from "./context"
import type { createExplorationScenarios } from "./exploration"
export function resultPreviews(
  context: PreviewContext,
  exploration: Pick<
    ReturnType<typeof createExplorationScenarios>,
    "wiped" | "endingReached"
  >
): Preview[] {
  const { prepared } = context
  const { wiped, endingReached } = exploration

  return [
    {
      slug: "result-wipe",
      title: "結果：全滅",
      start: () => prepared(wiped(), { name: "town" }),
    },
    {
      slug: "post-clear-guild",
      title: "踏破後：全員生還の再挑戦依頼",
      start: () => {
        const game = endingReached()
        const saved = game.save()
        const failed = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, endingSeen: true },
        })
        if (failed) throw failed
        return prepared(game, { name: "place", place: "reception" })
      },
    },
    {
      slug: "result-ending",
      title: "結果：踏破（エンディング）",
      start: () => prepared(endingReached(), { name: "town" }),
    },
  ]
}
