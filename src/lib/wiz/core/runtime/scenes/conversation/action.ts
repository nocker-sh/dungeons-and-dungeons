export type WizSceneConversationAction =
  | Readonly<{ type: "ADVANCE_DIALOGUE" }>
  | Readonly<{
      type: "SELECT_DIALOGUE_OPTION"
      npcId: string
      dialogueId: string
      optionId: string
    }>
  | Readonly<{ type: "SELECT_GIFT"; itemId: string }>
  | Readonly<{ type: "CONFIRM_GIFT" }>
  | Readonly<{ type: "CANCEL_GIFT" }>
  | Readonly<{ type: "END_CONVERSATION" }>
