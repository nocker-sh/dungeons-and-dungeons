import { expect, test } from "vite-plus/test"
import { Inscribe } from "@/lib/wiz/application/town/inscribe"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameQueries } from "@/lib/wiz/queries/game-queries"
import { realContent } from "@/lib/wiz/testing/real-content"
import { aState } from "@/lib/wiz/testing/state-builder"

const content = realContent()
const definition = new GameDefinition(content)
const roster = aState(definition.catalog).build()
const book = content.smithy!.skillBook!

test("武器に無い枠への付け替えはスキルの書を使わずに断る", () => {
  const good = content.goods.find(
    (entry) =>
      entry.kind === "weapon" &&
      definition.rules.weapons.pool(entry).length > 0
  )!
  const full = definition.rules.weapons.forGood(good, () => 0.5)!
  const weapon = { ...full, skills: full.skills.slice(0, 1) }
  const gear = {
    id: "short-weapon",
    good: good.id,
    plus: 0,
    progress: 0,
    wear: 0,
    owner: null,
    weapon,
  }
  const state = {
    ...roster,
    gear: [...roster.gear, gear],
    bag: [{ good: book, count: 1 }],
  }
  const skill = definition.rules.weapons
    .pool(good)
    .find((id) => !weapon.skills.includes(id))!
  const inscribe = new Inscribe(definition.rules)
  for (const slot of [1, 2])
    expect(
      inscribe.execute(state, { type: "inscribe", gear: gear.id, slot, skill })
    ).toEqual({ accepted: false, reason: "NO_TARGET" })
})

test("ユニークの専用の武器はワザを付け替えられず、スキルの書も減らない", () => {
  const unique = content.recruits.find(
    (recruit) => recruit.member.unique && recruit.member.weapon
  )!.member
  const good = content.goods.find((entry) => entry.id === unique.weapon)!
  const weapon = definition.rules.weapons.forGood(good, () => 0.5)!
  const gear = {
    id: "signature",
    good: good.id,
    plus: 0,
    progress: 0,
    wear: 0,
    owner: unique.id,
    weapon,
  }
  const state = {
    ...roster,
    gear: [...roster.gear, gear],
    bag: [{ good: book, count: 1 }],
  }
  const skill =
    definition.rules.weapons
      .pool(good)
      .find((id) => !weapon.skills.includes(id)) ?? content.skills[0]!.id
  const inscribe = new Inscribe(definition.rules)
  expect(
    inscribe.execute(state, { type: "inscribe", gear: gear.id, slot: 1, skill })
  ).toEqual({ accepted: false, reason: "UNAVAILABLE" })
  expect(
    new GameQueries(
      definition.catalog,
      definition.rules.party,
      definition.rules.weapons,
      definition.rules.expedition
    )
      .inscriptions(state)!
      .inscriptions.some((entry) => entry.gear === gear.id)
  ).toBe(false)
})
