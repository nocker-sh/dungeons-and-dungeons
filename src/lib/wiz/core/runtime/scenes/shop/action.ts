export type WizSceneShopAction =
  | Readonly<{ type: "SELECT_ITEM_TO_BUY"; shopId: string; itemId: string }>
  | Readonly<{ type: "SELECT_WEAPON_TO_BUY"; shopId: string; weaponId: string }>
  | Readonly<{ type: "SELECT_ARMOR_TO_BUY"; shopId: string; armorId: string }>
  | Readonly<{ type: "CONFIRM_PURCHASE" }>
  | Readonly<{ type: "CANCEL_PURCHASE" }>
  | Readonly<{ type: "SELL_ITEM"; itemId: string }>
  | Readonly<{ type: "START_SHOP_CONVERSATION"; shopId: string; topicId: string }>
  | Readonly<{ type: "ADVANCE_SHOP_CONVERSATION" }>
  | Readonly<{ type: "END_SHOP_CONVERSATION" }>
  | Readonly<{ type: "LEAVE_SHOP" }>
