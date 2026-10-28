import { buildContent } from "@/builder/lib/build-content"
import { Session } from "@/builder/lib/session"
import { SeededRandom } from "@/builder/lib/random"
import { previews } from "@/development/scenarios/index"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"

/** 場面（/previews の slug）から始めるプレイ。 */
export function sessionFromScene(
  built: ReturnType<typeof buildContent>,
  seed: number,
  slug: string
) {
  const preview = previews({ content: built.content }).find(
    (entry) => entry.slug === slug
  )
  if (!preview)
    throw new Error(
      `場面 ${slug} がない（${previews()
        .map((entry) => entry.slug)
        .join(" ")}）`
    )
  const start = preview.start()
  const game = new GameDefinition(built.content).create(
    start.environment,
    start.initialState
  )
  if (start.save) {
    const failed = game.restore(start.save)
    if (failed) throw failed
  }
  // 場面の id と重ならないよう、続きの id は大きい番号から振る
  return new Session(built, seed, {
    rng: new SeededRandom(seed).state,
    serial: 1000,
    save: game.save(),
  })
}
