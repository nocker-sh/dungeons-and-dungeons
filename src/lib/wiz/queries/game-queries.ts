import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { WorldMapRules } from "@/lib/wiz/rules/world-map"
import type {
  ConversationSubject,
  ConversationTrigger,
} from "@/lib/wiz/conversations/schema"
import type { GameCatalog } from "@/lib/wiz/content"
import type { ExpeditionRules, PartyRules, WeaponRules } from "@/lib/wiz/rules"
import type { GameState, Member } from "@/lib/wiz/state"
import { GoodViews } from "@/lib/wiz/queries/good-views"
import { MemberViews } from "@/lib/wiz/queries/member-views"
import { BattleViews } from "@/lib/wiz/queries/battle-views"
import { ExpeditionViews } from "@/lib/wiz/queries/expedition-views"
import { ArmorComparisons } from "@/lib/wiz/queries/armor-comparisons"
import { InventoryViews } from "@/lib/wiz/queries/inventory-views"
import { ShopViews } from "@/lib/wiz/queries/shop-views"
import { SmithyViews } from "@/lib/wiz/queries/smithy-views"
import { GuildViews } from "@/lib/wiz/queries/guild-views"
import { HeroViews } from "@/lib/wiz/queries/hero-views"
import { DiagnosticViews } from "@/lib/wiz/queries/diagnostic-views"

/**
 * 画面が表示と操作の可否に使う値。ゲーム規則を画面側で計算させない。
 * 中身は場面ごとの Query に分け、ここは受け口をまとめるだけ。
 */
export class GameQueries {
  worldMap(state: GameState) {
    return new WorldMapRules(this.catalog).view(state)
  }
  readonly #goods: GoodViews
  readonly #members: MemberViews
  readonly #battle: BattleViews
  readonly #expedition: ExpeditionViews
  readonly #inventory: InventoryViews
  readonly #armor: ArmorComparisons
  readonly #shop: ShopViews
  readonly #smithy: SmithyViews
  readonly #guild: GuildViews
  readonly #hero: HeroViews
  readonly #diagnostic: DiagnosticViews

  constructor(
    private readonly catalog: GameCatalog,
    rules: PartyRules,
    weapons: WeaponRules,
    expedition: ExpeditionRules
  ) {
    this.#goods = new GoodViews(catalog, rules, weapons)
    this.#members = new MemberViews(catalog, rules, weapons, this.#goods)
    this.#battle = new BattleViews(catalog, rules, weapons, this.#members)
    this.#expedition = new ExpeditionViews(
      catalog,
      expedition,
      rules,
      this.#goods
    )
    this.#inventory = new InventoryViews(catalog, rules, this.#goods)
    this.#armor = new ArmorComparisons(catalog, rules, this.#inventory)
    this.#smithy = new SmithyViews(
      catalog,
      weapons,
      this.#goods,
      this.#inventory,
      this.#members
    )
    this.#shop = new ShopViews(catalog, this.#goods)
    this.#guild = new GuildViews(catalog, rules, this.#members)
    this.#hero = new HeroViews(catalog)
    this.#diagnostic = new DiagnosticViews(catalog)
  }

  conversations(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    return new ConversationRules(this.catalog).inspect(state, trigger, subject)
  }
  canStartConversation(
    state: GameState,
    trigger: ConversationTrigger,
    subject: ConversationSubject = {}
  ) {
    const rules = new ConversationRules(this.catalog)
    return (
      rules.canStart(state, trigger, subject) &&
      rules.available(state, trigger, subject).length > 0
    )
  }
  /** 場所に入ったときに必ず流れる、未読の場面が残っている（流れ終わるまで場所の操作を出さない）。 */
  visitSceneAwaiting(state: GameState, place: string) {
    return new ConversationRules(this.catalog).awaiting(state, "visit", {
      place,
    })
  }
  /** 住人にまだ聞いていない話がある。 */
  residentHasNews(state: GameState, resident: string) {
    return new ConversationRules(this.catalog)
      .available(state, "talk", { resident })
      .some((entry) => !state.conversation?.seen.includes(entry.id))
  }
  activeConversation(state: GameState) {
    return (
      this.catalog.data.conversations?.find(
        (entry) => entry.id === state.conversation?.active
      ) ?? null
    )
  }

  supplies(state: GameState) {
    return this.#inventory.supplies(state)
  }

  member(state: GameState, id: string) {
    return this.#members.member(state, id)
  }
  /** 主人公の名前・外見と、選べる外見の候補。 */
  hero(state: GameState) {
    return this.#hero.hero(state)
  }
  /** 入れた名前を受け付けられるか。 */
  heroNameAccepted(raw: string) {
    return this.#hero.nameAccepted(raw)
  }
  onboarding(state: GameState) {
    return this.#hero.onboarding(state)
  }
  /** はじめから遊ぶときの、最初の仕事から初出撃までの段階。 */
  prologue(state: GameState) {
    return this.#hero.prologue(state)
  }
  /** その仲間の絵を引く id。主人公は選んだ外見。 */
  look(state: GameState, id: string) {
    return this.#members.look(state, id)
  }
  /** 出撃中の3人。隊列の並び順。 */
  party(state: GameState) {
    return this.#members.party(state)
  }
  /** 控えの仲間。 */
  reserve(state: GameState) {
    return this.#members.reserve(state)
  }
  armor(state: GameState, member: Pick<Member, "id">) {
    return this.#members.armor(state, member)
  }
  weapon(state: GameState, member: Member) {
    return this.#members.weapon(state, member)
  }
  weaponFit(
    state: GameState,
    memberId: string,
    goodId: string,
    plus = 0,
    extraPower = 0
  ) {
    return this.#members.weaponFit(state, memberId, goodId, plus, extraPower)
  }
  /** 出撃できるか。できないときは理由。 */
  readiness(state: GameState) {
    return this.#members.readiness(state)
  }

  demon(state: GameState) {
    return this.#guild.demon(state)
  }
  demonContracts(state: GameState) {
    return this.#guild.demonContracts(state)
  }
  demons(state: GameState) {
    return this.#guild.demons(state)
  }
  demonDef(id: string) {
    return this.#guild.demonDef(id)
  }

  /** 行き先の層。到達していない層は名前を伏せる。 */
  destinations(state: GameState) {
    return this.#expedition.destinations(state)
  }
  defaultDestination(state: GameState) {
    return this.#expedition.defaultDestination(state)
  }
  expedition(state: GameState) {
    return this.#expedition.expedition(state)
  }
  /** 探索中のいまの地点の背景。種類（道中・宝箱・休憩）と、層の候補の識別子。 */
  scene(state: GameState) {
    return this.#expedition.scene(state)
  }
  /** 道のり図：地点・通過した地点の出来事・分岐の選択肢・終点までの地点数。 */
  route(state: GameState) {
    return this.#expedition.route(state)
  }

  battle(state: GameState) {
    return this.#battle.battle(state)
  }
  /** 手番の仲間が選べる指示。 */
  commands(state: GameState, memberId: string) {
    return this.#battle.commands(state, memberId)
  }

  good(id: string) {
    return this.catalog.good(id)
  }
  foe(id: string) {
    return this.catalog.foe(id)
  }
  skill(id: string) {
    return this.catalog.skill(id)
  }

  /** 武器と防具の個体。持ち主の名前つき。 */
  /** ids を渡すと、その個体だけ。 */
  gear(state: GameState, ids?: ReadonlySet<string>) {
    return this.#inventory.gear(state, ids)
  }
  /** 袋の道具。field は戦闘の外で使えるか。 */
  items(state: GameState) {
    return this.#inventory.items(state)
  }
  /** 袋の素材。 */
  carried(state: GameState) {
    return this.#inventory.carried(
      state,
      this.#expedition.expedition(state)?.loot
    )
  }
  materials(state: GameState) {
    return this.#inventory.materials(state)
  }
  /** 仲間が着けられる装備。 */
  equipOptions(state: GameState, memberId: string) {
    return this.#inventory.equipOptions(state, memberId)
  }
  /** 防具を着替えたときの能力・耐久の比較。候補外なら null。 */
  armorComparison(state: GameState, memberId: string, gearId: string) {
    return this.#armor.armorComparison(state, memberId, gearId)
  }
  /** 未所持の防具を未強化・消耗なしで着た目安。状態は変更しない。 */
  armorGoalComparison(state: GameState, memberId: string, goodId: string) {
    return this.#armor.armorGoalComparison(state, memberId, goodId)
  }
  /** 防具を外したときの能力・耐久の比較。外せない場合は null。 */
  armorRemovalComparison(state: GameState, gearId: string) {
    return this.#armor.armorRemovalComparison(state, gearId)
  }
  /** 装備をすべて変えられないときの理由（固定装備の仲間）。変えられれば null。 */
  gearLock(memberId: string) {
    return this.#inventory.gearLock(memberId)
  }
  /** 武器を付け替えられないときの理由（専用の武器を持つ R の仲間）。防具は着替えられる。 */
  weaponLock(memberId: string) {
    return this.#inventory.weaponLock(memberId)
  }
  /** この武器を持つと攻撃力が上がる出撃メンバー（上がり幅の大きい順）。 */
  upgrades(state: GameState, gearId: string) {
    return this.#inventory.upgrades(state, gearId)
  }
  /** 店の武器を買って持つと攻撃力が上がる出撃メンバー（上がり幅の大きい順）。 */
  upgradesForGood(state: GameState, goodId: string) {
    return this.#inventory.upgradesForGood(state, goodId)
  }
  /** 誰も着けていない武器を、出撃メンバーへ一番強くなるように割り振る案。 */
  bestWeapons(state: GameState) {
    return this.#inventory.bestWeapons(state)
  }
  /** 売れる物：袋の品物と、誰も装備していない武器・防具。 */
  sellables(state: GameState) {
    return this.#inventory.sellables(state)
  }
  junk(state: GameState) {
    return this.#inventory.junk(state)
  }
  /** 光るガラクタ（作品に無ければ null）。 */
  rareJunk(state: GameState) {
    return this.#inventory.rareJunk(state)
  }

  shop(state: GameState, shopId: string) {
    return this.#shop.shop(state, shopId)
  }
  /** 鑑定で出た品が、到達した層より一つ先の段（掘り出し物）か。 */
  bargain(state: GameState, goodId: string) {
    return this.#shop.bargain(state, goodId)
  }
  rooms(state: GameState) {
    return this.#shop.rooms(state)
  }

  /** 募集の枠。 */
  recruits(state: GameState) {
    return this.#guild.recruits(state)
  }
  /** 募集の引き直し。 */
  reroll(state: GameState) {
    return this.#guild.reroll(state)
  }
  /** 召喚：召喚石の数と、失敗で得る物。 */
  summon(state: GameState) {
    return this.#guild.summon(state)
  }

  /** 鍛冶屋：ユニークの固有の武器を鍛え直す。 */
  reforges(state: GameState) {
    return this.#smithy.reforges(state)
  }
  /** 鍛冶屋：強化できる装備と、作れる物。 */
  smithy(state: GameState) {
    return this.#smithy.smithy(state)
  }
  /** 鍛冶屋の修理：仲間ごとの防具の耐久と費用、まとめて直す費用。 */
  repairs(state: GameState) {
    return this.#smithy.repairs(state)
  }

  quests(state: GameState) {
    return this.#guild.quests(state)
  }
  /** 街の施設に付ける印。 */
  marks(state: GameState) {
    return this.#guild.marks(state)
  }
  /** 街で出す結果の板（全滅・踏破）。 */
  result(state: GameState) {
    return this.#guild.result(state)
  }
  /** 今夜まだ雑談していない仲間がいるか。 */
  canChat(state: GameState) {
    return this.#guild.canChat(state)
  }

  /** その仲間と今夜まだ雑談していないか。 */
  canChatWith(state: GameState, member: string) {
    return this.#guild.canChatWith(state, member)
  }

  /** 状態と今のコンテンツの食い違い（診断用）。 */
  problems(state: GameState) {
    return this.#diagnostic.problems(state)
  }
}
