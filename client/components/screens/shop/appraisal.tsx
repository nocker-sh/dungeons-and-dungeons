import { useState } from "react"
import { useFormation } from "@/client/components/game/formation/context"
import { ListView } from "@/client/components/game/list-view/list-view"
import { useListBurst } from "@/client/components/game/list-view/use-list-burst"
import type { At } from "@/client/components/game/list-view/types"
import { NO_ATTACK_UPGRADE_MESSAGE } from "@/client/components/game/gear-text"
import { armorComparisonText } from "@/client/components/game/armor-comparison-text"
import { gearDesc, RANDOM_SKILL_MARK } from "@/client/components/game/gear-desc"
import { AppraisalReveal } from "@/client/components/game/appraisal-reveal"
import type { AppraisalFind } from "@/client/components/game/appraisal-card-shared"
import type { ShopId } from "@/client/game/navigation"
import { COLOR } from "@/client/components/stage/kit"
import { useFx } from "@/client/components/stage/use-fx"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import { findScore } from "@/client/components/screens/shop/find-score"
import { findKey } from "@/client/components/screens/shop/find-key"
import { gearKey } from "@/client/components/screens/shop/gear-key"
import { goodKey } from "@/client/components/screens/shop/good-key"

/** SR の掘り出し物の色。 */
export const RARE_GOLD = "#b8901c"

/** 一覧の「おまかせで持たせる」の行の key。 */
export const AUTO_EQUIP = "auto-equip"

/** 一覧の「まとめて鑑定」の行の key。 */
export const APPRAISE_ALL = "appraise-all"

export type Props = {
  shop: ShopId
  onClose: () => void
}

export function Appraisal(props: Props) {
  const game = useGame()
  const state = useGameState()
  const fx = useFx()
  const burst = useListBurst()
  const formation = useFormation()
  const [found, setFound] = useState<{
    find: AppraisalFind
    summary?: string
  } | null>(null)
  // この店で鑑定した品（新しい順）。「見つけた物」から持たせる
  const [finds, setFinds] = useState<readonly AppraisalFind[]>([])
  // 鑑定に成功した回数。増えるたびに一覧を「見つけた物」で開き直す
  const [appraisalCount, setAppraisalCount] = useState(0)
  const info = game.queries.shop(state, props.shop)
  if (!info) return null
  const junk = game.queries.junk(state)
  // 光るガラクタは武器を鑑定できる店でだけ出す
  const rareJunk = info?.appraiseRare ? game.queries.rareJunk(state) : null
  const unidentifiedWeapons = info?.appraiseRare
    ? game.queries.gear(state).filter((entry) => entry.unidentified)
    : []
  const junkTotal = junk.count + (rareJunk?.count ?? 0)
  const armorTargets = (gearId: string) =>
    game.state.party.filter((member) =>
      game.queries
        .equipOptions(game.state, member)
        .some((entry) => entry.gear === gearId)
    )
  /** 鑑定の出来事から、見つけた品の札を作る（良い順）。 */
  const findsOf = (events: readonly GameEvent[]): AppraisalFind[] => {
    const now = game.state
    const gear = game.queries.gear(now)
    return events
      .flatMap((event) => {
        if (event.type !== "appraised") return []
        const entry = event.gear
          ? gear.find((item) => item.gear === event.gear)
          : undefined
        const good = game.queries.good(event.good)
        const upgrade = event.gear
          ? (game.queries.upgrades(now, event.gear)[0] ?? null)
          : null
        return [
          {
            key: event.gear ?? `${event.good}-${Math.random()}`,
            gear: event.gear,
            good: event.good,
            name: entry?.name ?? good?.name ?? "",
            rarity: event.rarity,
            stat: entry?.stat ?? good?.stat ?? "",
            desc: entry ? gearDesc(entry) : (good?.desc ?? ""),
            skills: entry?.weapon?.skills ?? [],
            bargain: game.queries.bargain(now, event.good),
            weapon: !!entry?.weapon,
            upgrade,
          },
        ]
      })
      .sort((left, right) => findScore(right) - findScore(left))
  }
  /** 鑑定の光。SR と掘り出し物は金色で強く光らせる。 */
  const reveal = (find: AppraisalFind) => {
    const special = find.rarity === "SR" || find.bargain
    const { width, height } = fx.size()
    fx.flash(special ? RARE_GOLD : COLOR.mist, special ? 0.9 : 0.6)
    fx.shake(special ? 2 : 1.4)
    fx.hitStop(1.4)
    fx.burst(
      width / 2,
      height * 0.45,
      height * (special ? 0.62 : 0.5),
      find.rarity ?? "",
      {
        fill: special ? RARE_GOLD : COLOR.blood,
        ink: COLOR.paper,
        hold: 900,
      }
    )
    fx.shards(width / 2, height * 0.45, {
      n: special ? 44 : 30,
      power: special ? 3 : 2,
      ...(special ? { colors: [RARE_GOLD, COLOR.paper, COLOR.ink] } : {}),
    })
  }
  /** おまかせの割り振り（誰も着けていない武器を、一番強くなるように）。 */
  const plan = game.queries.bestWeapons(state)
  const autoEquipRows = () =>
    plan.length
      ? [
          {
            key: AUTO_EQUIP,
            icon: plan[0].gear
              ? (game.queries
                  .gear(state)
                  .find((entry) => entry.gear === plan[0].gear)?.id ?? junk.id)
              : junk.id,
            name: "おまかせで持たせる",
            stat: `${plan.length}人が強くなる`,
            desc: plan
              .map((entry) => `${entry.name} ${entry.before} → ${entry.after}`)
              .join("　"),
            badge: `${plan.length}人`,
          },
        ]
      : []
  const autoEquipLabel = () => (plan.length ? "全員に持たせる" : null)
  const autoEquip = (at: At) => {
    let done = 0
    for (const entry of game.queries.bestWeapons(game.state)) {
      const sent = eventsOf(
        inPhase(game, "town")?.equip(entry.gear, entry.member)
      )
      if (Array.isArray(sent)) done++
    }
    if (done) burst(at, "")
    else fx.shake(0.6)
  }
  /** 持っているガラクタを全部鑑定し、いちばん良い品と内訳を出す。 */
  const appraiseAll = () => {
    const events: GameEvent[] = []
    // 光るガラクタ（武器の店だけ）を先に、次にふつうのガラクタを全部
    for (const [count, rare] of [
      [rareJunk?.count ?? 0, true],
      [junk.count, false],
    ] as const)
      for (let left = count; left > 0; left--) {
        const sent = eventsOf(inPhase(game, "town")?.appraise(props.shop, rare))
        if (!Array.isArray(sent)) break
        events.push(...sent)
      }
    const fresh = findsOf(events)
    if (!fresh.length) return fx.shake(0.6)
    const tally = (rarity: string) =>
      fresh.filter((find) => find.rarity === rarity).length
    const parts = [
      `${fresh.length}個を鑑定`,
      ...(["SR", "R"] as const)
        .filter((rarity) => tally(rarity))
        .map((rarity) => `${rarity} ${tally(rarity)}`),
      ...(fresh.some((find) => find.bargain)
        ? [`掘り出し物 ${fresh.filter((find) => find.bargain).length}`]
        : []),
      ...(fresh.some((find) => find.upgrade)
        ? [`強くなる品 ${fresh.filter((find) => find.upgrade).length}`]
        : []),
    ]
    setFound({ find: fresh[0], summary: parts.join("・") })
    setFinds((list) => [...fresh, ...list])
    setAppraisalCount((count) => count + 1)
    reveal(fresh[0])
  }
  return (
    <>
      {info ? (
        <ListView
          key={`appraise-${appraisalCount}`}
          tab={appraisalCount > 0 ? 1 : 0}
          initialRowKey={
            appraisalCount > 0 && finds[0] ? findKey(finds[0].key) : undefined
          }
          title="鑑定"
          notice="鑑定は無料。拾った武器は、前の持ち主の強化も調べます。"
          tabs={[
            {
              name: "未鑑定品",
              rows: [
                ...unidentifiedWeapons.map((entry) => ({
                  key: gearKey(entry.gear),
                  icon: entry.id,
                  name: entry.name,
                  stat: entry.stat,
                  desc: entry.desc,
                  badge: "未鑑定",
                  rarity: null,
                })),
                // 2個以上あれば、全部を一度に鑑定する行を先頭に出す
                ...(junkTotal > 1
                  ? [
                      {
                        key: APPRAISE_ALL,
                        icon: junk.id,
                        name: "まとめて鑑定",
                        stat: `${junkTotal}個`,
                        desc: "持っているガラクタを全部鑑定する。光るガラクタから先に。",
                        badge: `×${junkTotal}`,
                      },
                    ]
                  : []),
                ...[junk, rareJunk]
                  .filter((entry) => !!entry && entry.count > 0)
                  .map((entry) => ({
                    key: goodKey(entry!.id),
                    icon: entry!.id,
                    name: entry!.name,
                    stat: entry!.stat,
                    desc: entry!.desc,
                    badge: `×${entry!.count}`,
                    rarity: entry!.id === rareJunk?.id ? "R" : null,
                  })),
              ],
            },
            ...(finds.length
              ? [
                  {
                    name: `見つけた物 ${finds.length}`,
                    rows: [
                      ...autoEquipRows(),
                      ...finds.map((find) => {
                        const best = find.gear
                          ? game.queries.upgrades(state, find.gear)[0]
                          : undefined
                        const owner = find.gear
                          ? game.queries
                              .gear(state)
                              .find((entry) => entry.gear === find.gear)?.owner
                          : null
                        return {
                          key: findKey(find.key),
                          icon: find.good,
                          name: find.name,
                          stat: find.stat,
                          desc: [
                            !find.weapon &&
                            find.gear &&
                            !owner &&
                            !armorTargets(find.gear).length
                              ? "今の編成に装備できる仲間はいません。"
                              : "",
                            owner && best
                              ? `${owner}から受け取る（${owner}は武器なしになる）`
                              : "",
                            best
                              ? `${best.name}が持つと 攻撃力 ${best.before} → ${best.after}`
                              : find.weapon
                                ? NO_ATTACK_UPGRADE_MESSAGE
                                : "",
                            !find.weapon ? find.desc : "",
                            find.skills.length
                              ? `ワザ：${find.skills
                                  .map(
                                    (skill) =>
                                      `${skill.random ? RANDOM_SKILL_MARK : ""}${skill.name}`
                                  )
                                  .join("・")}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join("\n"),
                          sub: owner
                            ? `${owner}が装備`
                            : find.bargain
                              ? "掘り出し物"
                              : "",
                          rarity: find.rarity,
                        }
                      }),
                    ],
                  },
                ]
              : []),
            ...(info.appraisalArmor.length
              ? [
                  {
                    name: "探索の防具",
                    rows: info.appraisalArmor.map((entry) => ({
                      key: `appraisal-armor-${entry.id}`,
                      icon: entry.id,
                      name: entry.name,
                      stat: entry.stat,
                      desc: `通常のガラクタの鑑定で見つかることがある。光るガラクタからは出ない。${gearDesc(entry)}`,
                      sub: entry.own ? "所持中" : "未所持",
                      badge: entry.own ? `×${entry.own}` : undefined,
                    })),
                  },
                ]
              : []),
          ]}
          action={(row) => {
            if (row.key === AUTO_EQUIP) return autoEquipLabel()
            if (row.key === APPRAISE_ALL)
              return junkTotal > 1 ? "全部鑑定する" : null
            if (
              unidentifiedWeapons.some(
                (entry) => gearKey(entry.gear) === row.key
              )
            )
              return "鑑定する"
            if (row.key === goodKey(junk.id))
              return junk.count > 0 ? "鑑定する" : null
            if (!!rareJunk && row.key === goodKey(rareJunk.id))
              return rareJunk.count > 0 ? "鑑定する" : null
            const find = finds.find((entry) => findKey(entry.key) === row.key)
            if (find?.gear && !find.weapon)
              return armorTargets(find.gear).length ? "仲間に着せる" : null
            const best = find?.gear
              ? game.queries.upgrades(state, find.gear)[0]
              : undefined
            return best ? `${best.name}に持たせる` : null
          }}
          onAction={(row, at) => {
            if (row.key === AUTO_EQUIP) return autoEquip(at)
            if (row.key === APPRAISE_ALL) return appraiseAll()
            const rare = !!rareJunk && row.key === goodKey(rareJunk.id)
            const unidentified = unidentifiedWeapons.find(
              (entry) => gearKey(entry.gear) === row.key
            )
            if (row.key !== goodKey(junk.id) && !rare && !unidentified) {
              const find = finds.find((entry) => findKey(entry.key) === row.key)
              if (find?.gear && !find.weapon) {
                const gearId = find.gear
                const eligible = armorTargets(gearId)
                if (!eligible.length) return fx.shake(0.6)
                formation.requestTarget({
                  eligible,
                  label: `${find.name}を誰に着せる？`,
                  details: eligible.map((member) => ({
                    member,
                    name: game.queries.member(game.state, member)!.name,
                    description: armorComparisonText(
                      game.queries.armorComparison(game.state, member, gearId)
                    ),
                  })),
                  onPick: (member) => {
                    const sent = eventsOf(
                      inPhase(game, "town")?.equip(gearId, member)
                    )
                    if (Array.isArray(sent)) burst(at, "")
                    else fx.shake(0.6)
                  },
                  onCancel: () => {},
                })
                return
              }
              const best = find?.gear
                ? game.queries.upgrades(game.state, find.gear)[0]
                : undefined
              const sent =
                find?.gear && best
                  ? eventsOf(
                      inPhase(game, "town")?.equip(find.gear, best.member)
                    )
                  : null
              if (Array.isArray(sent)) burst(at, "")
              else fx.shake(0.6)
              return
            }
            const events = eventsOf(
              inPhase(game, "town")?.appraise(
                props.shop,
                rare,
                unidentified?.gear
              )
            )
            if (!Array.isArray(events)) return fx.shake(0.6)
            const fresh = findsOf(events)
            if (!fresh.length) return
            setFound({ find: fresh[0] })
            setFinds((list) => [...fresh, ...list])
            setAppraisalCount((count) => count + 1)
            reveal(fresh[0])
          }}
          onClose={() => {
            setFound(null)
            setFinds([])
            setAppraisalCount(0)
            props.onClose()
          }}
        />
      ) : null}
      {found ? (
        <AppraisalReveal
          find={found.find}
          summary={found.summary}
          onClose={() => setFound(null)}
        />
      ) : null}
    </>
  )
}
