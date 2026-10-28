import { describe, expect, it } from "vite-plus/test"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { recruitBySlug } from "@/lib/wiz/testing/recruit-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realSmithy } from "@/lib/wiz/testing/real-smithy"
import { aState } from "@/lib/wiz/testing/state-builder"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { sequenceRandom } from "@/lib/wiz/testing/sequence-random"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameAction } from "@/lib/wiz/commands"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { baseSellPrice } from "@/lib/wiz/rules/base-sell-price"
import { stateSchema } from "@/lib/wiz/state/state-schema"

/** データの読み込みは一度だけにする（同じデータなら使い回す）。 */
const definitions = new Map<unknown, GameDefinition>()

function definitionOf(content: unknown) {
  const found = definitions.get(content)
  if (found) return found
  const created = new GameDefinition(content)
  definitions.set(content, created)
  return created
}

/** 乱数・IDを固定したプレイ。途中の状態から始められる。 */
function play(
  state: GameState,
  random: number | (() => number) = 0.5,
  content: unknown = realContent()
) {
  const roll = typeof random === "number" ? () => random : random
  let serial = 0
  return definitionOf(content).create(
    WizWorldEnvironment.create({
      random: roll,
      now: () => 0,
      nextId: () => `new-${++serial}`,
    }),
    state
  )
}

function code(result: readonly GameEvent[] | GameCommandError) {
  return result instanceof GameCommandError ? result.code : null
}

/** 変わった項目の名前。操作が触っていい範囲を確かめる。 */
function changed(before: GameState, after: GameState) {
  const keys = Object.keys(before) as (keyof GameState)[]
  return keys.filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
  )
}

/** 街でできる操作を一通り。拒否理由を確かめるときに使う。 */
function townActions(state: GameState): GameAction[] {
  return [
    { type: "rest", room: contentId("attic") },
    { type: "buy", shop: contentId("armory"), good: contentId("dagger") },
    { type: "sell", good: contentId("crystal") },
    { type: "sell", gear: state.gear[0]?.id ?? "なし" },
    { type: "appraise", shop: contentId("armory") },
    { type: "recruit", recruit: contentId("r-jig") },
    { type: "summon" },
    { type: "choose-demon", demon: contentId("nui") },
    { type: "reroll" },
    { type: "upgrade", gear: state.gear[0]?.id ?? "なし" },
    { type: "reforge", gear: "なし", material: "なし" },
    { type: "repair" },
    { type: "craft", recipe: "craft-potion" },
    { type: "accept-quest", quest: contentId("q-mole") },
    { type: "claim-quest", quest: contentId("q-mole") },
    { type: "chat", liked: state.party[0] },
    { type: "dismiss-wipe" },
    { type: "see-ending" },
  ]
}

describe("街の経済の不変条件", () => {
  it("[feature:W008] 買うと所持金と持ち物だけが変わり、買値ちょうどでも買える", () => {
    const game = play(aState().withGold(goodBySlug("dagger").price!).build())
    const before = game.state
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    expect(changed(before, game.state)).toEqual(["gold", "gear"])
    expect(game.state.gold).toBe(0)
    expect(game.state.gear.length).toBe(before.gear.length + 1)
    const tools = play(aState().withGold(goodBySlug("rope").price!).build())
    const beforeTools = tools.state
    eventsOrThrow(
      tools.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("rope"),
      })
    )
    expect(changed(beforeTools, tools.state)).toEqual(["gold", "bag"])
  })

  it("[feature:W008] 買えないときは所持金も持ち物も変わらない", () => {
    const game = play(
      aState()
        .withGold(goodBySlug("dagger").price! - 1)
        .build()
    )
    const state = game.state
    expect(
      code(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("dagger"),
        })
      )
    ).toBe("NO_GOLD")
    // その店にない品物・ない品物
    expect(
      code(
        game.send({
          type: "buy",
          shop: contentId("tools"),
          good: contentId("dagger"),
        })
      )
    ).toBe("UNKNOWN")
    expect(
      code(
        game.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("bone"),
        })
      )
    ).toBe("UNKNOWN")
    expect(
      code(game.send({ type: "buy", shop: "なし", good: contentId("dagger") }))
    ).toBe("UNKNOWN")
    expect(game.state).toBe(state)
  })

  it("[feature:W009] 売るのは袋の品物と誰も着けていない個体だけ", () => {
    const game = play(aState().build())
    const base = game.state
    const owned = base.gear.find((gear) => gear.owner)!
    expect(code(game.send({ type: "sell", gear: owned.id }))).toBe(
      "UNAVAILABLE"
    )
    expect(code(game.send({ type: "sell", gear: "なし" }))).toBe("NOT_OWNED")
    expect(code(game.send({ type: "sell", good: contentId("elixir") }))).toBe(
      "NOT_OWNED"
    )
    expect(code(game.send({ type: "sell", good: "なし" }))).toBe("UNKNOWN")
    expect(game.state).toBe(base)
    const potion = realContent().goods.find(
      (good) => good.id === contentId("potion")
    )!
    const before = game.state
    eventsOrThrow(game.send({ type: "sell", good: contentId("potion") }))
    expect(changed(before, game.state)).toEqual(["gold", "bag"])
    expect(game.state.gold).toBe(before.gold + baseSellPrice(potion))
  })

  it("[feature:W010] 鑑定はガラクタを一つ使うだけで、所持金は動かない", () => {
    const game = play(aState().withItem("junk", 1).build(), 0)
    const before = game.state
    const junk = game.queries.junk(before).count
    eventsOrThrow(game.send({ type: "appraise", shop: contentId("armory") }))
    expect(changed(before, game.state)).toEqual(["bag", "gear"])
    expect(game.queries.junk(game.state).count).toBe(junk - 1)
    expect(game.state.gold).toBe(before.gold)
    // ガラクタを使い切ると断られ、状態は変わらない
    const empty = play(aState().withItem("junk", 0).withBag([]).build())
    const emptyBefore = empty.state
    expect(
      code(empty.send({ type: "appraise", shop: contentId("armory") }))
    ).toBe("NO_JUNK")
    expect(empty.state).toBe(emptyBefore)
  })

  it("[feature:W010] 鑑定で出る武器の個体はレア度どおりの上振れとワザの数になる", () => {
    const table = realContent().balance.weapon.rarity
    for (let seed = 1; seed <= 40; seed++) {
      const game = play(
        aState().withItem("junk", 40).build(),
        seededRandom(seed)
      )
      for (let round = 0; round < 8; round++) {
        const events = eventsOrThrow(
          game.send({ type: "appraise", shop: contentId("armory") })
        )
        const event = events[0] as Extract<GameEvent, { type: "appraised" }>
        const gear = game.state.gear.find((entry) => entry.id === event.gear)
        if (!gear?.weapon) continue
        const good = realContent().goods.find(
          (entry) => entry.id === gear.good
        )!
        const { rarity, extraPower, skills } = gear.weapon
        expect(rarity).toBe(event.rarity)
        const power = good.power ?? 0
        expect(extraPower).toBeGreaterThanOrEqual(
          Math.round(power * table.powerRate[rarity][0])
        )
        expect(extraPower).toBeLessThanOrEqual(
          Math.round(power * table.powerRate[rarity][1])
        )
        expect(skills).toHaveLength(3)
        expect(new Set(skills).size).toBe(3)
        expect(skills[0]).toBe(good.skills![0])
        const pool = new Set([
          ...good.skills!.slice(1),
          ...realContent().weaponSkills[good.weaponType!],
        ])
        for (const skill of skills.slice(1)) expect(pool.has(skill)).toBe(true)
      }
    }
  })

  it("[feature:W011] 雇うと所持金・仲間・装備・契約済みが増え、二度は雇えない", () => {
    const game = play(aState().withGold(1000).withBoard(["r-jig"]).build())
    const before = game.state
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    // 通常のジグは装備を持たずに加入する。固有装備持ちは下のテストで確認。
    expect(changed(before, game.state).toSorted()).toEqual([
      "gold",
      "members",
      "recruited",
    ])
    expect(game.state.gear).toEqual(before.gear)
    expect(game.state.gold).toBe(before.gold - recruitBySlug("r-jig").price)
    expect(game.state.party).toEqual(before.party)
    expect(
      code(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    ).toBe("ALREADY")
    // 枠にいない募集は雇えない
    expect(
      code(game.send({ type: "recruit", recruit: contentId("r-alma") }))
    ).toBe("UNAVAILABLE")
    expect(code(game.send({ type: "recruit", recruit: "なし" }))).toBe(
      "UNKNOWN"
    )
  })

  it("[feature:W011] ユニークの仲間は固有の武器と装備を持って加わる", () => {
    const game = play(aState().withGold(1000).withBoard(["sr-husky"]).build())
    eventsOrThrow(
      game.send({ type: "recruit", recruit: contentId("sr-husky") })
    )
    const gear = game.state.gear.filter(
      (entry) => entry.owner === contentId("husky")
    )
    expect(gear.map((entry) => entry.good).toSorted()).toEqual(
      [contentId("iron-gloves"), contentId("mail")].toSorted()
    )
    const weapon = gear.find(
      (entry) => entry.good === contentId("iron-gloves")
    )!.weapon!
    const good = goodBySlug("iron-gloves")
    expect(weapon).toMatchObject({ rarity: "N", extraPower: 0 })
    expect(weapon.skills).toHaveLength(3)
    expect(new Set(weapon.skills).size).toBe(3)
    expect(weapon.skills[0]).toBe(good.skills![0])
    const pool = new Set([
      ...good.skills!.slice(1),
      ...realContent().weaponSkills[good.weaponType!],
    ])
    for (const skill of weapon.skills.slice(1))
      expect(pool.has(skill)).toBe(true)
  })

  it("[feature:W022] 引き直しは重ならない枠を作り、所持金だけ減らす", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = play(aState().withGold(1000).build(), seededRandom(seed))
      const before = game.state
      eventsOrThrow(game.send({ type: "reroll" }))
      // 引き直した枠が偶然同じ並びになることはある
      expect(
        changed(before, game.state).filter((key) => key !== "board")
      ).toEqual(["gold"])
      expect(game.state.gold).toBe(
        before.gold - realContent().recruiting.reroll
      )
      const board = game.state.board
      expect(new Set(board).size).toBe(board.length)
      expect(board).toHaveLength(
        Math.min(realContent().recruiting.slots, realContent().recruits.length)
      )
      for (const id of board)
        expect(realContent().recruits.map((entry) => entry.id)).toContain(id)
    }
  })

  it("[feature:W022] 所持金が足りなければ枠は変わらない", () => {
    const game = play(aState().withGold(29).build())
    const state = game.state
    expect(code(game.send({ type: "reroll" }))).toBe("NO_GOLD")
    expect(game.state).toBe(state)
  })

  it("[feature:W012] 石の有無にかかわらず旧ガチャを拒否し、保存を保持する", () => {
    for (const stones of [0, 1, 30]) {
      const game = play(aState().withStones(stones).build(), 0.99)
      const saved = game.save()
      expect(code(game.send({ type: "summon" }))).toBe("INVALID_ACTION")
      expect(game.save()).toEqual(saved)
    }
  })

  it("[feature:W012] 乱数と旧ガチャを連打しても悪魔・経験値・資産は変わらない", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const game = play(aState().withStones(30).build(), seededRandom(seed))
      const saved = game.save()
      for (let index = 0; index < 30; index++)
        expect(code(game.send({ type: "summon" }))).toBe("INVALID_ACTION")
      expect(game.save()).toEqual(saved)
    }
  })

  it("[feature:W013] 契約していない悪魔は選べない", () => {
    const game = play(aState().build())
    const state = game.state
    expect(
      code(game.send({ type: "choose-demon", demon: contentId("lox") }))
    ).toBe("NOT_OWNED")
    expect(code(game.send({ type: "choose-demon", demon: "なし" }))).toBe(
      "NOT_OWNED"
    )
    expect(game.state).toBe(state)
  })

  it("[feature:W023] 強化は段ごとの費用と素材を取り、上限で止まる", () => {
    const upgrades = realSmithy().upgrades
    // すべての段を払える分だけ持たせる
    const total = (good: string) =>
      upgrades
        .flatMap((cost) => cost.materials)
        .filter((material) => material.good === contentId(good))
        .reduce((sum, material) => sum + material.count, 0)
    const base = aState()
      .withGold(upgrades.reduce((sum, cost) => sum + cost.gold, 0))
      .withItem("bone", total("bone"))
      .withItem("cinder", total("cinder"))
      .build()
    const gear = base.gear[0]
    const game = play(base)
    for (const [index, cost] of upgrades.entries()) {
      const before = game.state
      const events = eventsOrThrow(
        game.send({ type: "upgrade", gear: gear.id })
      )
      expect(events).toEqual([
        { type: "upgraded", gear: gear.id, plus: index + 1 },
      ])
      expect(changed(before, game.state).toSorted()).toEqual([
        "bag",
        "gear",
        "gold",
      ])
      expect(game.state.gold).toBe(before.gold - cost.gold)
      for (const material of cost.materials)
        expect(
          game.state.bag.find((entry) => entry.good === material.good)?.count ??
            0
        ).toBe(
          (before.bag.find((entry) => entry.good === material.good)?.count ??
            0) - material.count
        )
    }
    const capped = game.state
    expect(code(game.send({ type: "upgrade", gear: gear.id }))).toBe("MAX")
    expect(code(game.send({ type: "upgrade", gear: "なし" }))).toBe("UNKNOWN")
    expect(game.state).toBe(capped)
  })

  it("[feature:W023] 防具を強化すると最大の耐久と今の耐久が同じだけ増え、減りはそのまま", () => {
    const shopping = play(aState().withGold(1000).build())
    eventsOrThrow(
      shopping.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("mail"),
      })
    )
    const armor = shopping.state.gear.find(
      (entry) => entry.good === contentId("mail")
    )!
    eventsOrThrow(
      shopping.send({
        type: "equip",
        gear: armor.id,
        member: contentId("alda"),
      })
    )
    const game = play({
      ...shopping.state,
      gold: 1000,
      bag: [{ good: contentId("bone"), count: 3 }],
      gear: shopping.state.gear.map((entry) =>
        entry.id === armor.id ? { ...entry, wear: 12 } : entry
      ),
    })
    const view = (state: GameState) =>
      game.queries.gear(state).find((entry) => entry.gear === armor.id)!.armor!
    const before = view(game.state)
    eventsOrThrow(game.send({ type: "upgrade", gear: armor.id }))
    const after = view(game.state)
    const step = realContent().balance.armor.durabilityPerPlus
    expect(after.maxDurability - before.maxDurability).toBe(step)
    expect(after.durability - before.durability).toBe(step)
    expect(after.wear).toBe(before.wear)
  })

  it("[feature:W026] 鍛え直しは素材を消し、上限で止まって手応えを持ち越さない", () => {
    const hired = play(aState().withGold(5000).withBoard(["sr-husky"]).build())
    eventsOrThrow(
      hired.send({ type: "recruit", recruit: contentId("sr-husky") })
    )
    const sword = hired.state.gear.find(
      (entry) => entry.good === contentId("iron-gloves")
    )!
    const rules = realContent().balance.unique
    const materials = Array.from({ length: 40 }, (_, index) => ({
      id: `mat-${index}`,
      good: contentId("old-sword"),
      owner: null,
      plus: 0,
      progress: 0,
      wear: 0,
      weapon: {
        rarity: "SR" as const,
        extraPower: 3,
        skills: realContent().goods.find(
          (good) => good.id === contentId("old-sword")
        )!.skills!,
      },
    }))
    const game = play({
      ...hired.state,
      gold: 5000,
      gear: [...hired.state.gear, ...materials],
    })
    let last: readonly GameEvent[] | GameCommandError = []
    for (const material of materials) {
      const before = game.state
      last = game.send({
        type: "reforge",
        gear: sword.id,
        material: material.id,
      })
      if (last instanceof GameCommandError) {
        expect(game.state).toBe(before)
        break
      }
      expect(changed(before, game.state).toSorted()).toEqual(["gear", "gold"])
      expect(game.state.gold).toBe(before.gold - rules.gold)
      expect(game.state.gear.some((entry) => entry.id === material.id)).toBe(
        false
      )
      const gear = game.state.gear.find((entry) => entry.id === sword.id)!
      expect(gear.progress).toBeLessThan(rules.progressPerStep)
      expect(gear.plus).toBeLessThanOrEqual(rules.maxPlus)
    }
    expect(code(last)).toBe("MAX")
    const gear = game.state.gear.find((entry) => entry.id === sword.id)!
    expect(gear.plus).toBe(rules.maxPlus)
    expect(gear.progress).toBe(0)
    // ふつうの強化では扱わない
    expect(code(game.send({ type: "upgrade", gear: sword.id }))).toBe(
      "FIXED_GEAR"
    )
  })

  it("[feature:W023] 素材だけ足りないときも所持金は減らない", () => {
    const game = play(aState().withGold(1000).withBag([]).build())
    const state = game.state
    expect(code(game.send({ type: "upgrade", gear: state.gear[0].id }))).toBe(
      "NO_MATERIALS"
    )
    expect(game.state).toBe(state)
  })

  it("[feature:W024] 生産は費用と素材を取り、足りなければ何も減らさない", () => {
    const game = play(
      aState()
        .withGold(9)
        .withBag([
          { good: contentId("cinder"), count: 1 },
          { good: contentId("bone"), count: 1 },
        ])
        .build()
    )
    const state = game.state
    expect(
      code(game.send({ type: "craft", recipe: contentId("craft-axe") }))
    ).toBe("NO_GOLD")
    expect(code(game.send({ type: "craft", recipe: "なし" }))).toBe("UNKNOWN")
    expect(game.state).toBe(state)
    const rich = play(aState().withGold(100).withBag([]).build())
    expect(
      code(rich.send({ type: "craft", recipe: contentId("craft-axe") }))
    ).toBe("NO_MATERIALS")
    const ready = play(
      aState()
        .withGold(
          realSmithy().recipes.find(
            (entry) => entry.id === contentId("craft-axe")
          )!.gold
        )
        .withBag([
          { good: contentId("cinder"), count: 1 },
          { good: contentId("bone"), count: 1 },
        ])
        .build()
    )
    const before = ready.state
    eventsOrThrow(ready.send({ type: "craft", recipe: contentId("craft-axe") }))
    expect(changed(before, ready.state).toSorted()).toEqual([
      "bag",
      "gear",
      "gold",
    ])
    expect(ready.state.gold).toBe(0)
    expect(ready.state.bag).toEqual([])
  })

  it("[feature:W025] 修理は一人ずつでも全部でも同じ費用で、足りなければ何も変えない", () => {
    const armed = play(aState().withGold(1000).build())
    for (const member of [contentId("alda"), contentId("mort")]) {
      eventsOrThrow(
        armed.send({
          type: "buy",
          shop: contentId("armory"),
          good: contentId("leather"),
        })
      )
      const gear = armed.state.gear.find(
        (entry) => entry.good === contentId("leather") && !entry.owner
      )!
      eventsOrThrow(armed.send({ type: "equip", gear: gear.id, member }))
    }
    const worn: GameState = {
      ...armed.state,
      gold: 1000,
      gear: armed.state.gear.map((entry) =>
        entry.good === contentId("leather") ? { ...entry, wear: 9 } : entry
      ),
    }
    const all = play(worn)
    const totals = all.queries.repairs(worn)
    const each = totals.rows.reduce((sum, row) => sum + row.gold, 0)
    // 費用は防具ごとに切り上げる（9点 → 5G が二つで10G、まとめて9Gにはしない）
    expect(each).toBe(10)
    const events = eventsOrThrow(all.send({ type: "repair" }))
    const repaired = events[0] as Extract<GameEvent, { type: "repaired" }>
    expect(repaired.gold).toBe(each)
    expect(repaired.durability).toBe(18)
    expect(all.state.gold).toBe(1000 - each)
    expect(all.state.gear.every((entry) => entry.wear === 0)).toBe(true)
    // 一人ずつ直しても合計は同じ
    const one = play(worn)
    let paid = 0
    for (const row of totals.rows.filter((entry) => entry.gold > 0)) {
      const before = one.state.gold
      eventsOrThrow(one.send({ type: "repair", member: row.member }))
      paid += before - one.state.gold
    }
    expect(paid).toBe(each)
    // お金が足りなければ耐久も所持金も変えない
    const poor = play({ ...worn, gold: each - 1 })
    const beforePoor = poor.state
    expect(code(poor.send({ type: "repair" }))).toBe("NO_GOLD")
    expect(poor.state).toBe(beforePoor)
    // 直すところがなければ断る
    expect(code(all.send({ type: "repair" }))).toBe("ALREADY")
    expect(code(all.send({ type: "repair", member: "なし" }))).toBe("UNKNOWN")
  })

  it("[feature:W007] 宿はHP・ワザの使用回数・状態を戻し、疲れと汚れは0〜100に収まる", () => {
    const state = aState()
      .withGold(100)
      .withMembers({
        hp: 1,
        used: [{ skill: realContent().skills[0].id, count: 2 }],
        status: [{ kind: "poison", turns: 3 }],
        fatigue: 100,
        dirt: 95,
      })
      .build()
    for (const room of [
      contentId("attic"),
      contentId("normal"),
      contentId("deluxe"),
    ]) {
      const game = play(state)
      eventsOrThrow(game.send({ type: "rest", room }))
      for (const member of game.state.members) {
        expect(member.used).toEqual([])
        expect(member.status).toEqual([])
        expect(member.hp).toBeGreaterThan(1)
        expect(member.fatigue).toBeGreaterThanOrEqual(0)
        expect(member.fatigue).toBeLessThanOrEqual(100)
        expect(member.dirt).toBeGreaterThanOrEqual(0)
        expect(member.dirt).toBeLessThanOrEqual(100)
      }
      expect(game.state.nights).toBe(state.nights + 1)
    }
  })

  it("[feature:W007] 経験値が多ければ一晩で何段でも上がり、能力は下がらない", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = aState().withGold(100).withMembers({ exp: 5000 }).build()
      const game = play(state, seededRandom(seed))
      eventsOrThrow(game.send({ type: "rest", room: contentId("normal") }))
      for (const member of game.state.members) {
        const before = state.members.find((entry) => entry.id === member.id)!
        if (member.id === contentId("hero")) {
          expect(member.lv).toBe(before.lv)
          expect(member.stats).toEqual(before.stats)
          expect(member.exp).toBe(before.exp)
          continue
        }
        expect(member.lv).toBeGreaterThan(before.lv)
        expect(member.stats.maxHp).toBeGreaterThan(before.stats.maxHp)
        expect(member.stats.str).toBeGreaterThanOrEqual(before.stats.str)
        expect(member.stats.tec).toBeGreaterThanOrEqual(before.stats.tec)
        expect(member.stats.spd).toBeGreaterThanOrEqual(before.stats.spd)
        expect(member.exp).toBeLessThan(
          Math.round(
            realContent().balance.expBase *
              member.lv ** realContent().balance.expPower
          )
        )
      }
    }
  })

  it("[feature:W016] 雑談は仲間ひとりにつき一晩に一度で、出撃メンバーだけを選べる", () => {
    const base = aState().build()
    const state: GameState = {
      ...base,
      nights: 1,
      members: [...base.members, { ...base.members[0], id: contentId("jig") }],
    }
    const game = play(state)
    const before = game.state
    eventsOrThrow(game.send({ type: "chat", liked: contentId("alda") }))
    expect(changed(before, game.state).toSorted()).toEqual([
      "chatted",
      "members",
    ])
    expect(
      game.state.members.find((member) => member.id === contentId("alda"))?.like
    ).toBe(1)
    // 同じ相手は今夜もう話せないが、ほかの仲間とは話せる
    expect(code(game.send({ type: "chat", liked: contentId("alda") }))).toBe(
      "ALREADY"
    )
    eventsOrThrow(game.send({ type: "chat", liked: contentId("mort") }))
    const next = play({ ...game.state, nights: 2 })
    expect(code(next.send({ type: "chat", liked: contentId("jig") }))).toBe(
      "UNKNOWN"
    )
    // 泊まる前は雑談できない
    const fresh = play(aState().build())
    expect(code(fresh.send({ type: "chat", liked: contentId("alda") }))).toBe(
      "NOT_READY"
    )
  })

  it("[feature:W014] [feature:W015] 依頼は一度だけ受け、達成してから一度だけ報告できる", () => {
    const game = play(aState().build())
    eventsOrThrow(
      game.send({ type: "accept-quest", quest: contentId("q-mole") })
    )
    expect(
      code(game.send({ type: "accept-quest", quest: contentId("q-mole") }))
    ).toBe("ALREADY")
    expect(code(game.send({ type: "accept-quest", quest: "なし" }))).toBe(
      "UNKNOWN"
    )
    expect(
      code(game.send({ type: "claim-quest", quest: contentId("q-mole") }))
    ).toBe("NOT_READY")
    expect(
      code(game.send({ type: "claim-quest", quest: contentId("q-skeleton") }))
    ).toBe("UNKNOWN")
    const quest = realContent().quests.find(
      (entry) => entry.id === contentId("q-mole")
    )!
    const done = play(
      aState().withQuest(contentId("q-mole"), quest.count).build()
    )
    const before = done.state
    eventsOrThrow(
      done.send({ type: "claim-quest", quest: contentId("q-mole") })
    )
    expect(changed(before, done.state).toSorted()).toEqual([
      "bag",
      "gold",
      "quests",
    ])
    expect(done.state.gold).toBe(before.gold + quest.reward.gold)
    for (const reward of quest.reward.goods)
      expect(
        done.state.bag.find((entry) => entry.good === reward.good)?.count ?? 0
      ).toBe(
        (before.bag.find((entry) => entry.good === reward.good)?.count ?? 0) +
          reward.count
      )
    expect(
      code(done.send({ type: "claim-quest", quest: contentId("q-mole") }))
    ).toBe("ALREADY")
  })

  it("[feature:W027] [feature:W028] 全滅と踏破の板は一度だけ閉じられる", () => {
    const wipe = play(
      aState()
        .withWipe({
          layer: contentId("layer0"),
          gold: 30,
          goods: [{ good: contentId("junk"), count: 1 }],
        })
        .build()
    )
    const before = wipe.state
    eventsOrThrow(wipe.send({ type: "dismiss-wipe" }))
    expect(changed(before, wipe.state)).toEqual(["wipe"])
    // 失った物は板を閉じても戻らない
    expect(wipe.state.gold).toBe(before.gold)
    expect(code(wipe.send({ type: "dismiss-wipe" }))).toBe("NOT_READY")
    const ending = play(aState().withCleared(true).build())
    const beforeEnding = ending.state
    eventsOrThrow(ending.send({ type: "see-ending" }))
    expect(changed(beforeEnding, ending.state)).toEqual(["endingSeen"])
    expect(code(ending.send({ type: "see-ending" }))).toBe("NOT_READY")
    // 踏破していなければ見られない
    const playing = play(aState().build())
    expect(code(playing.send({ type: "see-ending" }))).toBe("NOT_READY")
  })

  it("街の操作は探索中・戦闘中には通らない（WRONG_PHASE）", () => {
    for (const state of [
      aState().inExpedition().build(),
      aState()
        .inBattle({ foes: ["kamokutsu"] })
        .build(),
    ])
      for (const action of townActions(state)) {
        const game = play(state)
        const before = game.state
        expect(code(game.send(action)), action.type).toBe("WRONG_PHASE")
        expect(game.state).toBe(before)
      }
  })

  it("形の違う操作は受け取らない（INVALID_ACTION）", () => {
    const game = play(aState().build())
    const state = game.state
    const broken: unknown[] = [
      { type: "buy", shop: contentId("armory") },
      {
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
        extra: 1,
      },
      { type: "sell" },
      { type: "sell", good: contentId("potion"), gear: "new-1" },
      { type: "rest" },
      { type: "rest", room: "" },
      { type: "upgrade", gear: 1 },
      { type: "chat", liked: null },
      { type: "reforge", gear: "a" },
    ]
    for (const action of broken) {
      expect(
        (game.sendUnknown(action) as GameCommandError).code,
        JSON.stringify(action)
      ).toBe("INVALID_ACTION")
      expect(game.state).toBe(state)
    }
  })

  it("同じ乱数の台本なら街の操作はいつも同じ結果になる", () => {
    const script = [0.3, 0.8, 0.4, 0.62, 0.17, 0.95, 0.5]
    const run = () => {
      const game = play(
        aState().withGold(500).withItem("junk", 3).build(),
        sequenceRandom(script)
      )
      const events: GameEvent[] = []
      for (const action of [
        { type: "appraise", shop: contentId("armory") },
        { type: "reroll" },
        { type: "rest", room: contentId("normal") },
      ] as GameAction[])
        events.push(...eventsOrThrow(game.send(action)))
      return { events, state: game.state }
    }
    const first = run()
    const second = run()
    expect(first.events).toEqual(second.events)
    expect(first.state).toEqual(second.state)
  })

  it("でたらめに街の操作を送っても状態は形を保ち、保存して読み戻せる", () => {
    const problems: string[] = []
    for (let seed = 1; seed <= 10; seed++) {
      const random = seededRandom(seed)
      const game = play(
        aState()
          .withGold(900)
          .withStones(6)
          .withItem("bone", 9)
          .withItem("cinder", 9)
          .withItem("junk", 9)
          .build(),
        random
      )
      for (let step = 0; step < 24; step++) {
        const before = game.state
        const pool: GameAction[] = [
          ...townActions(before),
          { type: "rest", room: contentId("normal") },
          { type: "buy", shop: contentId("armory"), good: contentId("mail") },
          { type: "craft", recipe: contentId("craft-axe") },
          ...before.gear.map((gear): GameAction => ({
            type: "upgrade",
            gear: gear.id,
          })),
          ...before.gear.map((gear): GameAction => ({
            type: "sell",
            gear: gear.id,
          })),
          ...before.gear.flatMap((gear): GameAction[] =>
            before.members.map((member) => ({
              type: "equip",
              gear: gear.id,
              member: member.id,
            }))
          ),
        ]
        const action = pool[Math.floor(random() * pool.length)]
        const result = game.send(action)
        const after = game.state
        const label = `seed ${seed} step ${step} ${JSON.stringify(action)}`
        if (result instanceof GameCommandError) {
          if (after !== before) problems.push(`拒否で状態が変わった: ${label}`)
          continue
        }
        const parsed = stateSchema.safeParse(after)
        if (!parsed.success) problems.push(`形に合わない状態: ${label}`)
        if (after.gold < 0) problems.push(`所持金が負: ${label}`)
        if (after.stones < 0) problems.push(`召喚石が負: ${label}`)
        if (after.bag.some((entry) => entry.count <= 0))
          problems.push(`袋に0個の束が残った: ${label}`)
        const ids = after.gear.map((gear) => gear.id)
        if (new Set(ids).size !== ids.length)
          problems.push(`装備のidが重なった: ${label}`)
        for (const gear of after.gear) {
          if (gear.wear < 0) problems.push(`耐久の減りが負: ${label}`)
          if (
            gear.weapon &&
            (gear.weapon.skills.length !== 3 ||
              new Set(gear.weapon.skills).size !== 3)
          )
            problems.push(`個体のワザが重なった: ${label}`)
        }
        if (step % 4 !== 0) continue
        const save = JSON.parse(JSON.stringify(game.save()))
        if (game.restore(save)) problems.push(`保存を読み戻せない: ${label}`)
        if (JSON.stringify(game.state) !== JSON.stringify(after))
          problems.push(`保存を通すと状態が変わった: ${label}`)
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
  })
})
