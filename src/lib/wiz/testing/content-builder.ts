import type { GameContent } from "@/lib/wiz/content"
import { idOfSlug, realContent } from "@/lib/wiz/testing/real-content"

type Layer = GameContent["layers"][number]
type Station = Layer["stations"][number]
type Good = GameContent["goods"][number]
type Foe = GameContent["foes"][number]
type MemberDefinition = GameContent["party"][number]
type Demon = GameContent["demons"][number]

/**
 * 本物の作品データ（`realContent()`）から、必要な差だけを変えたデータを作る組み立て器。
 * 既定は本物そのままなので、テストは実際に遊ぶ数値の上で規則を確かめる。
 * 式そのものを測るテストだけが、理由を書いて上書きを足す。
 * 指す相手は人が読める名前（slug）でも id でもよい。
 */
export class GameContentBuilder {
  constructor(private readonly content: GameContent) {}

  static of(content: GameContent = realContent()): GameContentBuilder {
    return new GameContentBuilder(content)
  }

  #with(patch: Partial<GameContent>): GameContentBuilder {
    return new GameContentBuilder({ ...this.content, ...patch })
  }

  withStartingGold(startingGold: number) {
    return this.#with({ startingGold })
  }

  withStartingStones(startingStones: number) {
    return this.#with({ startingStones })
  }

  withStartingBag(startingBag: readonly { good: string; count: number }[]) {
    return this.#with({
      startingBag: startingBag.map((entry) => ({
        ...entry,
        good: idOfSlug("good", entry.good),
      })),
    })
  }

  withReached(reached: number) {
    return this.#with({ reached })
  }

  /** 規則の数値を上書きする（一段目だけ差し替える）。 */
  withBalance(patch: Partial<GameContent["balance"]>) {
    return this.#with({ balance: { ...this.content.balance, ...patch } })
  }

  withRecruiting(patch: Partial<GameContent["recruiting"]>) {
    return this.#with({
      recruiting: {
        ...this.content.recruiting,
        ...patch,
        ...(patch.initial
          ? { initial: patch.initial.map((key) => idOfSlug("recruit", key)) }
          : {}),
      },
    })
  }

  withSummon(patch: Partial<GameContent["summon"]>) {
    return this.#with({ summon: { ...this.content.summon, ...patch } })
  }

  /** 品物を一つ書き換える。 */
  withGood(key: string, patch: Partial<Good>) {
    const id = idOfSlug("good", key)
    return this.#with({
      goods: this.content.goods.map((good) =>
        good.id === id ? { ...good, ...patch } : good
      ),
    })
  }

  /** 品物をまとめて書き換える。 */
  mapGoods(map: (good: Good) => Good) {
    return this.#with({ goods: this.content.goods.map(map) })
  }

  /** 武器の攻撃力と必要な能力をそろえる（一撃で決めるテスト用）。 */
  withWeaponPower(power: number, need = { str: 0, tec: 0 }) {
    return this.mapGoods((good) =>
      good.kind === "weapon" ? { ...good, power, need } : good
    )
  }

  /** 品物を消す。店・募集・鍛冶屋からも外す。 */
  withoutGood(key: string) {
    const id = idOfSlug("good", key)
    const smithy = this.content.smithy
    return this.#with({
      goods: this.content.goods.filter((good) => good.id !== id),
      ...(smithy
        ? {
            smithy: {
              ...smithy,
              upgrades: smithy.upgrades.filter((upgrade) =>
                upgrade.materials.every((entry) => entry.good !== id)
              ),
              recipes: smithy.recipes.filter(
                (recipe) =>
                  recipe.good !== id &&
                  recipe.materials.every((entry) => entry.good !== id)
              ),
            },
          }
        : {}),
      shops: this.content.shops.map((shop) => ({
        ...shop,
        goods: shop.goods.filter((entry) => entry !== id),
        appraise: shop.appraise?.filter((entry) => entry !== id),
      })),
      recruits: this.content.recruits.map((recruit) => ({
        ...recruit,
        // ユニークの仲間は固有の武器が要るので、そのままにする
        member: recruit.member.unique
          ? recruit.member
          : recruit.member.weapon === id
            ? { ...recruit.member, weapon: undefined }
            : recruit.member,
      })),
    })
  }

  withFoe(key: string, patch: Partial<Foe>) {
    const id = idOfSlug("foe", key)
    return this.#with({
      foes: this.content.foes.map((foe) =>
        foe.id === id ? { ...foe, ...patch } : foe
      ),
    })
  }

  /** 敵をまとめて書き換える。 */
  mapFoes(map: (foe: Foe) => Foe) {
    return this.#with({ foes: this.content.foes.map(map) })
  }

  /** 最初からいる仲間（主人公）を書き換える。 */
  withPartyMember(key: string, patch: Partial<MemberDefinition>) {
    const id = idOfSlug("member", key)
    return this.#with({
      party: this.content.party.map((member) =>
        member.id === id ? { ...member, ...patch } : member
      ) as GameContent["party"],
    })
  }

  /** 悪魔を一つ書き換える（流派・合体の効果）。 */
  withDemon(key: string, patch: Partial<Demon>) {
    const id = idOfSlug("demon", key)
    return this.#with({
      demons: this.content.demons.map((demon) =>
        demon.id === id ? { ...demon, ...patch } : demon
      ),
    })
  }

  /** ワザを一つ書き換える。 */
  withSkill(key: string, patch: Partial<GameContent["skills"][number]>) {
    const id = idOfSlug("skill", key)
    return this.#with({
      skills: this.content.skills.map((skill) =>
        skill.id === id ? { ...skill, ...patch } : skill
      ),
    })
  }

  /** 募集の冒険者を一人書き換える。 */
  withRecruitMember(key: string, patch: Partial<MemberDefinition>) {
    const id = idOfSlug("member", key)
    return this.#with({
      recruits: this.content.recruits.map((recruit) =>
        recruit.member.id === id
          ? { ...recruit, member: { ...recruit.member, ...patch } }
          : recruit
      ),
    })
  }

  /** 募集を一つ書き換える（値段・珍しさ）。 */
  withRecruit(
    key: string,
    patch: Partial<Omit<GameContent["recruits"][number], "member">>
  ) {
    const id = idOfSlug("recruit", key)
    return this.#with({
      recruits: this.content.recruits.map((recruit) =>
        recruit.id === id ? { ...recruit, ...patch } : recruit
      ),
    })
  }

  /** 店の品揃えを書き換える。 */
  withShop(key: string, patch: Partial<GameContent["shops"][number]>) {
    const id = idOfSlug("shop", key)
    return this.#with({
      shops: this.content.shops.map((shop) =>
        shop.id === id
          ? {
              ...shop,
              ...patch,
              ...(patch.goods
                ? { goods: patch.goods.map((key) => idOfSlug("good", key)) }
                : {}),
              ...(patch.appraise
                ? {
                    appraise: patch.appraise.map((key) =>
                      idOfSlug("good", key)
                    ),
                  }
                : {}),
            }
          : shop
      ),
    })
  }

  /** 層の地点を一つ書き換える。 */
  withStation(layerKey: string, stationId: string, patch: Partial<Station>) {
    const layerId = idOfSlug("layer", layerKey)
    return this.#with({
      layers: this.content.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              stations: layer.stations.map((station) =>
                station.id === stationId ? { ...station, ...patch } : station
              ),
            }
          : layer
      ),
    })
  }

  /** 層を一つ書き換える。 */
  withLayer(layerKey: string, patch: Partial<Layer>) {
    const layerId = idOfSlug("layer", layerKey)
    return this.#with({
      layers: this.content.layers.map((layer) =>
        layer.id === layerId ? { ...layer, ...patch } : layer
      ),
    })
  }

  /** 層の敵をまとめて差し替える（slug でも指せる）。 */
  withLayerFoes(layerKey: string, foes: readonly string[]) {
    return this.withLayer(layerKey, {
      foes: foes.map((key) => idOfSlug("foe", key)),
    })
  }

  /** 鍛冶屋の強化・生産を書き換える。 */
  withSmithy(patch: Partial<NonNullable<GameContent["smithy"]>>) {
    const smithy = this.content.smithy ?? { upgrades: [], recipes: [] }
    return this.#with({ smithy: { ...smithy, ...patch } })
  }

  build(): GameContent {
    return this.content
  }
}

/** `GameContentBuilder.of` の近道。 */
export function aContent(content: GameContent = realContent()) {
  return GameContentBuilder.of(content)
}
