export type WizEnginePurchaseProperties =
  | { readonly type: "item"; readonly itemId: string; readonly price: number }
  | { readonly type: "weapon"; readonly weaponId: string; readonly price: number }
  | { readonly type: "armor"; readonly armorId: string; readonly price: number }

export class WizEnginePurchase {
  private readonly properties: WizEnginePurchaseProperties

  constructor(properties: WizEnginePurchaseProperties) {
    this.properties = Object.freeze({ ...properties })
    Object.freeze(this)
  }

  get type() {
    return this.properties.type
  }

  get price(): number {
    return this.properties.price
  }

  get id(): string {
    if (this.properties.type === "item") {
      return this.properties.itemId
    }
    if (this.properties.type === "weapon") {
      return this.properties.weaponId
    }
    return this.properties.armorId
  }

  toPlain(): WizEnginePurchaseProperties {
    return this.properties
  }

  static fromItem(itemId: string, price: number): WizEnginePurchase {
    return new WizEnginePurchase({ type: "item", itemId, price })
  }

  static fromWeapon(weaponId: string, price: number): WizEnginePurchase {
    return new WizEnginePurchase({ type: "weapon", weaponId, price })
  }

  static fromArmor(armorId: string, price: number): WizEnginePurchase {
    return new WizEnginePurchase({ type: "armor", armorId, price })
  }
}
