import { expect, it } from "vite-plus/test"
import { contentSource, gameContent } from "@/content/game-content"
import { studioCharacters } from "@/development/studio/studio-content"
import { conceptEntries } from "@/concept/database"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

it.each(["luca", "gald", "tsumugi", "rivet"])(
  "%s は新規の募集・会話・制作対象から外し、雇用済みの旧セーブは読み込める",
  (slug) => {
    const recruit = contentSource.recruits.find(
      (entry) => entry.member.slug === slug
    )!
    expect(recruit.retired).toBe(true)
    expect(studioCharacters.some((entry) => entry.slug === slug)).toBe(false)
    expect(conceptEntries.some((entry) => entry.slug === slug)).toBe(false)
    expect(
      gameContent.conversations?.some(
        (entry) =>
          !entry.retired && entry.participants.includes(recruit.member.id)
      )
    ).toBe(false)
    const game = createTestGame({
      state: aState().withGold(10000).withBoard([recruit.id]).build(),
    })
    expect(game.queries.recruits(game.state)).toEqual([])
    const before = game.state
    expect(game.send({ type: "recruit", recruit: recruit.id })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
    expect(game.restore(game.save())).toBeUndefined()
    for (let index = 0; index < 20; index++) {
      eventsOrThrow(game.send({ type: "reroll" }))
      for (const retired of gameContent.recruits.filter(
        (entry) => entry.retired
      ))
        expect(game.state.board).not.toContain(retired.id)
    }
    const existing = createTestGame({
      state: aState().withJoined(slug, { replacing: "alda" }).build(),
    })
    const save = existing.save()
    expect(existing.restore(save)).toBeUndefined()
    expect(existing.save()).toEqual(save)
    expect(
      existing.queries
        .party(existing.state)
        .some((member) => member.id === recruit.member.id)
    ).toBe(true)
  }
)
