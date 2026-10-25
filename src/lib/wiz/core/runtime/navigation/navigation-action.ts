export type WizSceneNavigationAction =
  | Readonly<{ type: "ENCOUNTER_MONSTER"; areaId: string; monsterId: string }>
  | Readonly<{ type: "RETURN_TO_VILLAGE" }>
