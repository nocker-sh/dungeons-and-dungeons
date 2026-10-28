import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { PARTY_SLOTS, PARTY_STORED_MAX } from "@/lib/wiz/content/constants"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 状態が今のコンテンツと食い違っていないか。保存を読むときに使う。
 * コンテンツを直しても、状態が指すIDが残っていれば読み込める。
 */
export function stateProblems(
  state: GameState,
  catalog: GameCatalog,
  options: {
    allowLegacyHeroArmor?: boolean
    allowLegacyPartySize?: boolean
    allowLegacyPactGear?: boolean
  } = {}
): string[] {
  const problems: string[] = []
  const need = (ok: unknown, message: string) => {
    if (!ok) problems.push(message)
  }
  const memberIds = new Set(state.members.map((member) => member.id))
  if (state.journey) {
    const map = catalog.data.worldMap
    const ids = new Set(map?.tiles.map((tile) => tile.id))
    need(map && state.reached >= 1, "世界地図がまだ解放されていない")
    need(ids.has(state.journey.at), "世界地図の現在地が不明")
    for (const list of [state.journey.visited, state.journey.collected]) {
      need(new Set(list).size === list.length, "世界地図の記録が重複")
      for (const id of list) need(ids.has(id), "世界地図の記録が不明")
    }
    need(
      state.journey.visited.includes(state.journey.at),
      "現在地をまだ訪れていない"
    )
    for (const id of state.journey.collected)
      need(state.journey.visited.includes(id), "未訪問の場所を採集している")
  }
  need(memberIds.size === state.members.length, "仲間が重複している")
  for (const member of state.members)
    need(catalog.member(member.id), `仲間 ${member.id} がコンテンツにない`)
  need(
    new Set(state.party).size === state.party.length,
    "出撃メンバーが重複している"
  )
  need(
    state.party.length <=
      (options.allowLegacyPartySize ? PARTY_STORED_MAX : PARTY_SLOTS),
    "出撃メンバーが多すぎる"
  )
  need(
    catalog.data.hero.looks.includes(state.hero.look),
    `主人公の外見 ${state.hero.look} がコンテンツにない`
  )
  need(
    !state.hero.outfit ||
      catalog.data.hero.outfits?.includes(state.hero.outfit),
    "主人公の衣装がコンテンツにない"
  )
  for (const id of state.party)
    need(memberIds.has(id), `出撃メンバー ${id} を雇っていない`)
  need(
    state.party.some((id) => catalog.member(id)?.hero),
    "主人公が出撃メンバーにいない"
  )
  for (const entry of state.bag)
    need(catalog.good(entry.good), `持ち物 ${entry.good} がコンテンツにない`)
  if (state.provisions) {
    need(
      new Set(state.provisions.map((entry) => entry.good)).size ===
        state.provisions.length,
      "持ち出し設定が重複している"
    )
    for (const entry of state.provisions)
      need(
        catalog.good(entry.good)?.kind === "item",
        "持ち出せるのは消耗品だけ"
      )
  }
  for (const entry of state.wipe?.unidentifiedWeapons ?? [])
    need(
      catalog.good(entry.good)?.kind === "weapon",
      "失った未鑑定武器がコンテンツにない"
    )
  const gearIds = new Set<string>()
  const slots = new Set<string>()
  for (const gear of state.gear) {
    const good = catalog.good(gear.good)
    need(!gearIds.has(gear.id), `装備 ${gear.id} が重複している`)
    gearIds.add(gear.id)
    need(
      !gear.unidentified || (good?.kind === "weapon" && !gear.owner),
      `未鑑定の装備 ${gear.id} は武器かつ未装備である必要がある`
    )
    need(
      good && (good.kind === "weapon" || good.kind === "armor"),
      `装備 ${gear.good} がコンテンツにない`
    )
    if (gear.owner) {
      need(
        memberIds.has(gear.owner),
        `装備 ${gear.id} の持ち主 ${gear.owner} がいない`
      )
      const slot = `${gear.owner}/${good?.slot ?? good?.kind}`
      need(!slots.has(slot), `${gear.owner} が同じ部位を二つ装備している`)
      slots.add(slot)
      const owner = catalog.member(gear.owner)
      if (
        owner &&
        !owner.unique &&
        good &&
        !(options.allowLegacyPactGear && owner.pact) &&
        !(options.allowLegacyHeroArmor && owner.hero && good.kind === "armor")
      )
        need(
          catalog.canEquip(owner.id, good.id),
          `装備 ${gear.id} は ${owner.job} が装備できない`
        )
    }
  }
  for (const member of state.members) {
    if (member.mode === undefined) continue
    const modes = catalog.member(member.id)?.pact?.modes ?? []
    need(
      member.mode < modes.length,
      `${member.id} のモード ${member.mode} が契約にない`
    )
  }
  for (const demon of state.demons)
    need(catalog.demon(demon.id), `悪魔 ${demon.id} がコンテンツにない`)
  need(
    new Set(state.demons.map((demon) => demon.id)).size === state.demons.length,
    "同じ悪魔が重なっている"
  )
  need(
    !state.contract ||
      state.demons.some((demon) => demon.id === state.contract),
    "合体する悪魔と契約していない"
  )
  for (const id of state.board)
    need(catalog.recruit(id), `募集 ${id} がコンテンツにない`)
  const upgrades = catalog.data.smithy?.upgrades.length ?? 0
  const unique = catalog.data.balance.unique
  for (const gear of state.gear) {
    const owner = gear.owner ? catalog.member(gear.owner) : undefined
    // 専用の武器は鍛え直しの段（balance.unique.maxPlus）まで上がる。
    // 鍛え直しで伸びた防具の段は、着替えて袋やほかの仲間へ移っても残る
    const kind = catalog.good(gear.good)?.kind
    const legacyPactWeapon =
      options.allowLegacyPactGear &&
      owner?.pact?.modes.some((mode) => mode.weapon === gear.good)
    const fixedWeapon =
      (!!owner?.unique || legacyPactWeapon) && kind === "weapon"
    need(
      gear.plus <=
        (fixedWeapon || kind === "armor" ? unique.maxPlus : upgrades),
      `装備 ${gear.id} の強化が上限を超えている`
    )
    need(
      fixedWeapon
        ? gear.progress < unique.progressPerStep
        : gear.progress === 0,
      `装備 ${gear.id} の鍛え直しの手応えが合わない`
    )
    const good = catalog.good(gear.good)
    if (good?.kind === "armor") {
      const max =
        (good.durability ?? 0) +
        gear.plus * catalog.data.balance.armor.durabilityPerPlus
      need(gear.wear <= max, `防具 ${gear.id} の耐久が最大を超えて減っている`)
    } else need(gear.wear === 0, `防具でない装備 ${gear.id} に耐久の減りがある`)
    if (good?.kind === "weapon") {
      need(gear.weapon, `武器 ${gear.id} に個体（レア度とワザ）がない`)
      need(
        new Set(gear.weapon?.skills).size === gear.weapon?.skills.length,
        `武器 ${gear.id} のワザが重複している`
      )
      need(
        gear.weapon?.skills[0] === good.skills?.[0],
        `武器 ${gear.id} の固有ワザが違う`
      )
      need(
        !gear.weapon?.skills.some((id) => catalog.skill(id)?.blessing),
        `武器 ${gear.id} に祝福は付けられない`
      )
      for (const skill of gear.weapon?.skills ?? [])
        need(
          catalog.skill(skill),
          `武器 ${gear.id} のワザ ${skill} がコンテンツにない`
        )
    } else need(!gear.weapon, `武器でない装備 ${gear.id} に武器の個体がある`)
  }
  need(
    state.reached < catalog.data.layers.length,
    "到達した層がコンテンツにない"
  )
  if (state.lastLayer) {
    need(
      catalog.layer(state.lastLayer),
      `層 ${state.lastLayer} がコンテンツにない`
    )
    // 前回の層は到達済みの層のうちにある（乗り場は前回の層を最初に選ぶ）
    if (catalog.layer(state.lastLayer))
      need(
        catalog.layerIndex(state.lastLayer) <= state.reached,
        `前回の層 ${state.lastLayer} に到達していない`
      )
  }
  for (const member of state.members) {
    if (member.blessing) {
      need(
        catalog.skill(member.blessing)?.blessing,
        `${member.id} の祝福がコンテンツにない`
      )
      need(
        state.phase.type === "expedition" || state.phase.type === "battle",
        "祝福は探索中だけ保持できる"
      )
      need(
        state.party.includes(member.id),
        "祝福の持ち主が出撃メンバーにいない"
      )
    }
    for (const entry of member.used)
      need(
        catalog.skill(entry.skill),
        `${member.id} が使ったワザ ${entry.skill} がコンテンツにない`
      )
  }
  for (const quest of state.quests)
    need(catalog.quest(quest.id), `依頼 ${quest.id} がコンテンツにない`)
  for (const recruit of state.recruited)
    need(catalog.recruit(recruit), `募集 ${recruit} がコンテンツにない`)
  if (state.phase.type === "expedition" || state.phase.type === "battle") {
    const { expedition } = state.phase
    const layer = catalog.layer(expedition.layer)
    need(layer, `層 ${expedition.layer} がコンテンツにない`)
    if (layer) {
      const surveyed = expedition.surveyed ?? []
      need(
        new Set(surveyed.map((entry) => entry.station)).size ===
          surveyed.length,
        "察知した地点が重複している"
      )
      for (const entry of surveyed) {
        const station = layer.stations.find(
          (station) => station.id === entry.station
        )
        // 抽選と同じく、地点専用の設定がなければ層の設定を使う。
        const weights = station?.weights ?? { ...layer.weights, discovery: 0 }
        need(station?.mystery, "察知した地点が未知の道ではない")
        need(
          station?.boss
            ? entry.kind === "boss"
            : station?.event
              ? station.event === entry.kind
              : entry.kind !== "boss" &&
                entry.kind !== "midboss" &&
                weights[entry.kind] > 0,
          "察知した出来事が地点の候補にない"
        )
      }
      if (expedition.pending?.kind === "discovery")
        need(
          layer.stations.find((station) => station.id === expedition.at)
            ?.discovery,
          "発見の選択肢がコンテンツにない"
        )
      const stations = new Set(layer.stations.map((station) => station.id))
      need(stations.has(expedition.at), `地点 ${expedition.at} が道のりにない`)
      for (const id of expedition.visited)
        need(stations.has(id), `地点 ${id} が道のりにない`)
    }
    for (const entry of expedition.loot.goods)
      need(catalog.good(entry.good), `拾い物 ${entry.good} がコンテンツにない`)
    for (const id of expedition.loot.weapons ?? [])
      need(
        state.gear.some((gear) => gear.id === id),
        `落とした武器 ${id} が装備の個体にない`
      )
  }
  if (state.phase.type === "battle") {
    const { battle } = state.phase
    need(
      new Set(battle.foes.map((foe) => foe.id)).size === battle.foes.length,
      "敵の個体が重複している"
    )
    need(
      new Set(battle.order.map((ref) => `${ref.kind}/${ref.id}`)).size ===
        battle.order.length,
      "行動順が重複している"
    )
    if (state.phase.townQuest) {
      const townQuest = state.phase.townQuest
      const quest = catalog.quest(townQuest)
      const owned = state.quests.find((entry) => entry.id === townQuest)
      need(quest?.encounter, "単発戦闘の依頼がない")
      need(
        owned && !owned.claimed && owned.progress === 0,
        "単発戦闘の依頼が完了している"
      )
      need(!battle.boss, "単発戦闘で層を突破できない")
      need(
        quest?.encounter?.foes.length === battle.foes.length &&
          battle.foes.every(
            (foe, index) => foe.foe === quest?.encounter?.foes[index]
          ),
        "単発戦闘の敵が依頼と一致しない"
      )
      need(
        !state.phase.expedition.loot.gold &&
          !state.phase.expedition.loot.goods.length &&
          !state.phase.expedition.cleared,
        "単発戦闘に探索報酬がある"
      )
    }
    for (const foe of battle.foes)
      need(catalog.foe(foe.foe), `敵 ${foe.foe} がコンテンツにない`)
    for (const ref of battle.order)
      need(
        ref.kind === "member"
          ? state.party.includes(ref.id)
          : battle.foes.some((foe) => foe.id === ref.id),
        `行動順の ${ref.id} がいない`
      )
  }
  if (state.conversation?.active) {
    const active = catalog.data.conversations?.find(
      (entry) => entry.id === state.conversation?.active
    )
    need(active, "再生中の会話がコンテンツにない")
    if (active) {
      const rules = new ConversationRules(catalog)
      const subject = {
        resident: active.participants[0],
        place: active.place,
      }
      // 始める前の状態。場所の場面は始めたときに記録した夜も戻す
      const { [active.place ?? ""]: _started, ...visits } =
        state.conversation.visits ?? {}
      const before = {
        ...state,
        conversation: { ...state.conversation, active: null, visits },
      }
      need(
        rules.reasons(before, active.trigger, active, subject).length === 0,
        "再生中の会話の人物または進行度が不正"
      )
      need(
        rules.canStart(before, active.trigger, subject),
        "再生中の会話の場面が不正"
      )
    }
  }
  return problems
}
