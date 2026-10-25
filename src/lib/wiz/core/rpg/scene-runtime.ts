import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WizWorldDispatchError } from "@/lib/wiz/core/world/world"
import { assertRpgCommandSurface } from "@/lib/wiz/core/rpg/commands"
import { WizRpgCompositionComponent } from "@/lib/wiz/core/rpg/composition-manifest"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  WizRpgWorldIdentity,
  type WizRpgRuntimeIdentityComponentKind,
} from "@/lib/wiz/core/rpg/world-identity"

const sceneRuntimeConstructionToken = Symbol("WizRpgSceneRuntime.constructor")
const sceneRuntimeOwnership = new WizObjectService()
const authenticSceneRuntimes = new WeakSet<object>()

const isFeatureOrPolicyComponent = (component: WizRpgCompositionComponent): boolean =>
  component.kind === "feature" || component.kind === "policy"

export type WizRpgSceneDispatchResult<TScene, TEvent, TReason extends string> = Readonly<{
  accepted: boolean
  state: WizDeepReadonly<TScene>
  events: readonly WizDeepReadonly<TEvent>[]
  error: WizWorldDispatchError<TReason> | undefined
}>

const normalizeSceneDispatchResult = <TScene, TEvent, TReason extends string>(
  result: unknown,
): WizRpgSceneDispatchResult<TScene, TEvent, TReason> => {
  if (
    typeof result !== "object" ||
    result === null ||
    !("accepted" in result) ||
    !("state" in result) ||
    !("events" in result)
  ) {
    throw new TypeError("RPG scene dispatch must return accepted, state, and events")
  }
  if (!Array.isArray(result.events)) {
    throw new TypeError("RPG scene dispatch events must be an array")
  }
  const error = "error" in result ? result.error : undefined
  if (result.accepted === true) {
    if (error !== undefined) {
      throw new TypeError("Accepted RPG scene dispatch cannot return an error")
    }
  } else if (result.accepted === false) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      typeof error.code !== "string"
    ) {
      throw new TypeError("Rejected RPG scene dispatch must return a coded error")
    }
  } else {
    throw new TypeError("RPG scene dispatch accepted must be a boolean")
  }
  return Object.freeze({
    accepted: result.accepted,
    error:
      error === undefined
        ? undefined
        : (sceneRuntimeOwnership.ownImmutable<WizWorldDispatchError<TReason>>(
            error as WizWorldDispatchError<TReason>,
          ) as WizWorldDispatchError<TReason>),
    events: sceneRuntimeOwnership.ownImmutable<readonly TEvent[]>(
      result.events as readonly TEvent[],
    ),
    state: sceneRuntimeOwnership.ownImmutable<TScene>(result.state as TScene),
  })
}

export type WizRpgSceneRuntimeDefinition<
  TScene,
  TAction,
  TEvent,
  TReason extends string,
  TActions,
> = Readonly<{
  identity: WizRpgWorldIdentity
  components: readonly WizRpgCompositionComponent<WizRpgRuntimeIdentityComponentKind>[]
  initialScene: TScene
  actions: TActions
  ownsAction: (action: unknown) => action is TAction
  dispatch: (
    scene: WizDeepReadonly<TScene>,
    action: WizDeepReadonly<TAction>,
  ) => WizRpgSceneDispatchResult<TScene, TEvent, TReason>
  capture: (scene: WizDeepReadonly<TScene>) => object
  restore: (input: unknown) => TScene
}>

/**
 * scene runtimeをRPG root compositionへ接続する不変port。
 *
 * 標準scene群も独自scene runtimeも同じ境界を実装する。
 */
export class WizRpgSceneRuntime<TScene, TAction, TEvent, TReason extends string, TActions> {
  readonly identity: WizRpgWorldIdentity
  readonly components: readonly WizRpgCompositionComponent<WizRpgRuntimeIdentityComponentKind>[]
  readonly initialScene: WizDeepReadonly<TScene>
  readonly actions: WizDeepReadonly<TActions>
  readonly ownsAction: (action: unknown) => action is TAction
  readonly dispatch: (
    scene: WizDeepReadonly<TScene>,
    action: WizDeepReadonly<TAction>,
  ) => WizRpgSceneDispatchResult<TScene, TEvent, TReason>
  readonly capture: (scene: WizDeepReadonly<TScene>) => object
  readonly restore: (input: unknown) => WizDeepReadonly<TScene>

  private constructor(
    token: symbol,
    definition: WizRpgSceneRuntimeDefinition<TScene, TAction, TEvent, TReason, TActions>,
  ) {
    if (token !== sceneRuntimeConstructionToken) {
      throw new TypeError("WizRpgSceneRuntime must be created with define()")
    }
    assertRpgCommandSurface(definition.actions, "RPG scene")
    WizRpgWorldIdentity.require(definition.identity, "RPG scene runtime identity")
    this.identity = definition.identity
    for (const [index, component] of definition.components.entries()) {
      WizRpgCompositionComponent.require(component, `RPG scene runtime component at index ${index}`)
    }
    const invalidComponent = definition.components.find(isFeatureOrPolicyComponent)
    if (invalidComponent !== undefined) {
      throw new TypeError(
        `RPG scene runtime cannot declare ${invalidComponent.kind} component "${invalidComponent.key}"`,
      )
    }
    this.components = Object.freeze([...definition.components])
    this.initialScene = sceneRuntimeOwnership.ownImmutable<TScene>(definition.initialScene)
    this.actions = definition.actions as WizDeepReadonly<TActions>
    const ownsAction = Object.freeze(definition.ownsAction.bind(undefined))
    this.ownsAction = Object.freeze((action: unknown): action is TAction => {
      const result: unknown = ownsAction(action)
      if (typeof result !== "boolean") {
        throw new TypeError("RPG scene runtime ownsAction must return a boolean")
      }
      return result
    })
    const dispatch = Object.freeze(definition.dispatch.bind(undefined))
    this.dispatch = Object.freeze(
      (scene: WizDeepReadonly<TScene>, action: WizDeepReadonly<TAction>) =>
        normalizeSceneDispatchResult<TScene, TEvent, TReason>(dispatch(scene, action)),
    )
    this.capture = Object.freeze(definition.capture.bind(undefined))
    const restore = Object.freeze(definition.restore.bind(undefined))
    this.restore = Object.freeze((input: unknown) =>
      sceneRuntimeOwnership.ownImmutable<TScene>(restore(input)),
    )
    authenticSceneRuntimes.add(this)
    Object.freeze(this)
  }

  static define<TScene, TAction, TEvent, TReason extends string, TActions>(
    definition: WizRpgSceneRuntimeDefinition<TScene, TAction, TEvent, TReason, TActions>,
  ): WizRpgSceneRuntime<TScene, TAction, TEvent, TReason, TActions> {
    return new WizRpgSceneRuntime(sceneRuntimeConstructionToken, definition)
  }

  /** @internal world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticSceneRuntimes.has(value)) {
      throw new TypeError(`${label} must be created with WizRpgSceneRuntime.define()`)
    }
  }
}

Object.freeze(WizRpgSceneRuntime.prototype)
Object.freeze(WizRpgSceneRuntime)
