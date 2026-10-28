import { describe, expect, it } from "vite-plus/test"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { startedState } from "@/lib/wiz/testing/started-state"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameAction } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { AcceptQuest } from "@/lib/wiz/application/town/accept-quest"
import { Appraise } from "@/lib/wiz/application/town/appraise"
import { Buy } from "@/lib/wiz/application/town/buy"
import { Chat } from "@/lib/wiz/application/town/chat"
import { ClaimQuest } from "@/lib/wiz/application/town/claim-quest"
import { Craft } from "@/lib/wiz/application/town/craft"
import { DismissWipe } from "@/lib/wiz/application/town/dismiss-wipe"
import { Recruit } from "@/lib/wiz/application/town/recruit"
import { Reforge } from "@/lib/wiz/application/town/reforge"
import { Repair } from "@/lib/wiz/application/town/repair"
import { Reroll } from "@/lib/wiz/application/town/reroll"
import { Rest } from "@/lib/wiz/application/town/rest"
import { SeeEnding } from "@/lib/wiz/application/town/see-ending"
import { Sell } from "@/lib/wiz/application/town/sell"
import { Summon } from "@/lib/wiz/application/town/summon"
import { Upgrade } from "@/lib/wiz/application/town/upgrade"

/**
 * 画面が「できる」と見せた街の操作は必ず通り、「できない」と見せた操作は必ず断られる。
 * 見え方（Query）と規則（ユースケース）が食い違うと、押せるのに断られるボタンが出る。
 */
describe("街の見え方と規則の一致", () => {
  const definition = new GameDefinition(realContent())
  const catalog = definition.catalog
  const weapons = new WeaponRules(catalog)
  const party = new PartyRules(catalog, weapons)
  const deps = { catalog, weapons, party }
  let serial = 0
  const environment = () =>
    WizWorldEnvironment.create({
      random: () => 0.5,
      now: () => 0,
      nextId: () => `probe-${++serial}`,
    })

  /** その状態でこの操作が通るか。状態は変えない。 */
  function accepts(state: GameState, action: GameAction) {
    const run = () => {
      switch (action.type) {
        case "buy":
          return new Buy(deps).execute(state, action, environment())
        case "sell":
          return new Sell(deps).execute(state, action)
        case "appraise":
          return new Appraise(deps).execute(state, action, environment())
        case "rest":
          return new Rest(deps).execute(state, action, environment())
        case "upgrade":
          return new Upgrade(deps).execute(state, action)
        case "craft":
          return new Craft(deps).execute(state, action, environment())
        case "reforge":
          return new Reforge(deps).execute(state, action)
        case "repair":
          return new Repair(deps).execute(state, action)
        case "recruit":
          return new Recruit(deps).execute(state, action, environment())
        case "reroll":
          return new Reroll(deps).execute(state, action, environment())
        case "summon":
          return new Summon(deps).execute(state, action, environment())
        case "chat":
          return new Chat().execute(state, action)
        case "accept-quest":
          return new AcceptQuest(deps).execute(state, action)
        case "claim-quest":
          return new ClaimQuest(deps).execute(state, action)
        case "dismiss-wipe":
          return new DismissWipe().execute(state)
        case "see-ending":
          return new SeeEnding().execute(state)
        default:
          throw new Error(`試せない操作 ${action.type}`)
      }
    }
    return run().accepted
  }

  const queries = definition.create().queries

  /** その状態で、見え方と規則が食い違うところを集める。 */
  function disagreements(state: GameState, where: string): string[] {
    const problems: string[] = []
    const check = (label: string, ready: boolean, action: GameAction) => {
      const ok = accepts(state, action)
      if (ok !== ready)
        problems.push(`${where} ${label}: 見え方 ${ready} / 実際 ${ok}`)
    }
    for (const shopId of ["armory", "tools", "apothecary"].map(contentId)) {
      const shop = queries.shop(state, shopId)!
      for (const good of shop.goods)
        check(`買う ${good.id}`, good.affordable, {
          type: "buy",
          shop: shopId,
          good: good.id,
        })
      check(`鑑定 ${shopId}`, shop.appraise && queries.junk(state).count > 0, {
        type: "appraise",
        shop: shopId,
      })
    }
    for (const room of queries.rooms(state))
      check(`泊まる ${room.id}`, room.affordable, {
        type: "rest",
        room: room.id,
      })
    const smithy = queries.smithy(state)!
    for (const entry of smithy.upgrades)
      check(`強化 ${entry.gear}`, entry.ready, {
        type: "upgrade",
        gear: entry.gear,
      })
    for (const recipe of smithy.recipes)
      check(`作る ${recipe.recipe}`, recipe.ready, {
        type: "craft",
        recipe: String(recipe.recipe),
      })
    for (const entry of queries.reforges(state))
      for (const material of entry.materials)
        check(`鍛え直し ${entry.gear}`, entry.ready, {
          type: "reforge",
          gear: entry.gear,
          material: String(material.gear),
        })
    const repairs = queries.repairs(state)
    check("全部直す", repairs.all.ready, { type: "repair" })
    for (const row of repairs.rows)
      check(`直す ${row.member}`, row.ready, {
        type: "repair",
        member: row.member,
      })
    for (const recruit of queries.recruits(state))
      check(`雇う ${recruit.id}`, !recruit.hired && recruit.affordable, {
        type: "recruit",
        recruit: recruit.id,
      })
    check("引き直す", queries.reroll(state).affordable, { type: "reroll" })
    check("召喚", queries.summon(state).enabled, { type: "summon" })
    check("雑談", queries.canChatWith(state, state.party[0]), {
      type: "chat",
      liked: state.party[0],
    })
    for (const quest of queries.quests(state)) {
      check(`受ける ${quest.id}`, quest.canAccept, {
        type: "accept-quest",
        quest: quest.id,
      })
      check(`報告 ${quest.id}`, quest.status === "ready", {
        type: "claim-quest",
        quest: quest.id,
      })
    }
    for (const entry of queries.gear(state))
      check(`売る ${entry.gear}`, !entry.ownerId, {
        type: "sell",
        gear: String(entry.gear),
      })
    const result = queries.result(state)
    check("全滅を閉じる", result?.kind === "wipe", { type: "dismiss-wipe" })
    check("踏破を見る", result?.kind === "ending", { type: "see-ending" })
    return problems
  }

  it("できると見せた街の操作はすべて通り、できないと見せた操作は断られる", () => {
    const problems: string[] = []
    for (let seed = 1; seed <= 8; seed++) {
      const random = seededRandom(seed)
      const game = definition.create(
        WizWorldEnvironment.create({
          random,
          now: () => 0,
          nextId: () => `drive-${seed}-${++serial}`,
        }),
        startedState(definition)
      )
      for (let step = 0; step < 12; step++) {
        const state = game.state
        problems.push(...disagreements(state, `seed ${seed} step ${step}`))
        const pool: GameAction[] = [
          { type: "rest", room: contentId("attic") },
          { type: "rest", room: contentId("normal") },
          { type: "buy", shop: contentId("armory"), good: contentId("mail") },
          { type: "buy", shop: contentId("armory"), good: contentId("dagger") },
          { type: "appraise", shop: contentId("armory") },
          { type: "summon" },
          { type: "reroll" },
          { type: "recruit", recruit: contentId("r-jig") },
          { type: "craft", recipe: contentId("craft-axe") },
          { type: "accept-quest", quest: contentId("q-mole") },
          { type: "chat", liked: state.party[0] },
          ...state.gear.map((gear): GameAction => ({
            type: "upgrade",
            gear: gear.id,
          })),
          ...state.gear.flatMap((gear): GameAction[] =>
            state.members.map((member) => ({
              type: "equip",
              gear: gear.id,
              member: member.id,
            }))
          ),
        ]
        game.send(pool[Math.floor(random() * pool.length)])
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
  })

  it("ユニークの仲間・すり減った防具・全滅や踏破の板でも食い違わない", () => {
    const base = startedState(definition)
    const alma = catalog.recruit(contentId("r-alma"))!.member
    // アルダが最初から着けている防具の耐久を減らす（同じ部位を二つにしない）
    const aldaArmor = base.gear.find(
      (gear) => gear.owner === contentId("alda") && !gear.weapon
    )!
    const worn = { ...aldaArmor, wear: 10 }
    const heroSword = {
      id: "hero-weapon",
      good: alma.weapon!,
      owner: alma.id,
      plus: 0,
      progress: 1,
      wear: 0,
      weapon: weapons.forGoodId(alma.weapon!),
    }
    const spare = {
      id: "spare-weapon",
      good: contentId("old-sword"),
      owner: null,
      plus: 0,
      progress: 0,
      wear: 0,
      weapon: weapons.forGoodId(contentId("old-sword")),
    }
    const rich: GameState = {
      ...base,
      members: [
        ...base.members,
        {
          id: alma.id,
          lv: alma.lv,
          exp: 0,
          hp: alma.stats.maxHp,
          stats: { ...alma.stats },
          used: [],
          status: [],
          fatigue: 0,
          dirt: 0,
          like: 0,
        },
      ],
      recruited: [contentId("r-alma")],
      gear: [
        ...base.gear.filter((gear) => gear.id !== worn.id),
        worn,
        heroSword,
        spare,
      ],
      quests: [
        { id: contentId("q-mole"), progress: 3, claimed: false },
        { id: contentId("q-skeleton"), progress: 1, claimed: false },
        { id: contentId("q-king"), progress: 1, claimed: true },
      ],
    }
    const scenarios: readonly (readonly [string, GameState])[] = [
      ["お金持ち", { ...rich, gold: 5000 }],
      ["お金なし", { ...rich, gold: 0 }],
      [
        "鍛え直しの代金だけ",
        { ...rich, gold: catalog.data.balance.unique.gold },
      ],
      ["修理代だけ", { ...rich, gold: party.equipment.repairCost(worn.wear) }],
      ["袋が空", { ...rich, gold: 500, bag: [] }],
      ["召喚石なし", { ...rich, gold: 500, stones: 0 }],
      [
        "全滅の板",
        { ...rich, wipe: { layer: contentId("layer0"), gold: 40, goods: [] } },
      ],
      ["踏破の板", { ...rich, cleared: true }],
      ["踏破を見た後", { ...rich, cleared: true, endingSeen: true }],
      ["泊まった夜", { ...rich, nights: 3, chatted: [] }],
      ["雑談した夜", { ...rich, nights: 3, chatted: [...rich.party] }],
    ]
    const problems = scenarios.flatMap(([label, state]) =>
      disagreements(state, label)
    )
    expect(problems).toEqual([])
  })
})
