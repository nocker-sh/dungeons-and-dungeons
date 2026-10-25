import type { WizWorldModule } from "@/lib/wiz/core/world/world"

export const WIZ_WORLD_SLICE_MODULE = Symbol("WizWorldSliceModule.worldModule")

export type WizWorldSliceModuleCarrier<TState, TAction, TEvent, TReason extends string> = Readonly<{
  [WIZ_WORLD_SLICE_MODULE](): WizWorldModule<TState, TAction, TEvent, TReason>
}>

export const requireWizWorldSliceModule = <TState, TAction, TEvent, TReason extends string>(
  slice: WizWorldSliceModuleCarrier<TState, TAction, TEvent, TReason>,
): WizWorldModule<TState, TAction, TEvent, TReason> => {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(slice),
    WIZ_WORLD_SLICE_MODULE,
  )
  if (descriptor === undefined || typeof descriptor.value !== "function") {
    throw new TypeError("World slice module was not created by WizWorldSliceModule")
  }
  return slice[WIZ_WORLD_SLICE_MODULE]()
}
