import type { GameAction } from "@/lib/wiz/commands"
import type { Game } from "@/lib/wiz/game/game"

/** 手番の仲間が送る指示。使える攻撃のワザ、尽きたら殴る、それも無ければ防御。 */
export function turnActionFor(game: Game, memberId: string): GameAction {
  const commands = game.queries.commands(game.state, memberId)!
  const hit = [
    ...commands.weaponSkills,
    ...commands.skills,
    ...(commands.blessing ? [commands.blessing] : []),
  ].find((skill) => skill.kind === "hit" && skill.usable)
  if (hit) return { type: "act", command: "skill", skill: hit.id }
  if (commands.brawl) return { type: "act", command: "brawl" }
  return { type: "act", command: "guard" }
}
