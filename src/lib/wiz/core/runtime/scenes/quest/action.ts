export type WizSceneQuestAction =
  | Readonly<{ type: "SELECT_QUEST"; questId: string }>
  | Readonly<{ type: "CLEAR_QUEST_SELECTION" }>
  | Readonly<{ type: "ACCEPT_QUEST" }>
  | Readonly<{ type: "COMPLETE_QUEST" }>
  | Readonly<{ type: "LEAVE_QUEST" }>
