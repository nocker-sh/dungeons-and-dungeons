export type WizEngineBattleScene = "encounter" | "turnOrder" | "victory" | "defeat"

export type WizEngineBattleInitiativeResult = "party" | "enemies" | "none"

export type WizEngineBattleTurnActionType = "attack" | "ability" | "defend" | "item" | "flee"

/** 1 = normal, 0.5 = resist, 2 = weak, 0 = immune. Element ID is open. */
export type WizEngineBattleElementalAffinity = Readonly<Record<string, number>>
