import { Session } from "@/../builder/lib/session"
import { arenaContent, fightToEnd, newTally } from "@/../builder/lib/simulate"
import { buyGear, equipBestWeapon, startParty } from "@/../builder/lib/policy"
import { WeaponRules } from "@/lib/wiz/rules"
import type { Rarity } from "@/lib/wiz/content"

/** 同じ育成・装備条件で、複数の編成と全現役キャラの戦闘を比較する。 */
export class RosterTrials {
  /** overrides：--set と同じ書き方の上書き（調整の案を試す）。 */
  constructor(private readonly overrides: readonly string[] = []) {}

  run(party: readonly string[], level: number, runs: number) {
    return this.runScenario(
      party,
      {
        level,
        reached: level === 6 ? 0 : 1,
        foes: level === 6 ? ["haribote-adult"] : ["kabemimi", "kabemimi"],
        boss: level === 6,
        plus: 0,
      },
      runs
    )
  }

  runScenario(
    party: readonly string[],
    scenario: {
      level: number
      reached: number
      foes: readonly string[]
      boss: boolean
      plus: number
      seed?: number
      rarity?: Rarity
    },
    runs: number
  ) {
    const built = arenaContent(this.overrides, scenario.foes, scenario.boss)
    const outcomes = []
    for (let seed = 1; seed <= runs; seed++) {
      const session = new Session(built, seed + (scenario.seed ?? 1) - 1)
      this.prepare(session, party, scenario)
      session.must({ type: "depart", layer: "arena" })
      session.must({ type: "advance", to: "n1" })
      const tally = newTally()
      const fight = fightToEnd(session, "smart", tally)
      const members = session.queries.party(session.state)
      outcomes.push({
        seed: seed + (scenario.seed ?? 1) - 1,
        won: fight.won,
        rounds: fight.rounds,
        lowestHp: Math.round(fight.lowest * 100),
        hp:
          members.reduce((sum, member) => sum + member.hp, 0) /
          members.reduce((sum, member) => sum + member.maxHp, 0),
        damage: [...tally.damage.values()].reduce(
          (sum, value) => sum + value,
          0
        ),
        healing: [...tally.healing.values()].reduce(
          (sum, value) => sum + value,
          0
        ),
        actions: fight.actions,
      })
    }
    return {
      party,
      level: scenario.level,
      outcomes,
      runs,
      wins: outcomes.filter((outcome) => outcome.won).length,
      hp: Math.round(
        (outcomes.reduce((sum, outcome) => sum + outcome.hp, 0) / runs) * 100
      ),
      damage: Math.round(
        outcomes.reduce((sum, outcome) => sum + outcome.damage, 0) / runs
      ),
      healing: Math.round(
        outcomes.reduce((sum, outcome) => sum + outcome.healing, 0) / runs
      ),
      rarity: scenario.rarity ?? "N",
    }
  }

  private prepare(
    session: Session,
    party: readonly string[],
    scenario: { level: number; reached: number; plus: number; rarity?: Rarity }
  ) {
    session.patch((state) => {
      state.gold = 100000
    })
    for (const slug of party) {
      const id = session.id(slug)
      if (session.state.members.some((member) => member.id === id)) continue
      const recruit = session.catalog.data.recruits.find(
        (entry) => entry.member.id === id && !entry.retired
      )
      if (!recruit) throw new Error(`募集がない：${slug}`)
      session.patch((state) => {
        state.board = [recruit.id]
      })
      session.must({ type: "recruit", recruit: recruit.id })
    }
    session.patch((state) => {
      state.party = party.map((slug) => session.id(slug))
      state.reached = scenario.reached
    })
    startParty(session)
    session.levelTo(scenario.level)
    buyGear(session, 0)
    equipBestWeapon(session)
    for (const weapon of session.queries.reforges(session.state)) {
      for (let step = 0; step < 60; step++) {
        const current = session.state.gear.find(
          (gear) => gear.id === weapon.gear
        )
        if (!current || current.plus >= scenario.plus) break
        session.must({
          type: "buy",
          shop: session.id("armory"),
          good: session.id("greatsword"),
        })
        const material = session.state.gear.at(-1)!
        session.must({
          type: "reforge",
          gear: weapon.gear,
          material: material.id,
        })
      }
    }
    // ふつうの仲間の武器も強化する（上限は鍛冶屋の段の数。ユニークは鍛え直しで伸ばす）
    const maxPlus = session.catalog.data.smithy?.upgrades.length ?? 0
    const fixed = new Set(
      session.queries.reforges(session.state).map((entry) => entry.gear)
    )
    session.patch((state) => {
      for (const gear of state.gear)
        if (
          gear.owner &&
          state.party.includes(gear.owner) &&
          gear.weapon &&
          !fixed.has(gear.id)
        )
          gear.plus = Math.max(gear.plus, Math.min(scenario.plus, maxPlus))
    })
    // 武器とワザを固定した対照条件。入手頻度とは分けて個体の上振れ・回数だけを比べる。
    if (scenario.rarity) {
      const weapons = new WeaponRules(session.catalog)
      const rarity = scenario.rarity
      session.patch((state) => {
        for (const gear of state.gear) {
          if (
            !gear.owner ||
            !state.party.includes(gear.owner) ||
            !gear.weapon ||
            fixed.has(gear.id)
          )
            continue
          const good = session.catalog.good(gear.good)!
          gear.weapon = {
            ...gear.weapon,
            rarity,
            extraPower: weapons.rollExtraPower(good, rarity, () => 0.5),
          }
        }
      })
    }
  }
}
