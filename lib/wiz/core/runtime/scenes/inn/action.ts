export type WizSceneInnAction =
  | Readonly<{ type: "SELECT_STAY_PLAN"; plan: string }>
  | Readonly<{ type: "CONFIRM_STAY" }>
  | Readonly<{ type: "CANCEL_STAY" }>
  | Readonly<{ type: "LEAVE_INN" }>
