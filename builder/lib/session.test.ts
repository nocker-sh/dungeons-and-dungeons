import { expect, test } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { buildContent } from "@/builder/lib/build-content"
import { parseCommand } from "@/builder/lib/commands"
import { realContent } from "@/lib/wiz/testing/real-content"

const content = realContent()
const starts = [
  { label: "authored", overrides: [] as string[] },
  ...content.recruits
    .filter((entry) => !!entry.member.weapon)
    .map((entry) => ({
      label: entry.member.id,
      // The documented content override selects an authored starting companion, without changing rules or gear.
      overrides: [`startingCompanions=${JSON.stringify([entry.member.id])}`],
    })),
]

for (const start of starts)
  for (const seed of [1, 42, 0xffffffff])
    test(`${start.label}: loading preserves the next random draw and allocated gear ID, seed=${seed}`, () => {
      const built = buildContent(start.overrides)
      const uninterrupted = new Session(built, seed)
      const action = parseCommand(uninterrupted, "buy armory sword")
      uninterrupted.must(action)
      const saved = uninterrupted.dump()
      const resumed = new Session(
        built,
        seed,
        JSON.parse(JSON.stringify(saved))
      )
      expect(resumed.state).toEqual(uninterrupted.state)
      expect(resumed.dump()).toEqual(saved)
      // A read-only reopening must not move either deterministic input stream.
      const reopened = new Session(
        built,
        seed,
        JSON.parse(JSON.stringify(resumed.dump()))
      )
      expect(reopened.dump()).toEqual(saved)
      const expected = uninterrupted.must(action)
      expect(resumed.must(action)).toEqual(expected)
      expect(reopened.must(action)).toEqual(expected)
      expect(resumed.dump()).toEqual(uninterrupted.dump())
      expect(reopened.dump()).toEqual(uninterrupted.dump())
    })
