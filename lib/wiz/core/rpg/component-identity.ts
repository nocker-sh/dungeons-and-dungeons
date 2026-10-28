import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizRpgCompositionComponent } from "@/lib/wiz/core/rpg/composition-manifest"
import {
  WizRpgWorldIdentity,
  type WizRpgWorldIdentityComponentKind,
} from "@/lib/wiz/core/rpg/world-identity"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const componentIdentityConstructionToken = Symbol(
  "WizRpgComponentIdentity.constructor"
)
const componentIdentityOwnership = new WizObjectService()
const authenticComponentIdentities = new WeakSet<object>()

/**
 * saveの受理範囲へ影響する一つの構成をrevisionとplain dataで識別する不変値。
 *
 * 関数そのものをhashせず、関数がclosureで参照するtableや閾値をidentityDataとして明示する。
 */
export class WizRpgComponentIdentity {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly revision: string
  readonly digest: string
  readonly #identityData: unknown

  private constructor(token: symbol, revision: string, identityData: unknown) {
    if (token !== componentIdentityConstructionToken) {
      throw new TypeError(
        "WizRpgComponentIdentity must be created with create()"
      )
    }
    if (revision.trim().length === 0 || revision !== revision.trim()) {
      throw new RangeError(
        "RPG component revision must be a non-blank string without surrounding whitespace"
      )
    }
    this.revision = revision
    this.#identityData = componentIdentityOwnership.ownImmutable(identityData)
    this.digest = WizRpgWorldIdentity.create(this.#identityData, revision).value
    authenticComponentIdentities.add(this)
    WizImmutableValue.freeze(this)
  }

  static create(
    revision: string,
    identityData: unknown
  ): WizRpgComponentIdentity {
    return new WizRpgComponentIdentity(
      componentIdentityConstructionToken,
      revision,
      identityData
    )
  }

  /** @internal composition boundary only. */
  static require(value: unknown, label: string): WizRpgComponentIdentity {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticComponentIdentities.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizRpgComponentIdentity.create()`
      )
    }
    return value as WizRpgComponentIdentity
  }

  /** @internal composition root only. */
  extend(
    identity: WizRpgWorldIdentity,
    kind: WizRpgWorldIdentityComponentKind,
    key: string
  ): WizRpgWorldIdentity {
    WizRpgWorldIdentity.require(identity, "RPG composition identity")
    return identity.withComponent(kind, key, this.revision, this.#identityData)
  }

  /** @internal composition root only. */
  describe<const TKind extends WizRpgWorldIdentityComponentKind>(
    kind: TKind,
    key: string
  ): WizRpgCompositionComponent<TKind> {
    return WizRpgCompositionComponent.create(
      kind,
      key,
      this.revision,
      this.#identityData
    )
  }
}

Object.freeze(WizRpgComponentIdentity.prototype)
Object.freeze(WizRpgComponentIdentity)
