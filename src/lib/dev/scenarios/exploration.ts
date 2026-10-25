import { GameCommandError, inPhase, type Game } from "@/lib/wiz"

import { Bag } from "@/lib/wiz/rules/bag"

import type { PreviewContext } from "./context"
import type { createCombatScenarios } from "./combat"
export function createExplorationScenarios(
  context: PreviewContext,
  combat: Pick<ReturnType<typeof createCombatScenarios>, "departed">
) {
  const { content, play, firstLayer } = context
  const { departed } = combat
  /** 実際の宝箱抽選でミミックになる種を探し、開ける直前を展示する。 */
  function mimicChest(layerIndex: number): Game {
    const layer = content.layers[layerIndex]
    const station = layer.stations.find(
      (entry) => !entry.event && !entry.boss && entry.id !== layer.start
    )!
    const source = layer.stations.find((entry) =>
      entry.next.includes(station.id)
    )!
    for (let seed = 1; seed <= 500; seed++) {
      const game = play(seed)
      const saved = game.save()
      const ready = {
        ...saved,
        snapshot: {
          ...saved.snapshot,
          reached: content.layers.length - 1,
          phase: {
            type: "expedition" as const,
            expedition: {
              layer: layer.id,
              at: source.id,
              visited: [layer.start, source.id],
              events: [],
              pending: null,
              loot: { gold: 0, goods: [] },
              cleared: false,
            },
          },
        },
      }
      const failed = game.restore(ready)
      if (failed) throw failed
      const step = inPhase(game, "expedition")?.advance(station.id)
      if (step instanceof GameCommandError) continue
      if (
        game.state.phase.type !== "battle" ||
        game.state.phase.battle.foes[0]?.foe !== layer.treasure.mimic?.foe
      )
        continue
      // 同じ種からプレイを作り直し、試しに開けた分の乱数も戻す。
      const before = play(seed)
      const reset = before.restore(ready)
      if (reset) throw reset
      return before
    }
    throw new Error("ミミックの宝箱の場面を作れない")
  }

  /** 戦利品に、敵が落とした SR の武器と光るガラクタが混ざった場面（当たりの演出の確認用）。 */
  function rareLoot(): Game {
    const game = progressed("loot")
    const saved = game.save()
    const phase = saved.snapshot.phase
    const rare = content.rareJunk
    if (
      phase.type !== "expedition" ||
      phase.expedition.pending?.kind !== "loot"
    )
      throw new Error("戦利品の場面を作れない")
    if (!rare) throw new Error("光るガラクタがない")
    // 展示用に戦利品へ光るガラクタと落とした武器を足す。ゲームの抽選規則は変えない。
    const pending = phase.expedition.pending
    const weapon = content.goods.find(
      (good) => good.kind === "weapon" && good.price !== undefined
    )
    if (!weapon) throw new Error("武器がない")
    const dropped = {
      id: "preview-drop",
      good: weapon.id,
      owner: null,
      plus: 0,
      progress: 0,
      wear: 0,
      weapon: {
        rarity: "SR" as const,
        extraPower: Math.round((weapon.power ?? 0) * 0.25),
        skills: [...(weapon.skills ?? [])].slice(0, 3),
      },
    }
    const failed = game.restore({
      ...saved,
      snapshot: {
        ...saved.snapshot,
        bag: Bag.add(saved.snapshot.bag, [{ good: rare, count: 1 }]),
        gear: [...saved.snapshot.gear, dropped],
        phase: {
          ...phase,
          expedition: {
            ...phase.expedition,
            pending: {
              ...pending,
              goods: [...pending.goods, { good: rare, count: 1 }],
              weapons: [dropped.id],
            },
            loot: {
              ...phase.expedition.loot,
              goods: Bag.add(phase.expedition.loot.goods, [
                { good: rare, count: 1 },
              ]),
              weapons: [...(phase.expedition.loot.weapons ?? []), dropped.id],
            },
          },
        },
      },
    })
    if (failed) throw failed
    return game
  }

  /** 通常のコマンドを通して、探索中の構造が異なる場面まで進める。 */
  function progressed(
    kind:
      | "loot"
      | "treasure"
      | "discovery"
      | "trap"
      | "branch"
      | "chest-branch"
      | "midboss"
      | "boss"
      | "cleared"
      | "retreat-bonus"
  ): Game {
    for (let seed = 1; seed <= 100; seed++) {
      const game = departed(seed)
      for (let step = 0; step < 500; step++) {
        if (game.state.phase.type === "town") break
        // 深い地点用のモックは、準備中だけ健康な状態を注入する。
        // ボスの能力・与ダメージ・勝敗判定は本番エンジンのまま。
        if (
          (kind === "boss" ||
            kind === "cleared" ||
            kind === "retreat-bonus" ||
            kind === "chest-branch") &&
          game.state.phase.type === "battle"
        ) {
          const saved = game.save()
          const failed = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              members: saved.snapshot.members.map((member) => ({
                ...member,
                hp: member.stats.maxHp,
                used: [],
                fatigue: 0,
                dirt: 0,
                status: [],
              })),
            },
          })
          if (failed) throw failed
        }
        const view = game.queries.battle(game.state)
        // 戦闘中は探索の分岐・出来事を判定しない。各手番で道のり全体を再計算しない。
        const route = view ? null : game.queries.route(game.state)
        if (
          route?.pending?.kind === kind ||
          (kind === "branch" &&
            !view &&
            !route?.pending &&
            (route?.choices.length ?? 0) > 1) ||
          (kind === "chest-branch" &&
            !view &&
            !route?.pending &&
            (route?.choices.length ?? 0) > 1 &&
            content.layers
              .find((layer) => layer.id === route?.layer.id)
              ?.stations.some(
                (station) =>
                  route?.choices.includes(station.id) &&
                  station.event === "treasure"
              )) ||
          (kind === "cleared" && route?.cleared && route.atEnd) ||
          (kind === "midboss" && view?.midboss) ||
          (kind === "boss" && view?.boss) ||
          (kind === "retreat-bonus" &&
            route?.passedMidboss &&
            !route.pending &&
            !route.atEnd)
        )
          return game
        if (view) {
          if (view.current.kind === "foe") {
            if (
              inPhase(game, "foe-turn")?.resolve() instanceof GameCommandError
            )
              break
          } else {
            const commands = game.queries.commands(game.state, view.current.id)
            const hit = [
              ...(commands?.weaponSkills ?? []),
              ...(commands?.skills ?? []),
            ].find((entry) => entry.kind === "hit" && entry.usable)
            const turn = inPhase(game, "member-turn")
            const result = hit ? turn?.skill(hit.id) : turn?.brawl()
            if (!result || result instanceof GameCommandError) break
          }
        } else if (inPhase(game, "pending")) {
          if (
            (game.queries.route(game.state)?.discovery
              ? inPhase(game, "pending")?.discover(
                  game.queries
                    .route(game.state)!
                    .discovery!.choices.find(
                      (choice) => choice.available && !choice.blessings
                    )!.id
                )
              : inPhase(game, "pending")?.acknowledge()) instanceof
            GameCommandError
          )
            break
          // 深い地点の配置を検証するための健康な隊列。能力・戦闘規則は変えない。
          if (
            kind === "boss" ||
            kind === "cleared" ||
            kind === "midboss" ||
            kind === "retreat-bonus"
          ) {
            const saved = game.save()
            const failed = game.restore({
              ...saved,
              snapshot: {
                ...saved.snapshot,
                members: saved.snapshot.members.map((member) => ({
                  ...member,
                  hp: member.stats.maxHp,
                  used: [],
                  fatigue: 0,
                  dirt: 0,
                  status: [],
                })),
              },
            })
            if (failed) throw failed
          }
        } else {
          // 罠の展示は未知の道を優先する。通常の分岐選択と抽選で到達する。
          const next =
            (kind === "trap"
              ? route?.paths.find((path) => path.danger === "不明")?.id
              : undefined) ?? route?.choices[0]
          if (
            !next ||
            inPhase(game, "expedition")?.advance(next) instanceof
              GameCommandError
          )
            break
        }
      }
    }
    throw new Error(`探索の状態を作れない: ${kind}`)
  }

  /** 全滅の結果が出ている街。失った物は状態の wipe に入れる（規則は変えない）。 */
  function wiped(): Game {
    const game = play(1)
    const saved = game.save()
    const lost = content.goods.find((good) => good.kind === "material")!
    const failed = game.restore({
      ...saved,
      snapshot: {
        ...saved.snapshot,
        members: saved.snapshot.members.map((member) => ({ ...member, hp: 1 })),
        wipe: {
          layer: firstLayer(),
          gold: 186,
          goods: [{ good: lost.id, count: 2 }],
          // 全滅しても持ち帰れたガラクタ（balance.wipe.keepJunk）
          kept: [{ good: content.junk, count: 3 }],
        },
      },
    })
    if (failed) throw failed
    return game
  }

  /** 最後の層を踏破した直後の街（エンディングの確認用）。 */
  function endingReached(): Game {
    const game = play(1)
    const saved = game.save()
    const failed = game.restore({
      ...saved,
      snapshot: {
        ...saved.snapshot,
        reached: content.layers.length - 1,
        lastLayer: content.layers[content.layers.length - 1].id,
        cleared: true,
        endingSeen: false,
      },
    })
    if (failed) throw failed
    return game
  }
  return { mimicChest, rareLoot, progressed, wiped, endingReached }
}
