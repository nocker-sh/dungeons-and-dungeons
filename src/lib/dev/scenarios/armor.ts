import { GameCommandError, inPhase, type Game } from "@/lib/wiz"

import type { PreviewContext } from "./context"
export function createArmorScenarios(context: PreviewContext) {
  const { content, play, firstLayer } = context
  /** 出撃前に、3人へ店の防具を買って着ける（耐久ゲージの確認用）。所持金は展示用に足す。 */
  function equipArmor(game: Game) {
    const saved = game.save()
    const failed = game.restore({
      ...saved,
      snapshot: { ...saved.snapshot, gold: 4000 },
    })
    if (failed) throw failed
    const armors = content.goods.filter((good) => good.kind === "armor")
    const shop = content.shops.find((entry) =>
      armors.some((armor) => entry.goods.includes(armor.id))
    )
    if (!shop) throw new Error("防具を売る店がない")
    for (const [index, member] of game.state.party.entries()) {
      if (content.party.find((entry) => entry.id === member)?.hero) continue
      const job = game.queries.member(game.state, member)?.job
      const choices = armors.filter(
        (armor) =>
          (armor.unlock ?? 0) <= game.state.reached &&
          (!armor.allowedJobs || armor.allowedJobs.includes(job ?? ""))
      )
      const armor = choices[index % choices.length]
      if (!armor) continue
      const before = new Set(game.state.gear.map((gear) => gear.id))
      const bought = inPhase(game, "town")?.buy(shop.id, armor.id)
      if (!bought || bought instanceof GameCommandError) continue
      const gear = game.state.gear.find((entry) => !before.has(entry.id))
      if (gear) inPhase(game, "town")?.equip(gear.id, member)
    }
  }

  /** 防具の耐久が減った状態の戦闘。敵の手番を一度通してから仲間の手番で止める。 */
  function armoredBattle(): Game {
    for (let seed = 1; seed < 500; seed++) {
      const game = play(seed)
      equipArmor(game)
      if (
        game.queries
          .party(game.state)
          .some(
            (member) =>
              !content.party.find((entry) => entry.id === member.id)?.hero &&
              !member.armor
          )
      )
        continue
      const departed = inPhase(game, "town")?.depart(firstLayer())
      if (!departed || departed instanceof GameCommandError) continue
      const arrived = inPhase(game, "expedition")?.advance("n1")
      if (!arrived || arrived instanceof GameCommandError) continue
      // 敵の手番を一巡させる。倒れる前に止める
      for (let step = 0; step < 12; step++) {
        const view = game.queries.battle(game.state)
        if (!view) break
        const done =
          game.queries
            .party(game.state)
            .some((member) => member.armor && member.armor.wear > 0) &&
          view.current.kind === "member"
        if (done) return game
        const turn =
          view.current.kind === "foe"
            ? inPhase(game, "foe-turn")?.resolve()
            : inPhase(game, "member-turn")?.guard()
        if (!turn || turn instanceof GameCommandError) break
      }
    }
    throw new Error("防具の耐久が減った戦闘を作れない")
  }

  /** 防具の耐久が減ったまま街へ戻った状態（鍛冶屋の「修理」の確認用）。 */
  function armoredTown(): Game {
    const game = armoredBattle()
    for (let step = 0; step < 120 && game.state.phase.type !== "town"; step++) {
      const view = game.queries.battle(game.state)
      if (view) {
        if (view.current.kind === "foe") {
          if (inPhase(game, "foe-turn")?.resolve() instanceof GameCommandError)
            break
          continue
        }
        const commands = game.queries.commands(game.state, view.current.id)
        const hit = [
          ...(commands?.weaponSkills ?? []),
          ...(commands?.skills ?? []),
        ].find((skill) => skill.kind === "hit" && skill.usable)
        const turn = inPhase(game, "member-turn")
        const acted = hit ? turn?.skill(hit.id) : turn?.brawl()
        if (!acted || acted instanceof GameCommandError) break
        continue
      }
      if (inPhase(game, "pending")) {
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
        continue
      }
      if (inPhase(game, "expedition")?.retreat() instanceof GameCommandError)
        break
    }
    return game
  }
  return { equipArmor, armoredBattle, armoredTown }
}
