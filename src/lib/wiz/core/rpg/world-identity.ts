import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"

const worldIdentityConstructionToken = Symbol("WizRpgWorldIdentity.constructor")
const authenticWorldIdentities = new WeakSet<object>()

const SHA256_INITIAL_STATE = Object.freeze([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const SHA256_ROUND_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotateRight = (value: number, amount: number): number =>
  (value >>> amount) | (value << (32 - amount))

const sha256 = (value: string): string => {
  const source = new TextEncoder().encode(value)
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(source)
  padded[source.length] = 0x80
  const bitLength = source.length * 8
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const state = [...SHA256_INITIAL_STATE]
  const words = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4)
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] ?? 0
      const previous2 = words[index - 2] ?? 0
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3)
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10)
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = state as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 =
        (h + sum1 + choice + (SHA256_ROUND_CONSTANTS[index] ?? 0) + (words[index] ?? 0)) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }
    state[0] = ((state[0] ?? 0) + a) >>> 0
    state[1] = ((state[1] ?? 0) + b) >>> 0
    state[2] = ((state[2] ?? 0) + c) >>> 0
    state[3] = ((state[3] ?? 0) + d) >>> 0
    state[4] = ((state[4] ?? 0) + e) >>> 0
    state[5] = ((state[5] ?? 0) + f) >>> 0
    state[6] = ((state[6] ?? 0) + g) >>> 0
    state[7] = ((state[7] ?? 0) + h) >>> 0
  }

  return state.map((entry) => entry.toString(16).padStart(8, "0")).join("")
}

const canonicalizeWorldValue = (
  value: unknown,
  activeObjects: WeakSet<object> = new WeakSet(),
): string => {
  if (value === null) return "null"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("RPG world identity requires finite numbers")
    }
    return Object.is(value, -0) ? "0" : String(value)
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError("RPG world identity accepts only plain arrays")
    }
    if (activeObjects.has(value)) {
      throw new TypeError("RPG world identity cannot serialize cyclic values")
    }
    activeObjects.add(value)
    const entries = Array.from({ length: value.length }, (_, index) => {
      if (!Object.hasOwn(value, index)) {
        throw new TypeError(`RPG world identity cannot serialize sparse array index ${index}`)
      }
      return canonicalizeWorldValue(value[index], activeObjects)
    })
    activeObjects.delete(value)
    return `[${entries.join(",")}]`
  }
  if (typeof value !== "object") {
    throw new TypeError(`RPG world identity cannot serialize ${typeof value}`)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== null && prototype !== Object.prototype) {
    throw new TypeError("RPG world identity accepts only plain objects")
  }
  if (activeObjects.has(value)) {
    throw new TypeError("RPG world identity cannot serialize cyclic values")
  }
  activeObjects.add(value)
  const entries = Reflect.ownKeys(value)
    .map((key) => {
      if (typeof key !== "string") {
        throw new TypeError("RPG world identity cannot serialize symbol keys")
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError(`RPG world identity requires enumerable data property "${key}"`)
      }
      return [key, descriptor.value] as const
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeWorldValue(entry, activeObjects)}`)
  activeObjects.delete(value)
  return `{${entries.join(",")}}`
}

const validateRevision = (revision: string): string => {
  if (revision.trim().length === 0 || revision !== revision.trim()) {
    throw new RangeError("RPG revision must be a non-blank string without surrounding whitespace")
  }
  return revision
}

export type WizRpgWorldIdentityComponentKind =
  | "battle-model"
  | "environment"
  | "feature"
  | "item-effect"
  | "mechanics"
  | "policy"
  | "preset"
  | "scenes"

export type WizRpgRuntimeIdentityComponentKind = Exclude<
  WizRpgWorldIdentityComponentKind,
  "feature" | "policy"
>

/**
 * contentとruntime構成revisionから導出される保存用identity。
 *
 * behaviorを変更するextensionはrevisionを必須とし、同じcontentでも異なる構成のsaveを拒否する。
 */
export class WizRpgWorldIdentity {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly value: string
  readonly #canonical: string

  private constructor(token: symbol, canonical: string) {
    if (token !== worldIdentityConstructionToken) {
      throw new TypeError("WizRpgWorldIdentity must be created with create()")
    }
    this.#canonical = canonical
    this.value = `rpg-${sha256(canonical)}`
    authenticWorldIdentities.add(this)
    WizImmutableValue.freeze(this)
  }

  static create(content: unknown, runtimeRevision: string): WizRpgWorldIdentity {
    return new WizRpgWorldIdentity(
      worldIdentityConstructionToken,
      canonicalizeWorldValue({
        content,
        runtimeRevision: validateRevision(runtimeRevision),
      }),
    )
  }

  /** @internal composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticWorldIdentities.has(value)) {
      throw new TypeError(`${label} must be created with WizRpgWorldIdentity.create()`)
    }
  }

  withComponent(
    kind: WizRpgWorldIdentityComponentKind,
    key: string,
    revision: string,
    identityData: unknown,
  ): WizRpgWorldIdentity {
    WizRpgWorldIdentity.require(this, "RPG world identity")
    if (key.trim().length === 0 || key !== key.trim()) {
      throw new RangeError(
        "RPG identity component key must be a non-blank string without surrounding whitespace",
      )
    }
    return new WizRpgWorldIdentity(
      worldIdentityConstructionToken,
      canonicalizeWorldValue({
        base: this.#canonical,
        component: {
          identityData,
          key,
          kind,
          revision: validateRevision(revision),
        },
      }),
    )
  }
}

Object.freeze(WizRpgWorldIdentity.prototype)
Object.freeze(WizRpgWorldIdentity)
