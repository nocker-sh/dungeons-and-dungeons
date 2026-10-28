export type WizSceneInventoryAction =
  | Readonly<{ type: "USE_ITEM"; itemId: string }>
  | Readonly<{
      type: "EQUIP"
      slotId: string
      entryId: string
    }>
  | Readonly<{ type: "UNEQUIP"; slotId: string }>
