import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { parseCommand } from "@/builder/lib/commands"
import { Session } from "@/builder/lib/session"

describe("CLIのJSON操作", () => {
  it("殴るを操作名のまま送り、短縮コマンドと同じ戦闘結果になる", () => {
    const session = Session.create([], 42)
    session.patch((state) => {
      Object.assign(
        state,
        aState(session.built.content)
          .inBattle({ foes: ["kamokutsu"], order: ["alda", "foe-1"] })
          .build()
      )
    })
    const alda = session.id("alda")
    const view = session.queries.commands(session.state, alda)!
    session.patch((state) => {
      state.members.find((member) => member.id === alda)!.used = [
        ...view.weaponSkills,
        ...view.skills,
      ]
        .filter((skill) => skill.kind === "hit" && skill.uses !== null)
        .map((skill) => ({ skill: skill.id, count: skill.uses! }))
    })
    expect(session.queries.commands(session.state, alda)?.brawl).not.toBeNull()
    const short = new Session(session.built, 42, session.dump())
    const expected = short.must(parseCommand(short, "brawl foe-1"))
    const actual = session.must(
      parseCommand(session, '{"type":"act","command":"brawl","target":"foe-1"}')
    )
    expect(actual).toEqual(expected)
    expect(actual).toContainEqual(
      expect.objectContaining({ type: "acted", command: "brawl" })
    )
    expect(session.dump()).toEqual(short.dump())
  })

  it("品物のslugと同名の装備個体を、指定したとおりに売る", () => {
    const session = Session.create()
    session.must(parseCommand(session, "buy armory sword"))
    const sword = session.state.gear.find(
      (gear) => gear.good === session.id("sword", "goods") && !gear.owner
    )!
    expect(sword).toBeDefined()
    session.patch((state) => {
      state.gear.find((gear) => gear.id === sword.id)!.id = "potion"
    })
    const before = session.dump()
    const short = new Session(session.built, 1, before)
    const expected = short.must(parseCommand(short, "sell-gear potion"))
    expect(
      session.must(parseCommand(session, '{"type":"sell","gear":"potion"}'))
    ).toEqual(expected)
    expect(session.dump()).toEqual(short.dump())
    expect(session.state.gear.some((gear) => gear.id === "potion")).toBe(false)
    expect(session.state.bag).toEqual(before.save.snapshot.bag)
    expect(session.state.gold).toBeGreaterThan(before.save.snapshot.gold)
  })

  it("異なる種類に同じslugがあっても、品物は品物として解決する", () => {
    const session = Session.create(['skills.brawl.slug="sword"'])
    const short = new Session(session.built, 1, session.dump())
    const expected = short.must(parseCommand(short, "buy armory sword"))
    expect(
      session.must(
        parseCommand(session, '{"type":"buy","shop":"armory","good":"sword"}')
      )
    ).toEqual(expected)
    expect(session.dump()).toEqual(short.dump())
  })

  it.each([
    { type: "rename-hero", name: "potion" },
    { type: "advance", to: "normal" },
    { type: "discover", choice: "brawl" },
    { type: "reforge", gear: "sword", material: "potion" },
    { type: "choose-hero-look", look: "sword", outfit: "potion" },
  ])("参照以外の文字列を変更しない: %j", (action) => {
    const session = Session.create()
    expect(parseCommand(session, JSON.stringify(action))).toEqual(action)
  })

  it.each([
    ["depart layer0", { type: "depart", layer: "layer0" }],
    [
      "skill whirl foe-1",
      { type: "act", command: "skill", skill: "whirl", target: "foe-1" },
    ],
    [
      "item potion alda",
      { type: "act", command: "item", good: "potion", target: "alda" },
    ],
    ["rest normal", { type: "rest", room: "normal" }],
    ["recruit n-alda", { type: "recruit", recruit: "n-alda" }],
    ["demon lock", { type: "choose-demon", demon: "lock" }],
    ["equip g1 alda", { type: "equip", gear: "g1", member: "alda" }],
    ["swap alda mort", { type: "swap", out: "alda", in: "mort" }],
    ["rows alda mort", { type: "swap-rows", a: "alda", b: "mort" }],
    ["chat alda", { type: "chat", liked: "alda" }],
    ["craft craft-axe", { type: "craft", recipe: "craft-axe" }],
    ["quest layer0-clear", { type: "accept-quest", quest: "layer0-clear" }],
  ] as const)("slugの指定は短縮コマンドと一致する: %s", (short, action) => {
    const session = Session.create()
    const parsed = parseCommand(session, JSON.stringify(action))
    expect(parsed).toEqual(parseCommand(session, short))
    expect(parseCommand(session, JSON.stringify(parsed))).toEqual(parsed)
  })
})
