import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { saveIdentity } from "@/lib/wiz/definition/save-identity"

const gameContent = realContent()

/** 開幕を見て街へ着いたところ（登録待ち）。 */
function arriveInTown() {
  const game = new GameDefinition(gameContent).create()
  const creating = inPhase(game, "creating")!
  expect(creating.startOpening()).not.toBeInstanceOf(GameCommandError)
  const choice = game.queries.activeConversation(game.state)?.choice
    ? 0
    : undefined
  expect(inPhase(game, "conversation")!.finish(choice)).not.toBeInstanceOf(
    GameCommandError
  )
  expect(inPhase(game, "creating")!.leaveCamp()).not.toBeInstanceOf(
    GameCommandError
  )
  return game
}

describe("三人で始めてギルド登録", () => {
  it("[feature:W045] 開幕は街へ着く前だけ。会話中は街へ出られず、見終えた場面は繰り返さない", () => {
    const game = new GameDefinition(gameContent).create()
    expect(game.queries.canStartConversation(game.state, "opening")).toBe(true)
    const openings = gameContent
      .conversations!.filter((entry) => entry.trigger === "opening")
      .map((entry) => entry.id)
    const played: string[] = []
    for (const _ of openings) {
      if (!game.queries.canStartConversation(game.state, "opening")) break
      inPhase(game, "creating")!.startOpening()
      const active = game.state.conversation!.active!
      played.push(active)
      const during = game.state
      expect(game.send({ type: "leave-camp" })).toBeInstanceOf(GameCommandError)
      expect(game.state).toBe(during)
      const choice = game.queries.activeConversation(game.state)?.choice
        ? 0
        : undefined
      expect(inPhase(game, "conversation")!.finish(choice)).not.toBeInstanceOf(
        GameCommandError
      )
    }
    // 開幕の台本はどれも一度ずつだけ流れる
    expect(played.length).toBeGreaterThan(0)
    expect(new Set(played).size).toBe(played.length)
    expect(played.every((id) => openings.includes(id))).toBe(true)
    expect(game.queries.canStartConversation(game.state, "opening")).toBe(false)
    expect(inPhase(game, "creating")!.leaveCamp()).not.toBeInstanceOf(
      GameCommandError
    )
    expect(game.state.phase.type).toBe("town")
    expect(game.state.hero.registrationPending).toBe(true)
    // 街では開幕を始めない。二度目の野営もない
    expect(game.queries.canStartConversation(game.state, "opening")).toBe(false)
    expect(game.send({ type: "leave-camp" })).toBeInstanceOf(GameCommandError)
  })

  it("[feature:W045] 開幕の場面を見て街へ着き、名前登録前の募集・改名は状態を変えない", () => {
    const game = arriveInTown()
    expect(game.state.phase.type).toBe("town")
    expect(game.queries.hero(game.state)).toMatchObject({
      registrationPending: true,
      name: gameContent.hero.name,
    })
    expect(game.queries.onboarding(game.state)).toMatchObject({
      step: "register",
      remaining: 0,
    })
    const before = game.state
    expect(
      game.send({ type: "recruit", recruit: game.state.board[0] })
    ).toBeInstanceOf(GameCommandError)
    expect(game.send({ type: "rename-hero", name: "ノア" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
  })

  it("[feature:W037] 登録用紙の名前は全角カタカナ1〜6文字。写真で容姿を選び、登録直後の場面のフラグを立てる", () => {
    const game = arriveInTown()
    const look = gameContent.hero.looks[2]
    for (const name of [
      "　 ",
      "ア".repeat(7),
      "のあ",
      "Noah",
      "ﾉｱ",
      "ノア1",
      gameContent.hero.name,
    ]) {
      const before = game.state
      expect(game.send({ type: "register-hero", name, look })).toBeInstanceOf(
        GameCommandError
      )
      expect(game.state).toBe(before)
    }
    const before = game.state
    expect(
      game.send({ type: "register-hero", name: "ノア", look: "ghost" })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
    const name = "ヴァーミリオ"
    expect(
      game.send({ type: "register-hero", name: ` ${name} `, look })
    ).toEqual([{ type: "hero-registered", name, look }])
    expect(game.state.hero).toMatchObject({
      name,
      look,
      registrationPending: false,
    })
    expect(game.state.conversation?.flags).toContain("hero:registered")
    // 受付に入ると、登録直後の仲間の場面が始まる
    const reception = gameContent.conversations!.find(
      (entry) => entry.id === "registered-at-guild"
    )!
    expect(
      game.queries.canStartConversation(game.state, "visit", {
        place: reception.place,
      })
    ).toBe(true)
    inPhase(game, "town")!.visit(reception.place!)
    expect(game.state.conversation?.active).toBe(reception.id)
    inPhase(game, "conversation")!.finish()
    expect(game.queries.onboarding(game.state)?.step).toBe("depart")
    expect(game.send({ type: "register-hero", name: "別名" })).toBeInstanceOf(
      GameCommandError
    )
  })

  it("[feature:W037] 登録前・三人の編成を保存から再開し、出発すると案内を終える", () => {
    let game = arriveInTown()
    const restore = () => {
      const saved = game.save()
      game = new GameDefinition(gameContent).create()
      expect(game.restore(saved)).toBeUndefined()
    }
    restore()
    expect(game.queries.onboarding(game.state)?.step).toBe("register")
    expect(inPhase(game, "town")!.registerHero("ノア")).not.toBeInstanceOf(
      GameCommandError
    )
    const group = [...game.state.party]
    restore()
    expect(game.state.party).toEqual(group)
    expect(game.state.party).toHaveLength(3)
    expect(game.queries.onboarding(game.state)?.remaining).toBe(0)
    expect(game.queries.onboarding(game.state)?.step).toBe("depart")
    expect(
      inPhase(game, "town")!.depart(gameContent.layers[0].id)
    ).not.toBeInstanceOf(GameCommandError)
    expect(game.queries.onboarding(game.state)).toBeNull()
  })

  it("[feature:W036] 容姿の変更は名前・能力・装備・所持金を保ち、不正候補と探索中は拒否する", () => {
    const game = arriveInTown()
    inPhase(game, "town")!.registerHero("ノア")
    const before = game.state
    const look = gameContent.hero.looks[2]
    expect(inPhase(game, "town")!.chooseHeroLook(look)).not.toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toEqual({ ...before, hero: { ...before.hero, look } })
    for (const invalid of ["unknown", look]) {
      const snapshot = game.state
      expect(
        game.send({ type: "choose-hero-look", look: invalid })
      ).toBeInstanceOf(GameCommandError)
      expect(game.state).toBe(snapshot)
    }
    for (const recruit of game.queries.recruits(game.state))
      inPhase(game, "town")!.recruit(recruit.id)
    inPhase(game, "town")!.depart(gameContent.layers[0].id)
    const snapshot = game.state
    expect(
      game.send({ type: "choose-hero-look", look: gameContent.hero.looks[0] })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(snapshot)
  })

  it("dungeons-state-10 の保存は名前・容姿・資産を保ち、登録をやり直さない（カタカナでない8文字の名前も読める）", () => {
    const game = arriveInTown()
    inPhase(game, "town")!.registerHero("キゾン")
    const saved = JSON.parse(JSON.stringify(game.save()))
    delete saved.snapshot.hero.registrationPending
    saved.snapshot.hero.name = "むかしの長い名前"
    saved.contentVersion = saveIdentity(undefined, "dungeons-state-10")
    const restored = new GameDefinition(gameContent).create()
    expect(restored.restore(saved)).toBeUndefined()
    expect(restored.state).toEqual(saved.snapshot)
    expect(restored.queries.onboarding(restored.state)).toBeNull()
    expect(restored.queries.hero(restored.state).registrationPending).toBe(
      false
    )
    // 古い名前は読み込めるが、同じ名前への改名は規則で断る（状態は壊さない）
    expect(restored.state.hero.name).toBe("むかしの長い名前")
    const before = restored.state
    saved.snapshot.hero.registrationPending = "false"
    expect(restored.restore(saved)).toBeInstanceOf(GameCommandError)
    expect(restored.state).toBe(before)
  })

  it("はじめから遊ぶと、戦闘より先に登録し、初出撃で流れが終わる", () => {
    const game = arriveInTown()
    expect(game.queries.prologue(game.state)).toBe("register")
    // 登録前は戦闘（出撃）に入れない。名前と容姿が決まる前に戦闘の札へ出さない
    expect(
      game.send({ type: "depart", layer: gameContent.layers[0].id })
    ).toBeInstanceOf(GameCommandError)
    const hero = game.queries.hero(game.state)
    eventsOrThrow(
      game.send({ type: "register-hero", name: "ノア", look: hero.look })
    )
    expect(game.queries.prologue(game.state)).toBe("depart")
    eventsOrThrow(
      game.send({ type: "depart", layer: gameContent.layers[0].id })
    )
    expect(game.queries.prologue(game.state)).toBeNull()
  })

  it("登録の印のない旧保存（登録済み扱い）は、流れに乗せない", () => {
    const game = arriveInTown()
    const save = game.save() as unknown as {
      snapshot: { hero: object; conversation?: { flags: string[] } }
    }
    const old = structuredClone(save)
    old.snapshot.hero = { ...old.snapshot.hero, registrationPending: false }
    if (old.snapshot.conversation) old.snapshot.conversation.flags = []
    expect(game.restore(old)).toBeUndefined()
    expect(game.queries.prologue(game.state)).toBeNull()
  })
})
