# open-wiz

任意のRPGルールを不変なmoduleとして合成する、UI非依存のTypeScript world engineです。
利用側はclassで構成とcommandを発見でき、状態計算は純粋関数として差し替えられます。

- `with*()`は元の値を変更せず、新しい構成を返す
- contentのliteral IDをcommandとsnapshotまで伝播する
- 外部入力はschemaまたはcodecで検証する
- state、action、event、saveをruntime境界で所有して不変化する
- content・scene・横断feature・認可policy・計算mechanicsを独立して合成する
- content・runtime revision・feature/policy revisionからsave identityを決定する

## Scope

open-wizが所有するのは、ローカルの状態、command、規則計算、domain event、snapshotです。
HTTP、WebSocket、認証、DB、サーバprocess、描画、入力、物理、当たり判定、animationは含みません。
MMORPGでは各actorや予測simulationの計算核として使い、同期と永続化は利用側が担当します。
見下ろし型Action RPGでも同じ境界で、inventory、装備、Ability、status、報酬を部分利用できます。

## Install

任意categoryと任意ruleだけを使う汎用kernel、および`open-wiz/rpg/state`の
Item・Inventory・Equipment・Ability・Resourceには、追加のruntime dependencyはありません。

```sh
bun add open-wiz
```

標準world、battle、content schemaを使う場合はZodも追加します。

```sh
bun add open-wiz zod
```

| 目的 | 入口 |
| --- | --- |
| 任意state・action・categoryの汎用kernel | `open-wiz` |
| world composition | `open-wiz/rpg` |
| 静的content・snapshot | `open-wiz/rpg/content` |
| inventory・Ability・resourcesなどの動的state | `open-wiz/rpg/state` |
| battle model・戦闘計算port | `open-wiz/rpg/battle` |
| plugin scene・標準system・成長規則の差し替え | `open-wiz/rpg/extensions` |
| formatter・日本語presentation | `open-wiz/rpg/presentation` |

## Action RPG

移動、物理、当たり判定、animationは利用側のsimulationに置き、アイテム所有、Ability習得、
loadout、cooldown、domain event、saveをopen-wizで管理できます。

```ts
import {
  WizAbility,
  WizAbilityCatalog,
  WizAbilityExecutor,
  WizAbilityLoadout,
  WizAbilityReadiness,
  WizEffectResistanceSet,
  WizEquipmentLoadout,
  WizInventory,
  WizInventoryEntry,
  WizQuestObjectiveProgress,
  WizRankProgression,
  WizResourceSet,
  WizThreatTable,
} from "open-wiz/rpg/state"

const dash = WizAbility.define({
  id: "dash",
  name: "Dash",
  tags: ["movement"],
  costs: { stamina: 15 },
  cooldownMs: 800,
  maximumCharges: 2,
  recoveryTimeMs: 150,
  effect: {
    kind: "move",
    distance: 4,
  } as const,
})

const abilities = WizAbilityCatalog.create([dash])
const book = abilities.createBook(["dash"])
const loadout = WizAbilityLoadout
  .create(book, ["primary", "secondary"] as const)
  .assign("primary", "dash")
const execution = new WizAbilityExecutor().execute({
  ability: dash,
  atMs: 10_000,
  book,
  readiness: WizAbilityReadiness.create(),
  resources: WizResourceSet.create({
    stamina: { current: 50, maximum: 50 },
  }),
  target: { actorId: "player" },
})
const potion = WizInventoryEntry.define({
  entryId: "potion-stack",
  contentType: "item",
  contentId: "potion",
  quantity: 3,
})
const inventory = WizInventory.create({
  capacity: 20,
  entries: [potion],
})
const gatheringObjective = WizQuestObjectiveProgress
  .create({ kind: "gather", targetId: "herb", current: 0, required: 3 })
  .record({ kind: "gather", targetId: "herb", amount: 1 })
```

`effect`は利用側のdiscriminated unionとして推論されます。方向、範囲、hitbox、projectileなどを
固定enumへ閉じ込めません。`WizAbilityExecutor`は習得、policy、resource、cooldownを原子的に判定し、
発動したeffectとcast・recovery時刻を返します。frame更新、対象探索、当たり判定は利用側が所有します。
`WizQuestObjectiveProgress`は目標と実eventの照合、必要数での上限だけを担当します。受注条件、
報酬、party共有、通信、永続化は利用側が所有します。

```ts
const mastery = WizRankProgression.create({
  experience: 7,
  thresholds: [0, 3, 8, 15],
})

mastery.rank // 2
mastery.nextRankAt // 8
mastery.gain(1).rank // 3
```

`WizRankProgression`は累積経験値をrankと次のしきい値へ写すだけです。経験値の発生源、
rankで解放する能力、報酬、永続化は作品側が所有します。

```ts
const threat = WizThreatTable
  .create<"strider" | "warden">()
  .add("strider", 8)
  .add("warden", 12)

threat.highest() // { actorId: "warden", threat: 12 }
threat.retain(["strider"]).highest() // { actorId: "strider", threat: 8 }
```

`WizThreatTable`は脅威値の不変加算、候補除外、同値をactor IDで解く決定的な標的選択だけを
担当します。damage・回復・挑発から何点を生むか、生死・距離・陣営、減衰、通信、永続化は
作品側が所有します。

```ts
const resistances = WizEffectResistanceSet.create({
  entries: [
    { effectId: "stunned", resistance: 0.5 },
    { effectId: "bleeding", resistance: 1 },
  ],
})

resistances.resolveDuration("stunned", 1_600).durationMs // 800
resistances.resolveDuration("bleeding", 4_000).isImmune // true
```

`WizEffectResistanceSet`はeffect IDごとの耐性と基礎時間から、短縮後の有効時間と完全耐性を
決定します。effectの意味、付与条件、stack、解除、対象探索、通信、永続化は作品側が所有します。

固有装備は同じ`contentId`でも別の`entryId`とcustom stateを持てます。

```ts
const blade = WizInventoryEntry.define({
  entryId: "blade-1",
  contentType: "weapon",
  contentId: "blade",
  quantity: 1,
  custom: {
    durability: 80,
    affixes: ["sharp"],
  },
})
const inventoryWithBlade = inventory.insert(blade)
const equipment = WizEquipmentLoadout
  .create(inventoryWithBlade, ["mainHand", "offHand"] as const)
  .equip("mainHand", "blade-1", inventoryWithBlade)
```

## Standard RPG

### Contentからworldを作る

```ts
import { WizRpgWorldDefinition } from "open-wiz/rpg"
import { WorldContent } from "open-wiz/rpg/content"

const content = WorldContent.create({
  items: [
    {
      id: "herb",
      name: "Herb",
      description: "A restorative herb",
      itemType: "consumable",
      price: 20,
      sellPrice: 10,
      effect: { type: "heal", value: 20 },
    },
  ],
  weapons: [
    {
      id: "blade",
      name: "Blade",
      description: "A short blade",
      attack: 4,
      dexterityBonus: 0,
      slotId: "mainHand",
      price: 50,
      sellPrice: 25,
    },
  ],
  areas: [
    {
      id: "meadow",
      name: "Meadow",
      description: "A quiet meadow",
      dangerLevel: 1,
      apCost: 1,
      unlocked: true,
      availableGathering: ["herb"],
      monsterIds: [],
      eventIds: [],
    },
  ],
  innPlans: [
    {
      id: "moon-rest",
      price: 25,
      hpRecovery: { fixed: 10, percent: 25 },
      mpRecovery: { percent: 50 },
      hungerRecovery: 20,
      apRecovery: "full",
    },
  ],
} as const)

const world = WizRpgWorldDefinition
  .forContent(content, "my-world-1")
  .build()
```

省略したcategoryは空配列へ正規化されます。JSONなどの外部入力には
`WorldContent.parse(input)`を使います。shape、空ID、重複ID、参照先、cycleをまとめて検証します。

### 型付きcommand

完成したworldはscene commandを`world.commands.scene`へ公開します。
contentにないliteral IDや、別scopeのIDはcompile時に拒否されます。wideな`string`はcommand
factoryで検証されます。

```ts
const entered = world.dispatch(
  world.initialState,
  world.commands.scene.area("meadow").enter(),
)

const explored = world.dispatch(
  entered.state,
  world.commands.scene.area("meadow").act("explore"),
)

const selectedStayPlan = world.commands.scene.selectStayPlan("moon-rest")
const stayPlanId: "moon-rest" = selectedStayPlan.plan
```

宿泊プランも固定enumではありません。HP・MPは固定値と割合を合成でき、APは回復量または
`"full"`を指定できます。料金、回復、IDは静的contentに一度だけ置き、scene stateとsaveは
IDだけを保持します。

装備slotは固定enumではなくcontent definitionから決まります。

```ts
const contentWithInventory = WorldContent.create({
  weapons: [
    {
      id: "blade",
      name: "Blade",
      description: "A short blade",
      attack: 4,
      dexterityBonus: 0,
      slotId: "mainHand",
      price: 50,
      sellPrice: 25,
    },
  ],
} as const)

const snapshot = contentWithInventory.createInitialSnapshot({
  inventory: {
    capacity: 20,
    entries: [
      {
        entryId: "blade-entry",
        contentType: "weapon",
        contentId: "blade",
        quantity: 1,
      },
    ],
  },
})

const equippedWorld = WizRpgWorldDefinition
  .forContent(contentWithInventory, "equipment-example-1")
  .withInitialSnapshot(snapshot)
  .build()

const equipped = equippedWorld.dispatch(
  equippedWorld.initialState,
  equippedWorld.commands.scene.equip("blade-entry", "mainHand"),
)
```

標準のslot規則を越える装備には`WizRpgEquipmentRules`を使います。rulesは
完全な次のequipment stateを返す純粋関数なので、左右どちらにも着けられる装飾品、
両手武器の複数slot占有、職業制限、capacity制を表現できます。

### Save

sceneと全featureは一つのenvelopeへ保存されます。identityは正規化済みcontent、
`forContent(content, revision)`のruntime revision、全runtime構成、Feature、Policyから
SHA-256で生成されます。

```ts
const stored = JSON.stringify(world.save(explored.state))
const untrusted: unknown = JSON.parse(stored)
const restored = world.restore(untrusted)
```

identity、schema、JSON safety、content参照はrestore時に検証されます。異なるcontentのsaveは
受理されません。

保存結果に影響する構成には`WizRpgComponentIdentity`を必須にします。closureで参照する
派閥定義、経済テーブル、閾値などのplain dataとrevisionを渡すと、関数を文字列化せず内容差を
world identityへ反映できます。構成データがない場合も`Object.freeze({})`を明示します。

`world.manifest`はruntime identity、最終world identity、合成順どおりのFeature・Policyを
不変な診断値として公開します。各componentにはkind、key、revision、構成データだけの
`dataIdentity`、keyとkindを含む`identity`があり、元データを露出せず保存不一致を調査できます。

### 不変な段階構成

definitionの各methodは新しいdefinitionを返します。

```ts
const configured = WizRpgWorldDefinition
  .forContent(content, "configured-example-1")
  .withInitialSnapshot(content.createInitialSnapshot())
  .withPreset(
    preset,
    WizRpgComponentIdentity.create("1", presetIdentityData),
  )
  .withMechanics(
    mechanics,
    WizRpgComponentIdentity.create("1", mechanicsIdentityData),
  )

const firstWorld = configured.build()
const secondWorld = configured.build()
```

`build()`で生成したworld同士はstateとbuilt-in commandの出自を共有しません。

## Cross-scene feature

評判、派閥、実績、関係性、経済など、sceneを横断する仕組みは`WizRpgFeature`にします。
featureはstate、command class、純粋reducer、event reaction、save codecを一単位にします。

```ts
import { z } from "zod"
import {
  WizRpgComponentIdentity,
  WizRpgFeature,
  WizRpgFeatureCodec,
} from "open-wiz/rpg"

type ReputationState = Readonly<{ points: number }>
type ReputationAction = Readonly<{
  type: "GAIN_REPUTATION"
  amount: number
}>
class ReputationCommands {
  constructor() {
    Object.freeze(this)
  }

  gain(amount: number): ReputationAction {
    return Object.freeze({
      type: "GAIN_REPUTATION",
      amount,
    })
  }
}

Object.freeze(ReputationCommands.prototype)
Object.freeze(ReputationCommands)

const reputation = WizRpgFeature.forWorld(world).define({
  key: "reputation",
  identity: WizRpgComponentIdentity.create(
    "1",
    Object.freeze({
      tiers: Object.freeze(["unknown", "known", "trusted"]),
    }),
  ),
  action: z.strictObject({
    type: z.literal("GAIN_REPUTATION"),
    amount: z.number(),
  }),
  initialState: Object.freeze({ points: 0 }),
  commands: new ReputationCommands(),
  codec: WizRpgFeatureCodec.define({
    schema: z.strictObject({
      points: z.number().int().nonnegative(),
    }),
    capture: (state: ReputationState) => ({
      points: state.points,
    }),
    restore: (data): ReputationState =>
      Object.freeze({ points: data.points }),
  }),
  reduce: (context, action) =>
    action.amount < 1
      ? {
          accepted: false,
          reason: "REPUTATION_AMOUNT_INVALID",
        }
      : {
          accepted: true,
          state: {
            points: context.state.points + action.amount,
          },
          events: [{
            type: "REPUTATION_GAINED",
            amount: action.amount,
          }],
        },
})

const extendedWorld = world.withFeature(reputation)
const gained = extendedWorld.dispatch(
  extendedWorld.initialState,
  extendedWorld.commands.feature("reputation").gain(3),
)
```

feature key、state、command、action、event、reasonは`withFeature()`の戻り値へ追加されます。
公開commandが返すactionは`WizRpgFeatureAction`へ自動的に包まれます。feature keyがclass instanceへ
保持されるため、scene runtimeや別featureが同じaction schemaを使ってもroutingは衝突しません。
policyとreducerへ同じ値を渡すため、feature action schemaは検証専用で、入出力型を変えるtransformを
受理しません。正規化が必要ならcommand class内で行います。

先行featureがあるworldから次のfeatureを定義すると、`context.features`で先行stateを型安全に
参照できます。依存featureを持たないworldへ追加しようとするとcompile時に拒否されます。更新は
自分のstateに限定し、他featureの更新はevent reactionで接続するため、不変性を維持できます。

`dispatch()`結果の`eventRecords`には各eventの`source`と`causedBy`が残ります。scene直発、
feature直発、reaction由来を値の抽出なしで追跡でき、循環上限エラーにも原因featureとevent位置が
含まれます。reactionはreducerと同じ型付きreasonで拒否でき、その場合はdispatch中のstateと
eventをすべてrollbackして`FEATURE_REACTION_REJECTED`を返します。値だけが必要な場合は
`events`を使います。

## Policy and affordance

実行認可とUIの有効状態は`WizRpgPolicy`へまとめます。UIだけをdisabledにしてruntimeを通す、
またはruntimeだけを拒否する不一致を避けられます。

```ts
import {
  WizRpgAffordance,
  WizRpgComponentIdentity,
  WizRpgFeatureAction,
  WizRpgPolicy,
} from "open-wiz/rpg"

type ExtendedAction = Parameters<typeof extendedWorld.dispatch>[1]

const policy = WizRpgPolicy.define<
  typeof extendedWorld.initialState,
  ExtendedAction,
  "REPUTATION_LOCKED"
>({
  identity: WizRpgComponentIdentity.create(
    "1",
    Object.freeze({ threshold: 1 }),
  ),
  name: "reputation-availability",
  authorize: (state, action) =>
    action instanceof WizRpgFeatureAction &&
    action.featureKey === "reputation" &&
    state.scene.type !== "village"
      ? { allowed: false, reason: "REPUTATION_LOCKED" }
      : { allowed: true },
  affordances: (state) => [
    WizRpgAffordance.define({
      id: "gain-reputation",
      action: extendedWorld.commands.feature("reputation").gain(1),
    }),
  ],
})

const authorizedWorld = extendedWorld.withPolicy(policy)
const affordances = authorizedWorld.affordances(
  authorizedWorld.initialState,
)
```

policyはその時点のscene・feature action union全体を認可します。action unionを古い型のまま
残さないため、全featureを追加してからpolicyを追加します。policy追加後の`withFeature()`は
compile時とruntimeの両方で拒否されます。policyは複数追加できます。affordanceの
`enabled`と`reason`は、候補actionを全policyで認可した最終結果からworldが決定します。

## Custom scene

追加sceneはruntime moduleと保存codecを`WizRpgScenes`で束ねます。moduleだけ、またはcodecだけの
登録はできません。scene type集合が一致しない構成も拒否されます。

```ts
import { z } from "zod"
import {
  WizRpgComponentIdentity,
  WizRpgSceneState,
  WizRpgWorldDefinition,
} from "open-wiz/rpg"
import {
  WizPluginSceneModule,
  WizPluginSceneRegistry,
  WizPluginSceneResultFactory,
  WizRpgScenes,
  WizStandardPluginSceneCodec,
} from "open-wiz/rpg/extensions"

type CampState = WizRpgSceneState<
  "camp",
  Readonly<{ rests: number }>
>

const camp = WizPluginSceneModule.define({
  type: "camp",
  action: z.strictObject({
    type: z.literal("REST_AT_CAMP"),
  }),
  navigation: {
    from: ["village"],
    schema: z.strictObject({}),
    create: (vault): CampState =>
      WizRpgSceneState.create("camp", vault, { rests: 0 }),
  },
  reduce: (state: CampState) =>
    WizPluginSceneResultFactory.accept(
      state.mapData((data) => ({
        rests: data.rests + 1,
      })),
    ),
})

const campCodec = WizStandardPluginSceneCodec.define({
  type: "camp",
  schema: z.strictObject({
    rests: z.number().int().nonnegative(),
  }),
  capture: (state: CampState) => ({
    rests: state.data.rests,
  }),
  restore: (data, context): CampState =>
    WizRpgSceneState.create("camp", context.vault, data),
})

const scenes = WizRpgScenes.define(
  WizPluginSceneRegistry.define([camp]),
  [campCodec],
)

const campWorld = WizRpgWorldDefinition
  .forContent(content, "camp-example-1")
  .withScenes(
    scenes,
    WizRpgComponentIdentity.create(
      "1",
      Object.freeze({ sceneTypes: Object.freeze(["camp"]) }),
    ),
  )
  .build()

const enteredCamp = campWorld.dispatch(
  campWorld.initialState,
  camp.enter({}),
)
const restedAtCamp = campWorld.dispatch(
  enteredCamp.state,
  { type: "REST_AT_CAMP" },
)
```

moduleが生成した遷移も通常の`dispatch()`を通るため、policy、event reaction、state ownership、
saveの経路を迂回しません。

## Mechanics

戦闘実行、行動順、敵AI、報酬計算、報酬反映、探索、敗北規則、装備規則、空腹規則、親密度規則、
宿泊規則、仲間の成長規則は
`WizRpgMechanics`で差し替えます。`standardActionReducer`は処理する組み込みactionだけ
resultを返し、それ以外を`null`で標準処理へ委譲できます。factoryはworld構築時に一度だけ
解決され、content、preset、正規battle content、決定論的なenvironmentを受け取ります。

```ts
import {
  WizRpgComponentIdentity,
  WizRpgWorldDefinition,
} from "open-wiz/rpg"
import {
  WizConversationAffinitySystem,
  WizEnginePartyLevelUp,
  WizPartyMemberGrowthTable,
  WizRpgMechanics,
  WizVaultHungerService,
} from "open-wiz/rpg/extensions"

const hungerService = new WizVaultHungerService({
  bands: [
    {
      state: "ready",
      minimum: 20,
      impact: { actionPointReduction: 0, abilityPowerMultiplier: 1, hpLoss: 0 },
    },
  ],
  fallback: {
    state: "weakened",
    impact: { actionPointReduction: 1, abilityPowerMultiplier: 0.8, hpLoss: 3 },
  },
})

const affinitySystem = new WizConversationAffinitySystem({
  minimum: 0,
  maximum: 100,
  levels: [
    { id: "unmet", minimum: 0 },
    { id: "trusted", minimum: 40 },
  ] as const,
})

const mechanics = WizRpgMechanics.defineForContent(content, {
  affinitySystem: () => affinitySystem,
  enemyAI: (context) => customEnemyAI(context),
  defeatPolicy: (context) => customDefeatPolicy(context),
  hungerService: () => hungerService,
  partyLevelUp: () =>
    new WizEnginePartyLevelUp(
      new WizPartyMemberGrowthTable({
        classes: {
          chronomancer: {
            hp: 2,
            mp: 7,
            attributes: { wisdom: 4 },
          },
        },
        fallback: { hp: 1, mp: 1 },
      }),
    ),
})

const customizedWorld = WizRpgWorldDefinition
  .forContent(content, "mechanics-example-1")
  .withMechanics(
    mechanics,
    WizRpgComponentIdentity.create(
      "1",
      Object.freeze({
        affinity: "trust-v1",
        enemyAI: "custom-enemy-ai",
        defeatPolicy: "custom-defeat-policy",
        hunger: "survival-v1",
        partyGrowth: "chronomancer-v1",
      }),
    ),
  )
  .build()
```

custom battle status・monster data・rewardを使う場合は`WizRpgBattleModel`でpreset、
mechanics、monster adapter、reward save codecを一つに束ねて`withBattleModel()`へ渡します。
型が一つでも不一致ならworldを構築できません。

計算portはreadonlyな関数プロパティとして注入し、入力を変更せず新しい結果を返します。
乱数、時刻、IDは`WizWorldEnvironment`へ注入できます。

## Completely custom runtime

標準scene構成を使わないRPGは`WizRpgSceneRuntime`から始めます。scene state、command class、
dispatch、capture、restoreを定義し、同じfeature・policy・save rootへ接続できます。

```ts
import {
  WizRpgSceneRuntime,
  WizRpgWorld,
  WizRpgWorldIdentity,
} from "open-wiz/rpg"

const runtime = WizRpgSceneRuntime.define({
  components: Object.freeze([]),
  identity: WizRpgWorldIdentity.create(contentData, "custom-runtime-1"),
  initialScene,
  actions: sceneCommands,
  ownsAction,
  dispatch,
  capture,
  restore,
})

const customWorld = WizRpgWorld.fromRuntime(runtime)
```

sceneとfeatureのcommand surfaceは、class instance、prototype、公開nested metadataまで
deep immutableである必要があります。worldから見えるcommand型も全階層readonlyになります。

## Generic kernel

RPGの前提を一切持たない構成には`open-wiz`を使います。

```ts
import {
  WizWorld,
  WizWorldModule,
} from "open-wiz"

type CounterState = Readonly<{ count: number }>
type CounterAction = Readonly<{
  type: "ADD"
  amount: number
}>

const counter = WizWorldModule.define<
  CounterState,
  CounterAction
>({
  name: "counter",
  accepts: (action): action is CounterAction =>
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "ADD",
  reduce: (state, action) => ({
    accepted: true,
    state: {
      count: state.count + action.amount,
    },
  }),
})

const genericWorld = WizWorld
  .create<CounterState>({ count: 0 })
  .with(counter)
```

独立state slice、event reaction、任意content category、Standard Schema、汎用save codecも
`open-wiz`から選択できます。汎用入口から標準RPGやZodへ到達しません。

## Package guarantees

- ESM JavaScriptと`.d.ts`を生成する
- package exportは責務ごとに分割し、同じ名前を複数entrypointからexportしない
- app固有pathを公開型へ残さない
- packした汎用consumerをZodなしでtypecheck・実行する
- packしたRPG consumerでcontent ID、装備、追加scene、feature、policy、saveを検証する
- 公開objectのconstructor、prototype、instanceを不変にする
- 現行schemaとcontent identityだけを受理する

## License

MIT
