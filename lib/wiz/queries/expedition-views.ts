import { statusResistanceView } from "@/lib/wiz/queries/status-resistance-view"
import { BranchChoices } from "@/lib/wiz/application/expedition/branch-choices"
import type { EventKind, StatusKind } from "@/lib/wiz/content/constants"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { Bag } from "@/lib/wiz/rules/bag"
import type { ExpeditionRules } from "@/lib/wiz/rules/expedition-rules"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import { DiscoveryRules } from "@/lib/wiz/rules/discovery-rules"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"
import { LayerScenes } from "@/lib/wiz/rules/layer-scenes"
import type { Expedition, GameState } from "@/lib/wiz/state/state-schema"
import type { GoodViews } from "@/lib/wiz/queries/good-views"
import { memberName } from "@/lib/wiz/queries/member-name"

/** 乗り場と道のり図の見え方。 */
export class ExpeditionViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly rules: ExpeditionRules,
    private readonly party: PartyRules,
    private readonly goods: GoodViews
  ) {}

  /** 行き先の層。到達していない層は名前を伏せる。 */
  destinations(state: GameState) {
    const appraisalPool = new Set(
      this.catalog.data.shops.flatMap((shop) =>
        this.catalog.appraisalPool(shop.id, state.reached)
      )
    )
    return this.catalog.data.layers.map((layer, index) => {
      const open = index <= state.reached
      const finds = (kind: "armor" | "weapon") =>
        open
          ? this.catalog.data.goods
              .flatMap((good) => {
                if (
                  good.kind !== kind ||
                  good.appraiseFrom !== layer.no ||
                  !appraisalPool.has(good.id) ||
                  this.catalog.data.shops.some((shop) =>
                    shop.goods.includes(good.id)
                  ) ||
                  this.catalog.data.smithy?.recipes.some(
                    (recipe) => recipe.good === good.id
                  )
                )
                  return []
                return [
                  this.goods.entry(good, {
                    own: state.gear.filter(
                      (gear) => !gear.unidentified && gear.good === good.id
                    ).length,
                    ownedGear: state.gear
                      .filter(
                        (gear) => !gear.unidentified && gear.good === good.id
                      )
                      .map((gear) => ({
                        ...this.goods.gearLabel(
                          good,
                          gear.plus,
                          gear.wear,
                          gear.weapon
                        ),
                        owner: gear.owner
                          ? memberName(this.catalog, state, gear.owner)
                          : null,
                      })),
                    equipMembers: state.party.flatMap((id) => {
                      if (
                        this.catalog.isSlotFixed(id, good.kind) ||
                        !this.catalog.canEquip(id, good.id)
                      )
                        return []
                      return [{ id, name: memberName(this.catalog, state, id) }]
                    }),
                  }),
                ]
              })
              .sort(
                (left, right) => Number(left.own > 0) - Number(right.own > 0)
              )
          : []
      return {
        id: layer.id,
        no: layer.no,
        name: open ? layer.name : "？？？",
        open,
        /** この層への到達で解禁する鑑定限定装備。未到達の品は伏せる。 */
        armorFinds: finds("armor"),
        weaponFinds: finds("weapon"),
        state: !open
          ? "未到達"
          : layer.id === state.lastLayer
            ? "前回ここまで"
            : state.lastLayer === null
              ? "ここから"
              : "到達済み",
      }
    })
  }

  /** 乗り場で最初に選んでおく層：前回の層、まだなら到達している一番深い層。 */
  defaultDestination(state: GameState) {
    return state.lastLayer ?? this.catalog.data.layers[state.reached].id
  }

  expedition(state: GameState): Expedition | null {
    if (state.phase.type === "battle" && state.phase.townQuest) return null
    return state.phase.type === "expedition" || state.phase.type === "battle"
      ? state.phase.expedition
      : null
  }

  /** いまの地点の背景（層の候補から、通った地点の並びで選ぶ）。候補がなければ null。 */
  scene(state: GameState) {
    const expedition = this.expedition(state)
    if (!expedition) return null
    const layer = this.catalog.layer(expedition.layer)
    if (!layer) return null
    const picked = LayerScenes.pick(layer, expedition)
    return picked ? { layer: layer.id, ...picked } : null
  }

  /** 道のり図：地点・通過した地点の出来事・分岐の選択肢・終点までの地点数。 */
  route(state: GameState) {
    const expedition = this.expedition(state)
    if (!expedition) return null
    const layer = this.catalog.layer(expedition.layer)!
    const here = layer.stations.find((entry) => entry.id === expedition.at)!
    const steps = this.#stepsToLandmark(layer.stations, "boss")
    const visited = new Set(expedition.visited)
    const events = new Map<string, EventKind>()
    // 実際の出来事を察知結果より優先し、再訪した地点は従来どおり最初の記録を示す。
    for (const records of [expedition.events, expedition.surveyed ?? []])
      for (const entry of records)
        if (!events.has(entry.station)) events.set(entry.station, entry.kind)
    const passed = layer.stations.some(
      (station) => station.event === "midboss" && visited.has(station.id)
    )
    const bonus = passed ? this.rules.retreatBonus(expedition.loot.gold) : 0
    const heldGoods = Bag.add([], expedition.loot.goods).map((stack) => ({
      ...stack,
      count: Math.min(stack.count, Bag.count(state.bag, stack.good)),
    }))
    return {
      layer: { id: layer.id, no: layer.no, name: layer.name },
      start: layer.start,
      at: expedition.at,
      stations: layer.stations.map((station) => ({
        id: station.id,
        x: station.x,
        y: station.y,
        next: station.next,
        boss: !!station.boss,
        /** 中ボスの地点（着く前から見せる）。 */
        midboss: station.event === "midboss",
        fixedFoes: (station.boss
          ? [layer.boss]
          : station.event === "midboss"
            ? (station.foes ?? [])
            : []
        ).map((id) => {
          const foe = this.catalog.foe(id)!
          return {
            name: foe.name,
            skills: (foe.skills ?? []).map(
              (skill) => this.catalog.skill(skill)!.name
            ),
            resistances: Object.entries(foe.resist ?? {})
              .filter(([, value]) => value > 0)
              .map(([kind, value]) =>
                statusResistanceView(kind as StatusKind, value)
              ),
          }
        }),
        event: events.get(station.id) ?? null,
        visited: visited.has(station.id),
      })),
      choices: here.next,
      surveyLeft: Math.max(
        0,
        ExplorationRules.surveyLimit - (expedition.surveyed?.length ?? 0)
      ),
      paths: new BranchChoices(this.catalog, this.party).execute(
        state,
        expedition,
        layer,
        here
      ),
      discovery:
        expedition.pending?.kind === "discovery" && here.discovery
          ? {
              ...here.discovery,
              choices: here.discovery.choices.map((choice) => {
                const rules = new DiscoveryRules(this.catalog, this.party)
                const offer = rules.offer(state, choice)
                return {
                  ...choice,
                  ...offer,
                  label: DiscoveryRules.priceText(
                    choice.label,
                    choice.cost,
                    offer.cost
                  ),
                  description: rules.description(state, choice, offer.cost),
                  originalCost: choice.cost ?? 0,
                  blessings: choice.blessings?.map((id) =>
                    this.catalog.skill(id)!
                  ),
                }
              }),
              recipients: state.party.map((id) => {
                const member = state.members.find((entry) => entry.id === id)!
                const definition = this.catalog.member(id)!
                return {
                  id,
                  name: definition.hero ? state.hero.name : definition.name,
                  hp: member.hp,
                  maxHp: this.party.stats(member, state).maxHp,
                  blessing: member.blessing
                    ? this.catalog.skill(member.blessing)?.name
                    : null,
                }
              }),
            }
          : null,
      atEnd: !!here.boss,
      stepsLeft: steps.get(expedition.at) ?? Number.POSITIVE_INFINITY,
      midbossSteps: passed
        ? null
        : (this.#stepsToLandmark(layer.stations, "midboss").get(
            expedition.at
          ) ?? null),
      pending: expedition.pending,
      cleared: expedition.cleared,
      loot: expedition.loot,
      /** 抱えている戦利品。未装備の拾い物は全滅で失う。 */
      carrying: {
        gold: Math.min(state.gold, expedition.loot.gold),
        junk: Bag.count(heldGoods, this.catalog.data.junk),
        rareJunk: this.catalog.data.rareJunk
          ? Bag.count(heldGoods, this.catalog.data.rareJunk)
          : 0,
        otherGoods: heldGoods.reduce(
          (count, stack) =>
            stack.good === this.catalog.data.junk ||
            stack.good === this.catalog.data.rareJunk
              ? count
              : count + stack.count,
          0
        ),
        unequippedGear: state.gear.filter(
          (gear) =>
            !gear.owner && (expedition.loot.weapons ?? []).includes(gear.id)
        ).length,
      },
      /** 中ボスを倒したか（倒してから戻ると金貨に手当てが付く）。 */
      passedMidboss: passed,
      /** いま戻ったときに付く金貨の手当て。中ボスを倒していなければ0。 */
      bonus,
      /** いま帰還して持ち帰る金貨（戦利品と手当ての合計）。 */
      returnGold: expedition.loot.gold + bonus,
      /** 帰還後の所持金。探索中の支払いを含めた現在の所持金に手当てを足す。 */
      returnBalance: state.gold + bonus,
      wipeKeepJunkPercent:
        (this.catalog.data.balance.wipe?.keepJunk ?? 0) * 100,
    }
  }

  /**
   * 地点ごとの、指定した節目（ボス・中ボス）までの最短の地点数。
   * 節目から線を逆にたどって数えるので、分岐や戻る線があっても最短になる。
   * 終点へ着けない地点は表に入らない。
   */
  #stepsToLandmark(
    stations: readonly {
      readonly id: string
      readonly next: readonly string[]
      readonly boss?: boolean
      readonly event?: string
    }[],
    landmark: "boss" | "midboss"
  ) {
    const before = new Map<string, string[]>()
    for (const station of stations)
      for (const next of station.next)
        before.set(next, [...(before.get(next) ?? []), station.id])
    const steps = new Map<string, number>()
    let frontier: string[] = []
    for (const station of stations)
      if (
        (landmark === "boss" ? station.boss : station.event === "midboss") &&
        !steps.has(station.id)
      ) {
        steps.set(station.id, 0)
        frontier.push(station.id)
      }
    for (let distance = 1; frontier.length; distance += 1) {
      const next: string[] = []
      for (const id of frontier)
        for (const previous of before.get(id) ?? [])
          if (!steps.has(previous)) {
            steps.set(previous, distance)
            next.push(previous)
          }
      frontier = next
    }
    return steps
  }
}
