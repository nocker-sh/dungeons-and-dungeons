import type { GameContent } from "@/lib/wiz/content/content-schema"
import { idOfSlug } from "@/lib/wiz/testing/id-of-slug"
import { realContent } from "@/lib/wiz/testing/real-content"

type Layer = GameContent["layers"][number]
type Station = Layer["stations"][number]
type Good = GameContent["goods"][number]
type Foe = GameContent["foes"][number]
type MemberDefinition = GameContent["party"][number]
type Demon = GameContent["demons"][number]

/** 指定ミスで変更なしのテストデータを作らない。重複IDを含む検証用データはそのまま扱う。 */
function updateMatching<T>(
  entries: readonly T[],
  matches: (entry: T) => boolean,
  update: (entry: T) => T,
  target: string
): T[] {
  let found = false
  const changed = entries.map((entry) => {
    if (!matches(entry)) return entry
    found = true
    return update(entry)
  })
  if (!found) throw new Error(`データの変更対象が見つかりません: ${target}`)
  return changed
}

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
      goods: updateMatching(
        this.content.goods,
        (good) => good.id === id,
        (good) => ({ ...good, ...patch }),
        `品物 ${key}`
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
    if (!this.content.goods.some((good) => good.id === id))
      throw new Error(`データの変更対象が見つかりません: 品物 ${key}`)
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
      foes: updateMatching(
        this.content.foes,
        (foe) => foe.id === id,
        (foe) => ({ ...foe, ...patch }),
        `敵 ${key}`
      ),
    })
  }

  /** 敵をまとめて書き換える。 */
  mapFoes(map: (foe: Foe) => Foe) {
    return this.#with({ foes: this.content.foes.map(map) })
  }

  /** party に直接定義された仲間。募集由来の仲間は withRecruitMember で変える。 */
  withPartyMember(key: string, patch: Partial<MemberDefinition>) {
    const id = idOfSlug("member", key)
    return this.#with({
      party: updateMatching(
        this.content.party,
        (member) => member.id === id,
        (member) => ({ ...member, ...patch }),
        `作品データのparty ${key}`
      ) as GameContent["party"],
    })
  }

  /** 悪魔を一つ書き換える（流派・合体の効果）。 */
  withDemon(key: string, patch: Partial<Demon>) {
    const id = idOfSlug("demon", key)
    return this.#with({
      demons: updateMatching(
        this.content.demons,
        (demon) => demon.id === id,
        (demon) => ({ ...demon, ...patch }),
        `悪魔 ${key}`
      ),
    })
  }

  /** ワザを一つ書き換える。 */
  withSkill(key: string, patch: Partial<GameContent["skills"][number]>) {
    const id = idOfSlug("skill", key)
    return this.#with({
      skills: updateMatching(
        this.content.skills,
        (skill) => skill.id === id,
        (skill) => ({ ...skill, ...patch }),
        `ワザ ${key}`
      ),
    })
  }

  /** 募集の冒険者を一人書き換える。 */
  withRecruitMember(key: string, patch: Partial<MemberDefinition>) {
    const id = idOfSlug("member", key)
    return this.#with({
      recruits: updateMatching(
        this.content.recruits,
        (recruit) => recruit.member.id === id,
        (recruit) => ({ ...recruit, member: { ...recruit.member, ...patch } }),
        `募集の冒険者 ${key}`
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
      recruits: updateMatching(
        this.content.recruits,
        (recruit) => recruit.id === id,
        (recruit) => ({ ...recruit, ...patch }),
        `募集 ${key}`
      ),
    })
  }

  /** 店の品揃えを書き換える。 */
  withShop(key: string, patch: Partial<GameContent["shops"][number]>) {
    const id = idOfSlug("shop", key)
    return this.#with({
      shops: updateMatching(
        this.content.shops,
        (shop) => shop.id === id,
        (shop) => ({
          ...shop,
          ...patch,
          ...(patch.goods
            ? { goods: patch.goods.map((key) => idOfSlug("good", key)) }
            : {}),
          ...(patch.appraise
            ? { appraise: patch.appraise.map((key) => idOfSlug("good", key)) }
            : {}),
        }),
        `店 ${key}`
      ),
    })
  }

  /** 層の地点を一つ書き換える。 */
  withStation(layerKey: string, stationId: string, patch: Partial<Station>) {
    const layerId = idOfSlug("layer", layerKey)
    return this.#with({
      layers: updateMatching(
        this.content.layers,
        (layer) => layer.id === layerId,
        (layer) => ({
          ...layer,
          stations: updateMatching(
            layer.stations,
            (station) => station.id === stationId,
            (station) => ({ ...station, ...patch }),
            `地点 ${layerKey}/${stationId}`
          ),
        }),
        `層 ${layerKey}`
      ),
    })
  }

  /** 層を一つ書き換える。 */
  withLayer(layerKey: string, patch: Partial<Layer>) {
    const layerId = idOfSlug("layer", layerKey)
    return this.#with({
      layers: updateMatching(
        this.content.layers,
        (layer) => layer.id === layerId,
        (layer) => ({ ...layer, ...patch }),
        `層 ${layerKey}`
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
