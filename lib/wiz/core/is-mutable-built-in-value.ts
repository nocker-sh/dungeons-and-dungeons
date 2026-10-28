import { isNativeConstructor } from "@/lib/wiz/core/is-native-constructor"

/**
 * freezeしても内部slotを変更できる標準型と、そのsubclassを検出する。
 *
 * instance自身のconstructorだけを見ると`class CustomMap extends Map`を見逃すため、
 * prototype chain上の標準constructorまで確認する。plain objectの終端であるObjectと、
 * 呼び出し側で要素をcopyできるArrayは除外する。
 */
export const isMutableBuiltInValue = (value: object): boolean => {
  if (ArrayBuffer.isView(value)) {
    return true
  }

  let prototype = Object.getPrototypeOf(value)
  while (prototype !== null && prototype !== Object.prototype) {
    const constructor = Object.getOwnPropertyDescriptor(
      prototype,
      "constructor"
    )?.value
    if (
      constructor !== Array &&
      constructor !== Object &&
      isNativeConstructor(constructor)
    ) {
      return true
    }
    prototype = Object.getPrototypeOf(prototype)
  }
  return false
}
