import type { WizItemEffectEvent } from "@/lib/wiz/core/domain/services/item-effect-service"

/** Japanese presentation adapter for semantic item-effect events. */
export function formatWizItemEffectEventsJa(events: readonly WizItemEffectEvent[]): string {
  return events.map((event) => formatEvent(event)).join(" ")
}

function formatEvent(event: WizItemEffectEvent): string {
  switch (event.type) {
    case "hp_restored":
      return `HPが${event.amount}回復した`
    case "mp_restored":
      return `MPが${event.amount}回復した`
    case "hunger_restored":
      return `空腹度が${event.amount}回復した`
    case "temporary_stat_increased":
      return `${event.stat}が一時的に上昇した`
    case "revived":
      return `HPが${event.hp}回復した!`
    case "status_cured":
      return "体が軽くなった"
    case "teleport_requested":
      return "帰還の光に包まれた"
    case "light_activated":
      return "周囲が明るくなった"
    case "poison_requested":
      return "毒を使用した"
    case "trap_requested":
      return "罠を使用した"
    case "fuel_requested":
      return "燃料を補給した"
    case "unlock_requested":
      return "鍵を使用した"
  }
}
