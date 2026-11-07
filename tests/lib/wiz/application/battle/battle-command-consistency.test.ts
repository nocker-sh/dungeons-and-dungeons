import assert from "node:assert/strict"
import { test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { gameEnvironment } from "@/lib/wiz/definition/game-environment"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameAction } from "@/lib/wiz/commands"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

const content = realContent()
const definition = new GameDefinition(content)
const members = [
  ...content.party,
  ...content.recruits.map((entry) => entry.member),
]
const foe = content.foes.reduce((strongest, entry) =>
  entry.hp > strongest.hp ? entry : strongest
)
const initial = aState(definition.catalog)
const native = initial.build()
const actors = members.flatMap((member) =>
  (member.hero
    ? [null, ...content.demons.map((entry) => entry.id)]
    : [native.contract]
  ).map((contract) => ({ member, contract }))
)

for (const entry of actors)
  for (const critical of [false, true])
    for (const fallen of [false, true])
      for (const exhausted of [false, true])
        test(`${entry.member.id}, contract=${entry.contract}, critical=${critical}, fallen=${fallen}, exhausted=${exhausted}: commands agree with real actions before and after save`, () => {
          // Recruitment, starting equipment, wounds, remaining uses and battle entry are explicit local conditions.
          let builder = native.members.some(
            (member) => member.id === entry.member.id
          )
            ? initial
            : initial.withJoined(entry.member.id)
          builder =
            entry.contract === null
              ? builder.withoutDemon()
              : builder.withDemons(
                  [{ id: entry.contract, lv: 1, exp: 0 }],
                  entry.contract
                )
          const companions = builder
            .build()
            .members.filter((member) => member.id !== entry.member.id)
            .slice(0, 2)
            .map((member) => member.id)
          assert.equal(companions.length, 2)
          builder = builder
            .withParty([entry.member.id, ...companions])
            .withBag([])
          // Contract-free starting conditions use the real HP cap without the fusion bonus.
          const bounded = builder.build()
          builder = builder.withMembers((member) => ({
            hp: Math.min(
              member.hp,
              definition.rules.party.stats(member, bounded).maxHp
            ),
          }))
          if (critical) builder = builder.withMember(entry.member.id, { hp: 1 })
          if (fallen) builder = builder.withMember(companions[0], { hp: 0 })
          builder = builder.inBattle({
            foes: [foe.id],
            order: [entry.member.id, "foe-1"],
          })
          if (exhausted) {
            const state = builder.build()
            const member = state.members.find(
              (member) => member.id === entry.member.id
            )!
            builder = builder.withUses(
              entry.member.id,
              definition.rules.party.skills
                .battleSkills(member, state)
                .flatMap((skill) => {
                  const uses = definition.rules.party.skills.maxUses(
                    member,
                    state,
                    skill
                  )
                  return uses === null ? [] : [{ skill, count: uses }]
                })
            )
          }
          const state = builder.build()
          const before = structuredClone(state)
          const fresh = () =>
            definition.create(
              gameEnvironment({
                random: () => 0.5,
                clock: () => 42,
                ids: sequentialIds("command-consistency"),
              }),
              state
            )
          const game = fresh()
          assert.deepEqual(game.queries.problems(game.state), [])
          const commands = game.queries.commands(game.state, entry.member.id)!
          assert.ok(commands)
          const snapshot = JSON.parse(JSON.stringify(game.save()))
          const skills = [
            ...commands.weaponSkills,
            ...commands.skills,
            ...(commands.blessing ? [commands.blessing] : []),
          ]
          assert.ok(skills.length > 0)
          function check(action: GameAction, usable: boolean) {
            const live = fresh()
            const resumed = fresh()
            assert.equal(resumed.restore(snapshot), undefined)
            assert.deepEqual(
              resumed.queries.commands(resumed.state, entry.member.id),
              commands
            )
            const expected = live.send(action)
            const actual = resumed.send(action)
            assert.equal(
              !(actual instanceof GameCommandError),
              usable,
              `${entry.member.id}: ${JSON.stringify(action)}`
            )
            if (expected instanceof GameCommandError) {
              assert.ok(actual instanceof GameCommandError)
              assert.equal(actual.code, expected.code)
              assert.deepEqual(resumed.save(), snapshot)
            } else {
              assert.ok(!(actual instanceof GameCommandError))
              assert.deepEqual(actual, expected)
              if (action.type === "act" && action.command === "skill") {
                assert.ok(action.skill)
                const id = action.skill
                const previous = state.members.find(
                  (member) => member.id === entry.member.id
                )!
                const next = resumed.state.members.find(
                  (member) => member.id === entry.member.id
                )!
                const before =
                  previous.used.find((use) => use.skill === id)?.count ?? 0
                const after =
                  next.used.find((use) => use.skill === id)?.count ?? 0
                assert.equal(
                  after,
                  before +
                    (definition.rules.party.skills.baseUses(id) === null
                      ? 0
                      : 1),
                  `${id}: accepted skills spend one use`
                )
              }
            }
            assert.deepEqual(resumed.state, live.state)
            assert.deepEqual(resumed.queries.problems(resumed.state), [])
            const restored = fresh()
            assert.equal(
              restored.restore(JSON.parse(JSON.stringify(resumed.save()))),
              undefined
            )
            assert.deepEqual(restored.state, resumed.state)
            assert.deepEqual(
              restored.queries.battle(restored.state),
              resumed.queries.battle(resumed.state)
            )
            assert.deepEqual(
              restored.queries.party(restored.state),
              resumed.queries.party(resumed.state)
            )
            for (const id of restored.state.party)
              assert.deepEqual(
                restored.queries.commands(restored.state, id),
                resumed.queries.commands(resumed.state, id)
              )
          }
          for (const skill of skills) {
            check(
              { type: "act", command: "skill", skill: skill.id },
              skill.usable
            )
            if (skill.target === "ally") {
              for (const target of skill.targets)
                check(
                  { type: "act", command: "skill", skill: skill.id, target },
                  skill.usable
                )
            }
          }
          check({ type: "act", command: "brawl" }, commands.brawl !== null)
          assert.deepEqual(
            state,
            before,
            "querying and executing cannot mutate the shared initial condition"
          )
        })
