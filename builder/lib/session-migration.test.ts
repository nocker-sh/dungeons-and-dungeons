import { expect, test } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { buildContent } from "@/builder/lib/build-content"
import { parseCommand } from "@/builder/lib/commands"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import type { GameState } from "@/lib/wiz/state/state-schema"

for (const version of ["current", "previous", "legacy"] as const)
  test(`${version}: rewards allocated during battle migration cannot collide with saved equipment`, () => {
    const built = buildContent()
    const source = new Session(built, 42)
    source.serial = 1000
    source.must(parseCommand(source, "buy armory sword"))
    const owned = source.state.gear.find((gear) => gear.id === "g1001")!
    expect(owned).toBeDefined()
    const [hero, alda, mayu, mort] = ["hero", "alda", "mayu", "mort"].map(
      contentId
    )
    const base = aState()
      .withJoined("mayu")
      .inBattle({
        foes: ["kamokutsu", "kamokutsu"],
        order: ["mort", "hero", "foe-1", "alda", "foe-2", "mayu"],
      })
      .build()
    if (base.phase.type !== "battle") throw Error("Expected battle")
    // A supported four-person save at an expiring bound/poison turn is a local restoration fixture.
    const snapshot: GameState = {
      ...base,
      party: [hero, alda, mayu, mort],
      gear: [...base.gear, owned],
      members: base.members.map((member) =>
        member.id === hero
          ? { ...member, status: [{ kind: "bind", turns: 1 }] }
          : member.id === alda
            ? { ...member, hp: 0 }
            : member
      ),
      phase: {
        ...base.phase,
        battle: {
          ...base.phase.battle,
          foes: base.phase.battle.foes.map((foe, index) => ({
            ...foe,
            hp: index === 0 ? 1 : 0,
            status:
              index === 0
                ? [
                    { kind: "bind", turns: 1 },
                    { kind: "poison", turns: 2 },
                  ]
                : [],
          })),
        },
      },
    }
    const save = {
      ...source.game.save(),
      contentVersion:
        version === "legacy"
          ? source.definition.legacyIdentity
          : version === "previous"
            ? source.definition.previousIdentity
            : source.definition.identity,
      snapshot:
        version === "legacy"
          ? {
              ...snapshot,
              gear: snapshot.gear.map((entry) =>
                entry.weapon
                  ? {
                      ...entry,
                      weapon: {
                        ...entry.weapon,
                        skills: [
                          entry.weapon.skills[0],
                          built.content.skills.find(
                            (skill) => !entry.weapon!.skills.includes(skill.id)
                          )!.id,
                          ...entry.weapon.skills.slice(1),
                        ],
                      },
                    }
                  : entry
              ),
            }
          : snapshot,
    }
    const before = structuredClone(save)
    let rng: number | undefined
    let control: Session | undefined
    for (let seed = 0; seed < 256; seed++) {
      const resumed = new Session(built, 42, { save, rng: seed, serial: 2000 })
      if (
        resumed.state.gear.some(
          (gear) =>
            gear.unidentified &&
            !snapshot.gear.some((entry) => entry.id === gear.id)
        )
      ) {
        rng = seed
        control = resumed
        break
      }
    }
    expect(
      control,
      "the real saved RNG must exercise a dropped weapon"
    ).toBeDefined()
    const resumed = new Session(built, 42, { save, rng: rng!, serial: 1000 })
    expect(resumed.state.phase.type).toBe("expedition")
    expect(resumed.state.gear).toHaveLength(control!.state.gear.length)
    expect(resumed.state.gear.find((gear) => gear.id === owned.id)).toEqual(
      owned
    )
    expect(new Set(resumed.state.gear.map((gear) => gear.id)).size).toBe(
      resumed.state.gear.length
    )
    const renamed = new Map(
      control!.state.gear.map((gear, index) => [
        gear.id,
        resumed.state.gear[index].id,
      ])
    )
    const expected = JSON.parse(
      JSON.stringify(control!.state, (_key, value) =>
        typeof value === "string" ? (renamed.get(value) ?? value) : value
      )
    )
    expect(resumed.state).toEqual(expected)
    expect(resumed.random.state).toBe(control!.random.state)
    expect(resumed.queries.problems(resumed.state)).toEqual([])
    expect(save).toEqual(before)
    const reopen = new Session(
      built,
      42,
      JSON.parse(JSON.stringify(resumed.dump()))
    )
    expect(reopen.dump()).toEqual(resumed.dump())
  })
