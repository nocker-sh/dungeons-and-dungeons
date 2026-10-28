import type { Preview } from "@/development/scenarios/types"
import type { PreviewContext } from "@/development/scenarios/context"
import type { createExplorationScenarios } from "@/development/scenarios/exploration"
import type { createCombatScenarios } from "@/development/scenarios/combat"
import type { createArmorScenarios } from "@/development/scenarios/armor"

export function dungeonPreviews(
  context: PreviewContext,
  combat: Pick<
    ReturnType<typeof createCombatScenarios>,
    "slimeIndividuals" | "slimeBattle" | "departed" | "battle" | "battleIn"
  >,
  armor: Pick<ReturnType<typeof createArmorScenarios>, "armoredBattle">,
  exploration: Pick<
    ReturnType<typeof createExplorationScenarios>,
    "mimicChest" | "rareLoot" | "progressed"
  >
): Preview[] {
  const { content, prepared } = context
  const { slimeIndividuals, slimeBattle, departed, battle, battleIn } = combat
  const { armoredBattle } = armor
  const { mimicChest, rareLoot, progressed } = exploration

  return [
    ...content.layers
      .filter((layer) => layer.no > 0)
      .map((layer) => ({
        slug: `route-gathering-${layer.no}`,
        title: `探索：${layer.name}の採集`,
        start: () => {
          const game = progressed("discovery")
          const saved = game.save()
          if (saved.snapshot.phase.type !== "expedition")
            throw new Error("探索ではない")
          const failed = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              reached: layer.no,
              phase: {
                type: "expedition",
                expedition: {
                  ...saved.snapshot.phase.expedition,
                  layer: layer.id,
                  at: "l5",
                  visited: ["s", "l5"],
                  pending: { kind: "discovery" },
                },
              },
            },
          })
          if (failed) throw failed
          return prepared(game, { name: "expedition" })
        },
      })),
    ...content.layers
      .filter((layer) => layer.no > 0)
      .map((layer) => ({
        slug: `route-layer-branch-${layer.no}`,
        title: `探索：${layer.name}の固有分岐`,
        start: () => {
          const game = progressed("branch")
          const saved = game.save()
          if (saved.snapshot.phase.type !== "expedition")
            throw new Error("探索ではない")
          const at =
            layer.no === 1
              ? "l5"
              : layer.no === 2
                ? "n10"
                : layer.no === 3
                  ? "n11"
                  : "l12"
          const failed = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              reached: layer.no,
              phase: {
                type: "expedition",
                expedition: {
                  ...saved.snapshot.phase.expedition,
                  layer: layer.id,
                  at,
                  visited: ["s", at],
                  pending: null,
                },
              },
            },
          })
          if (failed) throw failed
          return prepared(game, { name: "expedition" })
        },
      })),
    ...content.layers.map((layer, index) => ({
      slug: `battle-layer${index}`,
      title: `戦闘：${layer.name}の敵`,
      start: () => prepared(battleIn(index), { name: "expedition" }),
    })),
    ...[0, 2, 4].map((index) => ({
      slug: `mimic-chest-${index}`,
      title: `宝箱：${content.layers[index].name}のミミック`,
      start: () => prepared(mimicChest(index), { name: "expedition" }),
    })),
    {
      slug: "battle-slime",
      title: "戦闘：序盤のタールスライム",
      start: () => prepared(slimeBattle(), { name: "expedition" }),
    },
    {
      slug: "slime-individuals",
      title: "戦闘：タールスライムの個体差",
      start: () => prepared(slimeIndividuals(), { name: "expedition" }),
    },
    {
      slug: "slime-colors",
      title: "戦闘：黒・白・ヘドロスライム",
      start: () =>
        prepared(
          slimeIndividuals(["black-slime", "white-slime", "poison-slime"]),
          { name: "expedition" }
        ),
    },
    {
      slug: "route-retreat-bonus",
      title: "探索：中ボス後の持ち帰り手当て",
      start: () =>
        prepared(progressed("retreat-bonus"), { name: "expedition" }),
    },
    {
      slug: "route-loot-rare",
      title: "探索：戦利品（落とした武器・光るガラクタ）",
      start: () => prepared(rareLoot(), { name: "expedition" }),
    },
    {
      slug: "route",
      title: "探索：道のり図",
      start: () => prepared(departed(1), { name: "expedition" }),
    },
    {
      slug: "battle",
      title: "戦闘：敵1体",
      start: () => prepared(battle(1), { name: "expedition" }),
    },
    {
      slug: "battle-two",
      title: "戦闘：敵2体",
      start: () => prepared(battle(2), { name: "expedition" }),
    },
    {
      slug: "battle-armor",
      title: "戦闘：防具の耐久が減った隊列",
      start: () => prepared(armoredBattle(), { name: "expedition" }),
    },
  ]
}
