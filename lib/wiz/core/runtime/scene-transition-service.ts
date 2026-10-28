import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import { WizEngineLevelUp } from "@/lib/wiz/core/engine/level-up"
import { WizEngineBattleDefaultRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import type { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import type { WizImmutableValueContract } from "@/lib/wiz/core/immutable-value"
import type { WizSceneBattleCharacterAuthority } from "@/lib/wiz/core/runtime/converters/battle-character-adapter"
import type { WizSceneBattleMonsterAuthority } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import {
  getWizRuntimeContentEntry,
  type WizRuntimeContentView,
} from "@/lib/wiz/core/runtime/content-view"
import type { WizPluginSceneState } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import type { WizPluginSceneNavigationRejectionReason } from "@/lib/wiz/core/runtime/plugin/is-authentic-wiz-plugin-scene-module"
import type { WizPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"
import {
  WizSceneResultFactory,
  type WizSceneResult,
} from "@/lib/wiz/core/runtime/scene-result"
import type {
  WizSceneTransition,
  WizSceneTransitionRejectionReason,
} from "@/lib/wiz/core/runtime/scene-transition"
import { toBattleScene } from "@/lib/wiz/core/runtime/to-battle-scene"
import { toConversationScene } from "@/lib/wiz/core/runtime/to-conversation-scene"
import { toCraftingScene } from "@/lib/wiz/core/runtime/to-crafting-scene"
import { toExplorationScene } from "@/lib/wiz/core/runtime/to-exploration-scene"
import { toInnScene } from "@/lib/wiz/core/runtime/to-inn-scene"
import { toLevelUpScene } from "@/lib/wiz/core/runtime/to-level-up-scene"
import { toQuestScene } from "@/lib/wiz/core/runtime/to-quest-scene"
import { toShopScene } from "@/lib/wiz/core/runtime/to-shop-scene"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import { WizSceneBattleService } from "@/lib/wiz/core/runtime/scenes/battle/wiz-battle-service"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import { WizVaultMonsterStateFactory } from "@/lib/wiz/core/vault/factory/monster-state-factory"

type WizSceneBattleEncounterService<
  TStatus = unknown,
  TCustom = unknown,
> = Readonly<{
  readonly startBattle: (
    party: WizBattleParty<TStatus>,
    enemies: WizBattleEnemyParty<TStatus, TCustom>
  ) => Readonly<{
    readonly encounterScene: WizEngineBattleEncounter<TStatus, TCustom>
  }>
}>

type Dependencies<
  TStatus = unknown,
  TCustom = unknown,
  TPluginState extends WizTransitionPluginState = never,
> = {
  readonly content: Pick<
    WizRuntimeContentView,
    "areas" | "monsters" | "npcs" | "weapons" | "armors"
  >
  readonly shopDialogueService: Pick<
    WizEngineShopDialogueService,
    "getDialogue"
  >
  readonly levelUpService?: WizEngineLevelUp
  readonly battleService?: WizSceneBattleEncounterService<TStatus, TCustom>
  readonly battleCharacterAdapter: WizSceneBattleCharacterAuthority<TStatus>
  readonly battleMonsterAdapter: WizSceneBattleMonsterAuthority<
    TStatus,
    TCustom
  >
  readonly pluginSceneRegistry?: Readonly<{
    readonly resolveNavigation: (
      previousState: WizPluginSceneState,
      navigation: WizPluginSceneNavigation
    ) => TPluginState | WizPluginSceneNavigationRejectionReason | null
  }>
}

type WizTransitionPluginState = WizPluginSceneState & WizImmutableValueContract
type WizTransitionState<
  TPluginState extends WizTransitionPluginState,
  TStatus,
  TCustom,
  TRewardCustom,
> = WizState<TStatus, TCustom, TRewardCustom> | TPluginState

export class WizSceneTransitionService<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
  TPluginState extends WizTransitionPluginState = never,
> {
  private readonly battleService: WizSceneBattleEncounterService<
    TStatus,
    TCustom
  >
  private readonly battleCharacterAdapter: WizSceneBattleCharacterAuthority<TStatus>
  private readonly battleMonsterAdapter: WizSceneBattleMonsterAuthority<
    TStatus,
    TCustom
  >
  private readonly content: Pick<
    WizRuntimeContentView,
    "areas" | "monsters" | "npcs" | "weapons" | "armors"
  >
  private readonly shopDialogueService: Pick<
    WizEngineShopDialogueService,
    "getDialogue"
  >
  private readonly levelUpService: WizEngineLevelUp
  private readonly monsterFactory: WizVaultMonsterStateFactory
  private readonly pluginSceneRegistry: Dependencies<
    TStatus,
    TCustom,
    TPluginState
  >["pluginSceneRegistry"]

  constructor(dependencies: Dependencies<TStatus, TCustom, TPluginState>) {
    this.content = dependencies.content
    this.shopDialogueService = dependencies.shopDialogueService
    this.levelUpService = dependencies.levelUpService ?? new WizEngineLevelUp()
    this.monsterFactory = new WizVaultMonsterStateFactory({
      defs: Object.values(dependencies.content.monsters),
    })
    this.pluginSceneRegistry = dependencies.pluginSceneRegistry
    this.battleService =
      dependencies.battleService ??
      new WizSceneBattleService<TStatus, TCustom>({
        rewardCalculator: new WizEngineBattleDefaultRewardCalculator<
          TStatus,
          TCustom
        >(),
      })
    this.battleCharacterAdapter = dependencies.battleCharacterAdapter
    this.battleMonsterAdapter = dependencies.battleMonsterAdapter
    Object.freeze(this)
  }

  applyResult<TEvent = never, TReason extends string = string>(
    result: WizSceneResult<
      WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
      TEvent,
      TReason
    >
  ): WizSceneResult<
    WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    TEvent,
    TReason | WizSceneTransitionRejectionReason
  > {
    WizSceneResultFactory.assertAuthentic(result)
    if (result.accepted === false || !result.transition) return result
    const transitioned = this.#applyTransition(result.state, result.transition)
    if (transitioned.accepted === false) {
      return transitioned
    }

    return WizSceneResultFactory.accept<
      WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
      readonly TEvent[]
    >(transitioned.state, undefined, result.events as readonly TEvent[])
  }

  #applyTransition(
    state: WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    transition: WizSceneTransition
  ): WizSceneResult<
    WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    never,
    WizSceneTransitionRejectionReason
  > {
    if (transition.type === "GO_TO_PLUGIN_SCENE") {
      return this.#applyPluginNavigation(state, transition)
    }

    if (transition.type === "GO_TO_VILLAGE") {
      return this.#accepted(toVillageScene(state.vault))
    }

    if (transition.type === "GO_TO_SHOP") {
      const dialogue = this.shopDialogueService.getDialogue(transition.shopId)
      if (!dialogue || dialogue.shopId !== transition.shopId) {
        return this.#rejected(state, "TRANSITION_SHOP_NOT_FOUND")
      }
      return this.#accepted(
        toShopScene(state.vault, dialogue.shopId, {
          buyPriceModifier: dialogue.buyPriceModifier,
        })
      )
    }

    if (transition.type === "GO_TO_INN") {
      return this.#accepted(toInnScene(state.vault))
    }

    if (transition.type === "GO_TO_EXPLORATION") {
      const reason = this.#areaRejectionReason(state, transition.areaId)
      return reason
        ? this.#rejected(state, reason)
        : this.#accepted(toExplorationScene(state.vault, transition.areaId))
    }

    if (transition.type === "GO_TO_CONVERSATION") {
      const npcExists =
        getWizRuntimeContentEntry(this.content.npcs, transition.npcId) !==
          undefined &&
        state.vault.npcs.some((npc) => npc.id === transition.npcId)
      return npcExists
        ? this.#accepted(toConversationScene(state.vault, transition.npcId))
        : this.#rejected(state, "TRANSITION_NPC_NOT_FOUND")
    }

    if (transition.type === "GO_TO_QUEST") {
      return this.#accepted(toQuestScene(state.vault))
    }

    if (transition.type === "GO_TO_CRAFTING") {
      return this.#accepted(toCraftingScene(state.vault))
    }

    if (transition.type === "GO_TO_LEVEL_UP") {
      if (!this.levelUpService.shouldLevelUp(state.vault)) {
        return this.#rejected(state, "TRANSITION_LEVEL_UP_NOT_AVAILABLE")
      }
      if (transition.returnAreaId !== null) {
        const reason = this.#areaRejectionReason(state, transition.returnAreaId)
        if (reason) {
          return this.#rejected(state, reason)
        }
      }
      const prepared = this.levelUpService.prepareLevelUp(state.vault)
      return this.#accepted(
        toLevelUpScene(
          prepared.vault,
          prepared.pointsToAllocate,
          transition.returnAreaId
        )
      )
    }

    if (transition.type === "START_BATTLE") {
      const areaReason = this.#areaRejectionReason(state, transition.areaId)
      if (areaReason) {
        return this.#rejected(state, areaReason)
      }
      if (
        !Array.isArray(transition.monsterIds) ||
        transition.monsterIds.length === 0
      ) {
        return this.#rejected(state, "TRANSITION_MONSTERS_REQUIRED")
      }
      const area = getWizRuntimeContentEntry(
        this.content.areas,
        transition.areaId
      )
      if (!area) {
        return this.#rejected(state, "TRANSITION_AREA_NOT_FOUND")
      }
      const monsters = transition.monsterIds.flatMap((monsterId) => {
        if (
          typeof monsterId !== "string" ||
          monsterId.trim().length === 0 ||
          !area.monsterIds.includes(monsterId)
        ) {
          return []
        }
        const monster = this.monsterFactory.get(monsterId)
        return monster ? [monster] : []
      })
      if (monsters.length !== transition.monsterIds.length) {
        return this.#rejected(state, "TRANSITION_MONSTER_NOT_IN_AREA")
      }
      const party = this.battleCharacterAdapter.partyFromVault(
        state.vault.toPlain()
      )
      const enemies = this.battleMonsterAdapter.enemiesFromMonsters(monsters)
      const result = this.battleService.startBattle(party, enemies)
      return this.#accepted(
        toBattleScene<TStatus, TCustom, TRewardCustom>(
          state.vault,
          result.encounterScene,
          transition.areaId
        )
      )
    }

    return this.#rejected(state, "TRANSITION_INVALID")
  }

  #applyPluginNavigation(
    state: WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    navigation: WizPluginSceneNavigation
  ): WizSceneResult<
    WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    never,
    WizSceneTransitionRejectionReason
  > {
    if (this.pluginSceneRegistry === undefined) {
      return this.#rejected(state, "TRANSITION_PLUGIN_NOT_FOUND")
    }
    const resolved = this.pluginSceneRegistry.resolveNavigation(
      state,
      navigation
    )
    if (resolved === null) {
      return this.#rejected(state, "TRANSITION_PLUGIN_NOT_FOUND")
    }
    if (typeof resolved === "string") {
      return this.#rejected(state, resolved)
    }

    return this.#accepted(resolved)
  }

  #areaRejectionReason(
    state: WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    areaId: string
  ): WizSceneTransitionRejectionReason | undefined {
    const definition = getWizRuntimeContentEntry(this.content.areas, areaId)
    const runtimeArea = state.vault.areas.find((area) => area.id === areaId)
    if (!definition || !runtimeArea) {
      return "TRANSITION_AREA_NOT_FOUND"
    }
    return runtimeArea.unlocked ? undefined : "TRANSITION_AREA_LOCKED"
  }

  #accepted(
    state: WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>
  ): WizSceneResult<
    WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    never,
    WizSceneTransitionRejectionReason
  > {
    return WizSceneResultFactory.accept(state)
  }

  #rejected(
    state: WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    reason: WizSceneTransitionRejectionReason
  ): WizSceneResult<
    WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
    never,
    WizSceneTransitionRejectionReason
  > {
    return WizSceneResultFactory.reject<
      WizTransitionState<TPluginState, TStatus, TCustom, TRewardCustom>,
      WizSceneTransitionRejectionReason
    >(state, reason)
  }
}
