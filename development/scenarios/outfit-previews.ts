import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { Preview } from "@/development/scenarios/types"
import type { PreviewContext } from "@/development/scenarios/context"
export function outfitPreviews(context: PreviewContext): Preview[] {
  const { content, play, prepared } = context

  return [
    {
      slug: "outskirts",
      title: "街はずれ（行き先）",
      start: () => prepared(play(1), { name: "outskirts" }),
    },
    {
      slug: "outskirts-deep",
      title: "街はずれ（全層の探索防具）",
      start: () => {
        const game = play(1)
        const saved = game.save()
        const failed = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, reached: 4 },
        })
        if (failed) throw failed
        return prepared(game, { name: "outskirts" })
      },
    },
    ...content.goods
      .filter(
        (good) => good.kind === "armor" && good.appraiseFrom !== undefined
      )
      .flatMap((armor) =>
        // 最初の仲間の戦士（アルダ）。僧侶（シオン）は募集で加わるので、下の仲間ごとの場面で雇って見る
        ["戦士"]
          .filter((job) => armor.allowedJobs?.includes(job))
          .map((job) => ({
            slug:
              armor.appraiseFrom === 0
                ? "stand-find-armor"
                : `stand-find-armor-${armor.appraiseFrom}`,
            title: `探索限定防具：${job}・${armor.name}`,
            start: () => {
              const game = play(1)
              const saved = game.save()
              const member = game.queries
                .party(game.state)
                .find((entry) => entry.job === job)
              if (!member) throw new Error("探索防具の確認対象がない")
              const failed = game.restore({
                ...saved,
                snapshot: {
                  ...saved.snapshot,
                  gear: [
                    ...saved.snapshot.gear,
                    {
                      id: "preview-find-armor",
                      good: armor.id,
                      owner: null,
                      plus: 0,
                      progress: 0,
                      wear: 0,
                      weapon: null,
                    },
                  ],
                },
              })
              if (failed) throw failed
              const equipped = inPhase(game, "town")?.equip(
                "preview-find-armor",
                member.id
              )
              if (!equipped || equipped instanceof GameCommandError)
                throw new Error("探索防具を装備できない")
              return prepared(
                game,
                { name: "town" },
                { kind: "stand", member: member.id }
              )
            },
          }))
      ),
    ...[
      { slug: "sion", member: "92994417-49e7-428b-9565-d050a6e8c3ab" },
      { slug: "gald", member: "a43310c2-98c6-41e1-b8f6-facf50b5f413" },
      { slug: "mort", member: "1aac56f8-7a5c-4199-8100-91caf9e283a6" },
      { slug: "jig", member: "f9298ba8-cd8f-4e88-b491-2d7e2c1f947d" },
      { slug: "gou", member: "b7925912-35a3-4f8f-b42e-d59581a71e19" },
      { slug: "rio", member: "cc5615da-77a2-4d94-8a50-54147f923397" },
      { slug: "mayu", member: "d312117e-1aa5-4e02-ae58-9b913f6b8917" },
      { slug: "luca", member: "585cfe02-653c-448a-b8f8-e2646f097091" },
      { slug: "mimika", member: "56e31d5e-a23d-48b6-8152-ba781dd275f7" },
    ].flatMap((person) => {
      const recruit = content.recruits.find(
        (entry) => entry.member.id === person.member
      )
      const member =
        recruit?.member ??
        content.party.find((entry) => entry.id === person.member)
      if (!member) return []
      return content.goods
        .filter(
          (armor) =>
            armor.kind === "armor" &&
            armor.appraiseFrom !== undefined &&
            armor.allowedJobs?.includes(member.job)
        )
        .map((armor) => ({
          slug: `stand-find-armor-${person.slug}-${armor.appraiseFrom}`,
          title: `探索限定防具：${member.name}・${armor.name}`,
          start: () => {
            const game = play(1)
            const saved = game.save()
            const failed = game.restore({
              ...saved,
              snapshot: {
                ...saved.snapshot,
                gold: 2000,
                board: recruit ? [recruit.id] : saved.snapshot.board,
                gear: [
                  ...saved.snapshot.gear,
                  {
                    id: "preview-find-armor",
                    good: armor.id,
                    owner: null,
                    plus: 0,
                    progress: 0,
                    wear: 0,
                    weapon: null,
                  },
                ],
              },
            })
            if (failed) throw failed
            if (
              !game.state.members.some((member) => member.id === person.member)
            ) {
              const hired =
                recruit && inPhase(game, "town")?.recruit(recruit.id)
              if (!hired || hired instanceof GameCommandError)
                throw new Error("探索防具の確認対象を雇えない")
            }
            if (!game.state.party.includes(person.member)) {
              const swapped = inPhase(game, "town")?.swap(
                game.state.party[1],
                person.member
              )
              if (!swapped || swapped instanceof GameCommandError)
                throw new Error("探索防具の確認対象を編成できない")
            }
            const equipped = inPhase(game, "town")?.equip(
              "preview-find-armor",
              person.member
            )
            if (!equipped || equipped instanceof GameCommandError)
              throw new Error("探索防具を装備できない")
            return prepared(
              game,
              { name: "town" },
              { kind: "stand", member: person.member }
            )
          },
        }))
    }),
    ...content.hero.looks.map((look, index) => ({
      slug: `stand-find-armor-player-${["purple", "blue", "red", "gold"][index]}-3`,
      title: `主人公の衣装・外見${index + 1}`,
      start: () => {
        const game = play(1)
        const changed = inPhase(game, "town")?.chooseHeroLook(
          look,
          content.hero.outfits?.at(-1)
        )
        if (!changed || changed instanceof GameCommandError)
          throw new Error("主人公の衣装を変更できない")
        return prepared(
          game,
          { name: "town" },
          {
            kind: "stand",
            member: content.party.find((entry) => entry.hero)!.id,
          }
        )
      },
    })),
  ]
}
