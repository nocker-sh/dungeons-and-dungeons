import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import {
  WizRpgWorldIdentity,
  type WizRpgWorldIdentityComponentKind,
} from "@/lib/wiz/core/rpg/world-identity"

const compositionComponentConstructionToken = Symbol("WizRpgCompositionComponent.constructor")
const compositionManifestConstructionToken = Symbol("WizRpgCompositionManifest.constructor")
const authenticCompositionComponents = new WeakSet<object>()

const validateIdentity = (identity: string, label: string): string => {
  if (identity.trim().length === 0 || identity !== identity.trim()) {
    throw new RangeError(`${label} must be a non-blank string without surrounding whitespace`)
  }
  return identity
}

const validateDescriptorValue = (value: string, label: string): string => {
  if (value.trim().length === 0 || value !== value.trim()) {
    throw new RangeError(`${label} must be a non-blank string without surrounding whitespace`)
  }
  return value
}

/**
 * worldへ合成されたFeatureまたはPolicyの診断用descriptor。
 *
 * identityDataそのものは公開せず、内容から導出したdigestだけを保持する。
 */
export class WizRpgCompositionComponent<
  TKind extends WizRpgWorldIdentityComponentKind = WizRpgWorldIdentityComponentKind,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly kind: TKind
  readonly key: string
  readonly revision: string
  readonly dataIdentity: string
  readonly identity: string

  private constructor(
    token: symbol,
    kind: TKind,
    key: string,
    revision: string,
    identityData: unknown,
  ) {
    if (token !== compositionComponentConstructionToken) {
      throw new TypeError("WizRpgCompositionComponent must be created with create()")
    }
    this.kind = kind
    this.key = validateDescriptorValue(key, "RPG composition component key")
    this.revision = validateDescriptorValue(revision, "RPG composition component revision")
    this.dataIdentity = WizRpgWorldIdentity.create(identityData, this.revision).value
    this.identity = WizRpgWorldIdentity.create(
      {
        identityData,
        key: this.key,
        kind,
      },
      this.revision,
    ).value
    authenticCompositionComponents.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TKind extends WizRpgWorldIdentityComponentKind>(
    kind: TKind,
    key: string,
    revision: string,
    identityData: unknown,
  ): WizRpgCompositionComponent<TKind> {
    return new WizRpgCompositionComponent<TKind>(
      compositionComponentConstructionToken,
      kind,
      key,
      revision,
      identityData,
    )
  }

  /** @internal composition boundary only. */
  static require(value: unknown, label: string): WizRpgCompositionComponent {
    if (typeof value !== "object" || value === null || !authenticCompositionComponents.has(value)) {
      throw new TypeError(`${label} must be created with WizRpgCompositionComponent.create()`)
    }
    return value as WizRpgCompositionComponent
  }
}

/** runtimeと全拡張のidentity構成を公開する不変診断manifest。 */
export class WizRpgCompositionManifest {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly runtimeIdentity: string
  readonly worldIdentity: string
  readonly components: readonly WizRpgCompositionComponent[]

  private constructor(
    token: symbol,
    runtimeIdentity: string,
    worldIdentity: string,
    components: readonly WizRpgCompositionComponent[],
  ) {
    if (token !== compositionManifestConstructionToken) {
      throw new TypeError("WizRpgCompositionManifest must be created with create()")
    }
    this.runtimeIdentity = validateIdentity(runtimeIdentity, "RPG runtime identity")
    this.worldIdentity = validateIdentity(worldIdentity, "RPG world identity")
    for (const [index, component] of components.entries()) {
      WizRpgCompositionComponent.require(component, `RPG composition component at index ${index}`)
    }
    const duplicateComponent = components.find(
      (component, index) =>
        components.findIndex(
          (candidate) => candidate.kind === component.kind && candidate.key === component.key,
        ) !== index,
    )
    if (duplicateComponent !== undefined) {
      throw new RangeError(
        `Duplicate RPG composition component "${duplicateComponent.kind}:${duplicateComponent.key}"`,
      )
    }
    this.components = Object.freeze([...components])
    WizImmutableValue.freeze(this)
  }

  static create(
    runtimeIdentity: string,
    worldIdentity: string,
    components: readonly WizRpgCompositionComponent[],
  ): WizRpgCompositionManifest {
    return new WizRpgCompositionManifest(
      compositionManifestConstructionToken,
      runtimeIdentity,
      worldIdentity,
      components,
    )
  }

  list(): readonly WizRpgCompositionComponent[]
  list<const TKind extends WizRpgWorldIdentityComponentKind>(
    kind: TKind,
  ): readonly WizRpgCompositionComponent<TKind>[]
  list(kind?: WizRpgWorldIdentityComponentKind): readonly WizRpgCompositionComponent[] {
    return kind === undefined
      ? this.components
      : Object.freeze(this.components.filter((component) => component.kind === kind))
  }

  find<const TKind extends WizRpgWorldIdentityComponentKind>(
    kind: TKind,
    key: string,
  ): WizRpgCompositionComponent<TKind> | undefined {
    return this.components.find((component) => component.kind === kind && component.key === key) as
      | WizRpgCompositionComponent<TKind>
      | undefined
  }
}

Object.freeze(WizRpgCompositionComponent.prototype)
Object.freeze(WizRpgCompositionComponent)
Object.freeze(WizRpgCompositionManifest.prototype)
Object.freeze(WizRpgCompositionManifest)
