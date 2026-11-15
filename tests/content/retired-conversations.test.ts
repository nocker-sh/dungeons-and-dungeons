import { expect, it } from "vite-plus/test"
import { gameContent } from "@/content/game-content"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const retired = new GameCatalog(gameContent).data.conversations!.filter(
  (script) => script.retired
)

const resumes = retired.flatMap((script) =>
  (script.choice?.options.map((_, choice) => choice) ?? [undefined]).map(
    (choice) => ({ script, choice, id: script.id })
  )
)

it.each(resumes)(
  "旧セーブの $id を再開・完了でき、新規には始まらない",
  (scenario) => {
    const script = scenario.script
    const legacyContent = {
      ...gameContent,
      conversations: gameContent.conversations!.map((entry) =>
        entry.id === script.id
          ? { ...entry, retired: false, priority: 10000 }
          : entry
      ),
    }
    const state = legacyContent.recruits
      .filter(
        (entry) => !legacyContent.startingCompanions?.includes(entry.member.id)
      )
      .reduce(
        (builder, entry) => builder.withJoined(entry.member.id),
        aState(legacyContent)
      )
      .withReached(4)
      .withNights(100)
      .withCleared(true)
      .withMembers({ like: 100 })
    const companions = [
      ...new Set([
        ...script.participants.filter((id) =>
          legacyContent.recruits.some((entry) => entry.member.id === id)
        ),
        ...legacyContent.startingCompanions!,
      ]),
    ].slice(0, 3)
    const ready = state.withParty(companions)
    const layer = legacyContent.layers[0]
    const branch = layer.stations.find((station) => station.next.length > 1)!
    const staged = ["chest", "branch", "item"].includes(script.trigger)
      ? ready
          .inExpedition({
            layer: layer.id,
            at: script.trigger === "branch" ? branch.id : layer.start,
            visited: [script.trigger === "branch" ? branch.id : layer.start],
            pending:
              script.trigger === "branch"
                ? null
                : {
                    kind: "treasure",
                    gold: 0,
                    goods: [{ good: legacyContent.junk, count: 1 }],
                  },
          })
          .build()
      : ready.build()
    const old = createTestGame({
      content: legacyContent,
      random: 0,
      state: {
        ...staged,
        conversation: {
          active: null,
          last: null,
          seen: [],
          flags: [...script.requires],
        },
      },
    })
    eventsOrThrow(
      old.send({
        type: "start-conversation",
        trigger: script.trigger,
        resident: script.participants[0],
        place: script.place,
      })
    )
    expect(old.queries.activeConversation(old.state)?.id).toBe(script.id)
    const saved = JSON.parse(JSON.stringify(old.save()))
    const resumed = createTestGame()
    expect(resumed.restore(saved)).toBeUndefined()
    expect(resumed.queries.activeConversation(resumed.state)?.id).toBe(
      script.id
    )
    const choice = scenario.choice
    const beforeCompletion = resumed.save()
    eventsOrThrow(
      resumed.send({
        type: "finish-conversation",
        ...(choice === undefined ? {} : { choice }),
      })
    )
    expect(resumed.save().snapshot).toEqual({
      ...beforeCompletion.snapshot,
      conversation: resumed.state.conversation,
    })
    expect(resumed.state.conversation?.seen).toContain(script.id)
    expect(resumed.state.conversation?.active).toBeNull()
    expect(resumed.restore(resumed.save())).toBeUndefined()
    const rules = new ConversationRules(new GameCatalog(gameContent))
    expect(
      rules
        .available(resumed.state, script.trigger, {
          resident: script.participants[0],
          place: script.place,
        })
        .some((entry) => entry.retired)
    ).toBe(false)
    expect(
      rules
        .inspect(resumed.state, script.trigger, {
          resident: script.participants[0],
          place: script.place,
        })
        .find((entry) => entry.conversation.id === script.id)?.reasons
    ).toContain("廃止した会話")
  }
)

it("旧会話は主人公の服や姿があるように書かない", () => {
  const lines = JSON.stringify(retired)
  for (const phrase of ["あなたの服", "あなたの袖", "こっちの服"])
    expect(lines).not.toContain(phrase)
})
