import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { Preview } from "@/development/scenarios/types"
import type { PreviewContext } from "@/development/scenarios/context"
import type { createExplorationScenarios } from "@/development/scenarios/exploration"

export function routeEntryPreviews(
  context: PreviewContext,
  exploration: Pick<ReturnType<typeof createExplorationScenarios>, "progressed">
): Preview[] {
  const { content, play, prepared } = context
  const { progressed } = exploration

  return [
    ...(
      [
        "loot",
        "treasure",
        "discovery",
        "trap",
        "branch",
        "midboss",
        "boss",
        "cleared",
      ] as const
    ).map((kind) => ({
      slug: `route-${kind}`,
      title: `探索：${{ loot: "戦利品", treasure: "宝箱", discovery: "祝福の祭壇", trap: "罠", branch: "分岐", midboss: "中ボス", boss: "ボス", cleared: "踏破・帰還" }[kind]}`,
      start: () => prepared(progressed(kind), { name: "expedition" }),
    })),
    {
      slug: "route-chest-branch",
      title: "探索：宝箱のある分岐",
      start: () => prepared(progressed("chest-branch"), { name: "expedition" }),
    },
    ...[2, 3, 4].map((layerIndex) => ({
      slug: `route-layer${layerIndex}`,
      title: `探索：${content.layers[layerIndex].name}`,
      start: () => {
        const game = play(1)
        const saved = game.save()
        const failed = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, reached: layerIndex },
        })
        if (failed) throw failed
        const departed = inPhase(game, "town")?.depart(
          content.layers[layerIndex].id
        )
        if (!departed || departed instanceof GameCommandError)
          throw new Error(`${layerIndex}層の背景確認用の出撃に失敗`)
        return prepared(game, { name: "expedition" })
      },
    })),
  ]
}
