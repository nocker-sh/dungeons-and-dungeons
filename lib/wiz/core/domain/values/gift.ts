type GiftProperties = Readonly<{
  itemId: string
}>

export type WizGiftPresentationEvent = Readonly<{
  type: "gift_presented"
  itemId: string
}>

export class WizStateGift {
  private readonly properties: GiftProperties

  constructor(properties: GiftProperties) {
    this.properties = Object.freeze({ ...properties })
    Object.freeze(this)
  }

  get itemId(): string {
    return this.properties.itemId
  }

  get presentationEvent(): WizGiftPresentationEvent {
    return Object.freeze({
      type: "gift_presented",
      itemId: this.properties.itemId,
    })
  }

  toPlain(): GiftProperties {
    return this.properties
  }

  static create(itemId: string): WizStateGift {
    return new WizStateGift({ itemId })
  }

  static fromPlain(properties: GiftProperties): WizStateGift {
    return new WizStateGift(properties)
  }
}
