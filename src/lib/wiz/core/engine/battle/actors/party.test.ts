import { describe, expect, it } from "vite-plus/test"
import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/effects"
import { WizEmptyPartyError } from "@/lib/wiz/core/errors"

const createStatus = (hp = 100) =>
  WizBattleActorState.create({
    attributes: { attack: 20, defense: 15, speed: 10 },
    resources: {
      health: { current: hp, maximum: 100 },
      mana: { current: 50, maximum: 50 },
    },
    custom: {},
  })

const createCharacter = (id: string, hp = 100) =>
  new WizBattleCharacter({
    id,
    name: `Hero ${id}`,
    custom: {},
    status: createStatus(hp),
    effects: WizEffectSet.create(),
  })

const createParty = () =>
  new WizBattleParty({
    id: "party-1",
    members: [
      createCharacter("char-1", 100),
      createCharacter("char-2", 50),
      createCharacter("char-3", 0),
    ],
  })

describe("constructor", () => {
  it("throws WizEmptyPartyError when members is empty", () => {
    expect(() => new WizBattleParty({ id: "party-1", members: [] })).toThrow(WizEmptyPartyError)
  })
})

describe("getAliveCount", () => {
  it("returns count of alive members", () => {
    const party = createParty()
    expect(party.getAliveCount()).toBe(2)
  })
})

describe("getTotalCount", () => {
  it("returns total count of members", () => {
    const party = createParty()
    expect(party.getTotalCount()).toBe(3)
  })
})

describe("getAliveMembers", () => {
  it("returns only alive members", () => {
    const party = createParty()
    const alive = party.getAliveMembers()
    expect(alive).toHaveLength(2)
    expect(alive.every((m) => m.isAlive())).toBe(true)
  })
})

describe("getMemberById", () => {
  it("returns member when found", () => {
    const party = createParty()
    const member = party.getMemberById("char-1")
    expect(member?.id).toBe("char-1")
  })

  it("returns undefined when not found", () => {
    const party = createParty()
    const member = party.getMemberById("char-999")
    expect(member).toBeUndefined()
  })
})

describe("requireMemberById", () => {
  it("returns member when found", () => {
    const party = createParty()
    const member = party.requireMemberById("char-1")
    expect(member.id).toBe("char-1")
  })

  it("throws when not found", () => {
    const party = createParty()
    expect(() => party.requireMemberById("char-999")).toThrow()
  })
})

describe("withDamageToMember", () => {
  it("damages specific member", () => {
    const party = createParty()
    const damaged = party.withDamageToMember("char-1", 30)
    expect(damaged.getMemberById("char-1")?.status.resources.current("health")).toBe(70)
  })
})

describe("withHealToMember", () => {
  it("heals specific member", () => {
    const party = createParty()
    const healed = party.withHealToMember("char-2", 30)
    expect(healed.getMemberById("char-2")?.status.resources.current("health")).toBe(80)
  })
})

describe("getDeadMembers", () => {
  it("returns only dead members", () => {
    const party = createParty()
    const dead = party.getDeadMembers()
    expect(dead).toHaveLength(1)
    expect(dead[0].id).toBe("char-3")
  })
})

describe("isDefeated", () => {
  it("returns false when some members are alive", () => {
    const party = createParty()
    expect(party.isDefeated()).toBe(false)
  })

  it("returns true when all members are dead", () => {
    const party = new WizBattleParty({
      id: "party-1",
      members: [createCharacter("char-1", 0)],
    })
    expect(party.isDefeated()).toBe(true)
  })
})

describe("hasAllLivingMembersFled", () => {
  it("生存中の全メンバーが逃走している場合だけtrueを返す", () => {
    const fledEffect = createBattleEffect({
      instanceId: "fled-char-1",
      effectId: "fled",
      source: { kind: "system", id: "party-test" },
      name: "Fled",
      lifetime: { type: "permanent" },
    })
    const party = new WizBattleParty({
      id: "party-1",
      members: [createCharacter("char-1").withEffect(fledEffect), createCharacter("char-2", 0)],
    })

    expect(party.hasAllLivingMembersFled()).toBe(true)
    expect(createParty().hasAllLivingMembersFled()).toBe(false)
  })
})

describe("immutability", () => {
  it("is frozen", () => {
    const party = createParty()
    expect(Object.isFrozen(party)).toBe(true)
  })

  it("returns new instance on modification", () => {
    const original = createParty()
    const modified = original.withDamageToMember("char-1", 10)
    expect(modified).not.toBe(original)
  })

  it("does not retain a mutable source array", () => {
    const members = [createCharacter("char-1")]
    const party = new WizBattleParty({ id: "party-1", members })

    members.push(createCharacter("char-2"))

    expect(party.getTotalCount()).toBe(1)
    expect(Object.isFrozen(party.members)).toBe(true)
  })
})
