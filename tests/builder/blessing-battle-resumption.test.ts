import { expect, test } from "vite-plus/test"
import { buildContent } from "@/builder/lib/build-content"
import { Session } from "@/builder/lib/session"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import type { GameEvent } from "@/lib/wiz/state/game-event"

const built = buildContent([])
const source = new Session(built, 1).catalog.data
const blessings = source.skills.filter((skill) => skill.blessing)
const foe = source.foes.reduce((largest, entry) =>
  entry.hp > largest.hp ? entry : largest
)

function exercise(
  skillId: string,
  fallen: boolean,
  seed: number,
  reload: boolean
) {
  let play = new Session(built, seed)
  const actor = play.state.party[0]
  const offers = source.layers.flatMap((layer, index) =>
    layer.stations.flatMap((station) =>
      (station.discovery?.choices ?? [])
        .filter((choice) => choice.blessings?.includes(skillId))
        .map((choice) => ({ layer, index, station, choice }))
    )
  )
  expect(offers.length, skillId).toBeGreaterThan(0)
  const offer = offers[0]
  // The altar, available funds and later battle entry are explicit local conditions.
  // Blessing ownership and spent uses are changed only by the real operations below.
  const initial = GameStateBuilder.from(play.state, play.catalog)
    .withGold(10000)
    .withBag(offer.choice.costGoods ?? [])
    .withReached(offer.index)
    .inExpedition({
      layer: offer.layer.id,
      at: offer.station.id,
      visited: [offer.layer.start, offer.station.id],
      pending: { kind: "discovery" },
    })
    .build()
  play.patch((state) => Object.assign(state, initial))
  const trace: Array<readonly GameEvent[]> = []
  const checkpoint = () => {
    expect(play.queries.problems(play.state)).toEqual([])
    const saved = JSON.parse(JSON.stringify(play.dump()))
    if (!reload) return
    const views = {
      battle: play.queries.battle(play.state),
      party: play.queries.party(play.state),
      commands: play.queries.commands(play.state, actor),
    }
    play = new Session(built, seed, saved)
    expect(play.dump()).toEqual(saved)
    expect({
      battle: play.queries.battle(play.state),
      party: play.queries.party(play.state),
      commands: play.queries.commands(play.state, actor),
    }).toEqual(views)
  }
  const choice = play.queries
    .route(play.state)!
    .discovery!.choices.find((entry) => entry.id === offer.choice.id)!
  expect(choice.blessings?.some((entry) => entry.id === skillId)).toBe(true)
  expect(choice.available).toBe(true)
  const award = {
    type: "discover",
    choice: offer.choice.id,
    member: actor,
    skill: skillId,
  } as const
  trace.push(play.must(award))
  expect(
    play.state.members.find((member) => member.id === actor)!.blessing
  ).toBe(skillId)
  checkpoint()
  const granted = JSON.parse(JSON.stringify(play.dump()))
  expect(play.send(award)).toBeInstanceOf(GameCommandError)
  expect(play.dump()).toEqual(granted)
  // A separate real return from this same earned state must clear the temporary blessing.
  const returning = new Session(built, seed, granted)
  returning.must({ type: "retreat" })
  expect(returning.state.phase.type).toBe("town")
  expect(returning.state.members.every((member) => !member.blessing)).toBe(true)

  const companion = play.state.party.find((id) => id !== actor)!
  const battle = GameStateBuilder.from(play.state, play.catalog)
    .withMember(companion, { hp: fallen ? 0 : 1 })
    .inBattle({ foes: [foe.id], order: [...play.state.party, "foe-1"] })
    .build()
  play.patch((state) => Object.assign(state, battle))
  checkpoint()
  const skill = play.queries.commands(play.state, actor)!.blessing!
  expect(skill.id).toBe(skillId)
  expect(skill.left).toBe(skill.uses)
  const action = {
    type: "act",
    command: "skill",
    skill: skillId,
    ...(skill.target === "ally" ? { target: skill.targets[0] } : {}),
  } as const
  const before = JSON.parse(JSON.stringify(play.dump()))
  const result = play.send(action)
  expect(!(result instanceof GameCommandError)).toBe(skill.usable)
  if (result instanceof GameCommandError) {
    expect(result.code).toBe("NO_TARGET")
    expect(play.dump()).toEqual(before)
  } else {
    trace.push(result)
    const acted = result.find((event) => event.type === "acted")
    if (!acted || acted.type !== "acted")
      throw new Error(`${skillId}: no actual skill result`)
    expect(acted.skill).toBe(skillId)
    const targets =
      skill.target === "ally"
        ? [skill.targets[0]]
        : skill.target === "allies"
          ? skill.targets
          : ["foe-1"]
    expect(acted.results.map((entry) => entry.target.id)).toEqual(targets)
    expect(
      play.state.members.find((member) => member.id === actor)!.used
    ).toContainEqual({ skill: skillId, count: 1 })
    expect(play.queries.commands(play.state, actor)!.blessing!.left).toBe(
      skill.uses! - 1
    )
  }
  checkpoint()
  // Let the actual foe defeat a guarding party; no HP or stage is edited to create a return.
  for (
    let turn = 0;
    turn < 1000 && play.state.phase.type === "battle";
    turn++
  ) {
    const current = play.queries.battle(play.state)!.current
    trace.push(
      play.must(
        current.kind === "foe"
          ? { type: "foe-turn" }
          : { type: "act", command: "guard" }
      )
    )
    checkpoint()
  }
  expect(trace.flat().some((event) => event.type === "defeated")).toBe(true)
  expect(play.state.phase.type).toBe("town")
  expect(play.state.members.every((member) => !member.blessing)).toBe(true)
  expect(
    play.state.members.every((member) =>
      member.used.every(
        (entry) => !blessings.some((skill) => skill.id === entry.skill)
      )
    )
  ).toBe(true)
  expect(play.queries.commands(play.state, actor)!.blessing).toBeNull()
  return { trace, final: play.dump(), returned: returning.dump() }
}

for (const skill of blessings)
  for (const fallen of [false, true])
    for (const seed of [1, 7])
      test(`${skill.id}, fallen=${fallen}, seed=${seed}: an earned blessing keeps targets and uses through saved turns and expires on return`, () => {
        expect(exercise(skill.id, fallen, seed, true)).toEqual(
          exercise(skill.id, fallen, seed, false)
        )
      })
