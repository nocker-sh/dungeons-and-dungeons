# open-wiz architecture

## Goal

open-wizは、RPGの共通部分を固定継承階層へ閉じ込めず、型付きの不変compositionとして提供する。

- APIを使う側はclassのmethodから構成とcommandを発見できる
- 状態計算は純粋関数またはreadonly portとして差し替えられる
- observableな可変状態を持たない
- 作品固有contentとruntime stateを分離する
- 少ない記述で標準RPGを開始でき、必要な軸だけを差し替えられる
- 完全に異なるRPGも同じworld root、feature、policy、saveを利用できる

## Public entries

```text
open-wiz
  provider-neutral kernel
  arbitrary content catalog
  Standard Schema boundary
  generic save
  immutable ownership

open-wiz/rpg
  WizRpgWorldDefinition
  WizRpgWorld
  WizRpgFeature
  WizRpgPolicy

open-wiz/rpg/content
  WorldContent
  WorldSnapshot
  static content definitions and references

open-wiz/rpg/state
  inventory and equipment
  action-neutral Ability definitions and ownership
  attributes, resources, modifiers, effects, and wallet

open-wiz/rpg/battle
  WizRpgBattleModel
  battle ports and battle preset

open-wiz/rpg/extensions
  WizRpgScenes
  WizRpgMechanics
  WizRpgEquipmentRules
  party growth
  plugin scene and standard system ports

open-wiz/rpg/presentation
  formatter
  provider-neutral message types
  Japanese presentation presets
```

標準runtimeを組み立てる内部class、session codec、組み込みstate constructorは公開しない。
利用者は完成した`WizRpgWorld`を操作し、拡張点には専用のcomposition valueを渡す。

## Composition flow

```text
WorldContent
  -> WizRpgWorldDefinition.forContent(content, revision)
       -> withInitialSnapshot()
       -> withInitialTransition()
       -> withEnvironment()
       -> withItemEffect()
       -> withPreset()
       -> withMechanics()
       -> withBattleModel()
       -> withScenes()
       -> build()
  -> WizRpgWorld
       -> withFeature()
       -> withPolicy()
       -> commands
       -> dispatch()
       -> affordances()
       -> save() / restore()
```

各`with*()`は元のinstanceを変更せず、受け取ったclassの生成元を検証し、plain dataや関数依存を
その呼び出し時点で防御所有する。`build()`は利用側objectを再参照せず、runtime authorityと
save codecを同時に束縛するため、利用側に同期すべき内部objectを残さない。

## Runtime layers

```text
WizRpgWorld
  scene: WizRpgSceneRuntime
  features: readonly WizRpgFeature[]
  policies: readonly WizRpgPolicy[]
  commands: WizRpgCommands
  composition manifest: runtime and component identities
  save codec: root-owned

WizRpgSceneRuntime
  content identity
  initial scene
  scene command class
  action ownership
  dispatch
  capture / restore
```

標準RPGも独自RPGも`WizRpgSceneRuntime`へ収束する。rootは具体的なscene種類を知らず、
feature reaction、policy、saveを同じ順序で適用する。

rootの`manifest`はruntime identityと最終world identityに加え、Mechanics・Preset・追加Scene・
Environment・Item Effect・Battle Model・Feature・Policyのkind、key、revision、構成データdigestを
保持する。保存のcontent versionだけでは原因を特定できない構成差を、元データを公開せず診断できる。
標準runtimeの独立構成はkindとkeyで正規順序へ並べ、`with*()`の呼び順や上書き履歴をidentityへ
混入させない。FeatureとPolicyは実行順が意味を持つためcomposition順を保持する。

## Command model

commandは不変classから生成する。
command surfaceはinstance、prototype、nested metadataを実行時検証し、公開型もdeep readonlyにする。

```text
world.commands.scene
  area(areaId)
  npc(npcId)
  quest(questId)
  recipe(recipeId)
  shop(shopId)
  battle
  equip(entryId, slotId)
  unequip(slotId)
  ...

world.commands.feature(featureKey)
  -> feature固有command surface
  -> WizRpgFeatureAction(featureKey, payload)
```

content scopeを選ぶmethodは、次のmethodが受理できるliteral IDを狭める。
wideな入力はruntimeで検証する。built-in commandは作成元runtimeの観測不能な出自を持ち、
plain objectや別worldのcommandをbuilt-in actionとして扱わない。

plugin sceneのactionはschemaで正規化する。plugin moduleが生成する遷移も
`WizRpgWorld.dispatch()`へ渡し、policyとroot event処理を通す。

## Feature

`WizRpgFeature`はscene横断の一機能を表す。

```text
feature
  key
  component identity
  initial state
  command class
  action schema
  pure reduce(context, action)
  optional pure react(context, event)
  state codec
```

feature追加時にkey、state、command、action、event、reasonをworldの型へ加える。
`WizRpgComponentIdentity`はfeatureがclosureで読む定義やtableをworld identityへ含め、
同じrevisionでも構成内容が異なるsaveの混入を防ぐ。
feature commandの結果は`WizRpgFeatureAction` classでfeature keyと不可分にする。
sceneや複数featureが同じpayload schemaを採用しても、schema走査に頼らず一意に配送できる。
payloadはpolicyより前に検証し、同じ正規形をpolicyとreducerへ渡す。両者の解釈を一致させるため、
feature action schemaによる入出力型のtransformは許可しない。

後続featureの`context.features`には定義元worldの先行feature stateだけが型付きで現れる。
これにより依存方向をcomposition順で固定し、他featureの直接変更は許可しない。

reactionはscene eventとfeature eventを観測できる。reducerと同じliteral reasonで拒否でき、
dispatch全体を入力stateへrollbackする。有限なstep上限を持ち、循環によって無限に進行しない。
途中で拒否した場合はstateとeventをまとめて破棄する。accepted resultの`eventRecords`は
source featureと`causedBy` event indexを保持し、reaction拒否と循環上限errorも最後の
feature keyと因果位置を返す。

## Policy and affordance

`WizRpgPolicy`は二つの純粋規則を同じ名前空間へ置く。

- `authorize(state, action)`: runtime実行可否
- `affordances(state)`: UIへ渡すvisible、enabled、reason、typed action

policyの閾値や規則表も`WizRpgComponentIdentity`へ入れ、認可挙動を変える構成差を
save identityへ含める。

UIとruntimeが同じ条件を参照できるため、見えているのに実行できないcommandや、
disabled表示なのに実行できるcommandを防ぐ。policyはstateを変更しない。

policyは構成時点の全action unionを認可する。feature追加後にpolicyを合成し、最初のpolicyを
追加した時点でaction unionを確定する。確定後のfeature追加は型とruntimeで拒否する。

## Custom scenes

追加sceneは次の二要素を必須にする。

```text
WizPluginSceneModule
  scene type
  action schema
  navigation schema and allowed sources
  scene factory
  pure reducer

WizStandardPluginSceneCodec
  same scene type
  data schema
  capture
  restore
```

`WizRpgScenes.define(registry, codecs)`はmoduleとcodecのscene type集合が完全一致することを
型とruntimeの両方で確認する。重複typeも拒否する。これにより「実行できるが保存できないscene」と
「保存形式だけ存在するscene」を構成できない。

## Mechanics

`WizRpgMechanics`は標準RPGの処理単位を差し替えるfactory集合である。

```text
battle executor
turn order policy
enemy AI
reward calculator
reward settlement
exploration reducer
defeat policy
equipment rules
hunger service
affinity system
inn service
party level-up
standard action reducer
```

factoryはcomposition時に一度だけ解決され、次のfreeze済みcontextを共有する。

```text
preset
content
canonical battle content
runtime environment
```

portはreadonlyな関数プロパティを持つ。入力を変更せず新しい結果を返す。
literal rejection reasonはworld dispatchのreason unionへ伝播する。
`withMechanics()`など保存後の挙動へ影響するruntime構成methodは
`WizRpgComponentIdentity`を必須とし、closureが読むplain dataをsave identityへ含める。

## Content

`WorldContent`は標準RPGの静的definitionを保持する。

- TypeScript literal inputはID型を保持する
- unknown inputはZod boundaryで正規化する
- category内ID、category間参照、cycleを検証する
- 独自fieldとcategoryは拡張schemaから型へ伝播する
- instanceとnested valueを防御所有し、deep freezeする

標準装備slotはweapon・armor definitionの`slotId`から得る。`WizRpgEquipmentRules`を
差し替えると、任意slot、複数slot占有、競合、職業制限、capacity制を純粋関数で決定できる。
snapshotは`Record<slotId, equipment | null>`として保存する。

宿泊プランは`innPlans` categoryから得る。標準runtimeは固定プランIDを持たず、
`WizEngineInnPlanCatalog`でIDを解決する。回復計算全体を変える場合は`inn service` portだけを
差し替え、content commandのliteral ID型は維持する。

静的definitionをsaveへ複製しない。runtimeはIDを保持し、現在contentからdefinitionを解決する。

## Action RPG boundary

open-wizは描画loop、物理、collision、animationを所有しない。高頻度のsimulationは利用側に置き、
アイテム取得、装備変更、Ability習得・発動、命中、報酬などのdomain eventをworldへ渡す。

`WizAbility`はturnやtarget選択方式に依存せず、利用側が型付けした`effect`を保持する。
`WizAbilityCatalog`、`WizAbilityBook`、`WizAbilityLoadout`は静的定義、習得状態、入力slotを分離する。
`WizAbilityReadiness`はframeごとの減算を行わず、回復時刻からcooldownとchargeを純粋に計算する。
cast、recovery、resource costは定義として公開し、実際の移動、hit判定、resource消費は利用側の
純粋なruleまたはfeature reducerが決定する。

`WizInventoryEntry`は所有instanceの`entryId`と静的定義の`contentId`を分離する。stackable itemは
quantityを増やし、固有装備はquantity 1と型付きcustom dataでdurability、affix、強化値を保持する。
`WizInventory`は容量、重複、数量不足を不変transactionとして検証する。`WizEquipmentLoadout`は
content IDではなくentry IDをslotへ割り当て、所有物が失われた時は明示的なreconcileで参照を外す。

## State and immutability

公開objectは不変classを基本とする。

- constructorはvalidationとdependency captureを行う
- 更新methodは新しいinstanceを返す
- constructor、prototype、instanceをfreezeする
- state classはimmutable value contractを宣言する
- 関数依存は構築時に捕捉し、利用側objectの後続変更を観測しない

計算規則はclass method内へ隠さず、pure functionまたはstructural portとして注入できるようにする。
classは構成、ownership、名前空間、利用者向けDXを担う。

## Dispatch transaction

```text
input state/action
  -> state authority validation
  -> deep immutable action ownership
  -> policies authorize
  -> exactly one scene/feature owner
  -> pure reduction and result-contract validation
  -> feature event reactions
  -> accepted immutable result
```

拒否時は入力stateを返し、途中eventを公開しない。environmentの乱数、時刻、ID readも
rollbackして次のdispatchで再生する。

汎用World module/reaction、Policy認可、Feature reducer/reaction、custom scene dispatchの戻り値は
class境界でshape、literal reason、event array、accepted/error整合性を検証し、
state・event・errorを防御所有する。

errorは安定したcodeとsemantic reasonを持つ。表示文はpresentation層で決める。

## Save

RPG rootのsaveは次のshapeを持つ。

```text
envelope
  schemaVersion
  contentVersion
  snapshot
    scene
    features
```

content versionは正規化済みcontentからcanonical fingerprintとして自動生成する。
順序を含めてcontentが変わればidentityも変わる。fingerprint入力には有限primitive、
plain object、dense arrayだけを許可し、class、accessor、symbol、cycleを拒否する。

scene codecと全feature codecはworld構築時に固定する。restoreはunknownだけを受け、
envelope、JSON safety、schema、content identity、scene参照、feature keyを検証する。
feature schemaのtransform済み出力をstate restoreへ直接渡し、同じ入力へtransformを重複適用しない。

snapshot reconciliationはcontent編集toolが明示的に行う処理であり、通常restoreへ暗黙に入れない。

## Source layers

```text
world/        provider-neutral module kernel
rpg/          public RPG composition root
definition/   standard content data contracts
content/      standard content and reference validation
save/         envelope and snapshot primitives
domain/       RPG values and semantic services
engine/       pure calculations and application ports
runtime/      scene states, reducers, plugin runtime
presets/      standard runtime assembly and presentation
lib/app/      this repository's product composition
```

依存方向は外側から内側へ向ける。`open-wiz`はRPG、Zod、appへ依存しない。
`open-wiz/rpg`はapp、UI、作品固有assetsをimportしない。

## Verification

変更後は次を通す。

```sh
bun test
bun run check
```

`bun run check`はformat、lint、typecheck、公開API規則、依存方向、production reachability、
package build、pack済みconsumerのinstall・typecheck・runtime実行を含む。
