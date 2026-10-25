import {
  FIXED_WEAPON_SKILLS,
  HERO_REGISTERED_FLAG,
  PARTY_SLOTS,
  WEAPON_SKILLS,
  growthTypes,
  rarities,
  weaponTypes,
} from "@/lib/wiz/content/constants"
import { byId } from "@/lib/wiz/content/by-id"
import { slotOf } from "@/lib/wiz/content/slot-of"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"

/**
 * 参照の食い違いを起動時に見つける。誤りは problems へ足していき、まとめて返す。
 * 形（zod）を通った後のデータだけを受け取る。
 */
export function verifyContent(catalog: GameCatalog, problems: string[]) {
  const need = (ok: unknown, message: string) => {
    if (!ok) problems.push(message)
  }
  const data = catalog.data
  const companions = data.startingCompanions ?? []
  need(
    new Set(companions).size === companions.length &&
      companions.length + data.party.length <= PARTY_SLOTS,
    "初期編成が重複または出撃の人数を超えている"
  )
  for (const companion of companions)
    need(
      catalog.member(companion) &&
        !data.party.some((member) => member.id === companion),
      "初期の仲間が不明または重複"
    )
  if (data.worldMap) {
    const map = data.worldMap
    const tiles = new Set(map.tiles.map((tile) => tile.id))
    need(
      tiles.size === map.tiles.length && tiles.has(map.start),
      "世界地図の地点が重複または開始地点が不明"
    )
    need(
      new Set(map.tiles.map((tile) => `${tile.x},${tile.y}`)).size ===
        map.tiles.length,
      "世界地図の座標が重複"
    )
    need(
      map.tiles.find((tile) => tile.id === map.start)?.settlement,
      "世界地図の開始地点は拠点にする"
    )
    for (const tile of map.tiles) {
      need(tile.x < map.width && tile.y < map.height, "世界地図の座標が範囲外")
      for (const entry of tile.goods ?? [])
        need(catalog.good(entry.good), "世界地図の採集品が不明")
      need(
        !tile.place || data.conversationPlaces?.includes(tile.place),
        "世界地図の会話場所が不明"
      )
      need(
        !tile.dungeon || catalog.layer(tile.dungeon),
        "世界地図のダンジョンが不明"
      )
    }
  }
  need(
    !data.startingDemon || catalog.demon(data.startingDemon),
    "最初の悪魔が不明"
  )
  for (const outfit of data.hero.outfits ?? [])
    need(
      catalog.good(outfit)?.kind === "armor",
      `主人公の衣装 ${outfit} が不明`
    )
  const conversationIds = new Set<string>()
  for (const conversation of data.conversations ?? []) {
    need(
      !conversationIds.has(conversation.id),
      `会話 ID が重複: ${conversation.id}`
    )
    conversationIds.add(conversation.id)
    need(
      new Set(conversation.participants).size ===
        conversation.participants.length,
      `会話 ${conversation.id} の話者が重複`
    )
    for (const participant of conversation.participants) {
      need(
        catalog.member(participant) ||
          catalog.demon(participant) ||
          data.conversationResidents?.includes(participant),
        `会話 ${conversation.id} の話者 ${participant} が不明`
      )
      need(
        ["inn", "talk", "visit"].includes(conversation.trigger) ||
          !data.conversationResidents?.includes(participant),
        `会話 ${conversation.id} の住人は探索に同行しない`
      )
    }
    if (conversation.trigger === "talk")
      need(
        data.conversationResidents?.includes(conversation.participants[0]) ||
          catalog.demon(conversation.participants[0]),
        `会話 ${conversation.id} の最初の話者は話しかける住人`
      )
    need(
      (conversation.trigger === "visit") === (conversation.place !== undefined),
      `会話 ${conversation.id} の場所は入ったときの場面だけに指定する`
    )
    need(
      conversation.place === undefined ||
        !!data.conversationPlaces?.includes(conversation.place),
      `会話 ${conversation.id} の場所 ${conversation.place} が不明`
    )
    need(
      conversation.chance === undefined || conversation.trigger === "visit",
      `会話 ${conversation.id} の確率は入ったときの場面だけに指定する`
    )
    for (const line of [
      ...conversation.lines,
      ...(conversation.choice?.options.flatMap((option) => option.lines) ?? []),
    ])
      need(
        conversation.participants.includes(line.speaker),
        `会話 ${conversation.id} に未登録の話者 ${line.speaker}`
      )
    need(
      conversation.minimumReached < data.layers.length,
      `会話 ${conversation.id} の進行度が範囲外`
    )
  }
  // 条件のフラグは、どこかの会話で立てられないと永遠に出ない
  const raised = new Set([
    HERO_REGISTERED_FLAG,
    ...(data.conversations ?? []).flatMap((conversation) => [
      ...conversation.sets,
      ...(conversation.choice?.options.flatMap((option) => option.sets) ?? []),
    ]),
  ])
  for (const conversation of data.conversations ?? [])
    for (const flag of [...conversation.requires, ...conversation.excludes])
      need(
        raised.has(flag),
        `会話 ${conversation.id} のフラグ ${flag} を立てる会話がない`
      )
  const members = [...data.party, ...data.recruits.map((entry) => entry.member)]
  need(
    data.party.filter((entry) => entry.hero).length === 1,
    "最初からいる仲間には主人公がちょうど一人必要"
  )
  need(
    new Set(data.hero.looks).size === data.hero.looks.length,
    "主人公の外見の候補が重複している"
  )
  need(
    !data.recruits.some((entry) => entry.member.hero),
    "募集に主人公は入れられない"
  )
  // R の仲間は悪魔と契約して戦う（武器も防具も持たず、ケイヤクでモードを変える）
  for (const entry of data.recruits)
    if (entry.rank === "R" && !entry.retired)
      need(
        entry.member.pact,
        `R の仲間 ${entry.member.id} に契約（pact）がない`
      )
  for (const entry of members) {
    if (entry.pact) {
      const modes = entry.pact.modes
      need(
        modes[0]?.level === 1,
        `${entry.id} の最初のモードはレベル1から選べるようにする`
      )
      need(
        modes.every(
          (mode, index) => index === 0 || mode.level > modes[index - 1].level
        ),
        `${entry.id} のモードはレベルの低い順に並べる`
      )
      for (const mode of modes) {
        const good = catalog.good(mode.weapon)
        need(
          good?.kind === "weapon" && good.skills?.length === 3,
          `${entry.id} のモード ${mode.weapon} は3つのワザを持つ武器の品物にする`
        )
      }
      need(
        new Set(modes.map((mode) => mode.weapon)).size === modes.length,
        `${entry.id} のモードが重複している`
      )
      need(
        !entry.unique &&
          !entry.weapon &&
          !entry.fixedArmor &&
          !entry.gear?.length,
        `${entry.id} は契約の仲間なので、武器・防具・ユニークを持たせない`
      )
    }
    const schools = new Set(entry.schools ?? [])
    need(
      schools.size === (entry.schools?.length ?? 0),
      `${entry.id} の流派が重複している`
    )
    // 主人公の流派は合体している悪魔で決まるので、データの流派とは照らさない
    need(
      !entry.hero || !entry.schools,
      "主人公の流派は悪魔で決まるので schools は書かない"
    )
    // 流派の合わない固有スキルは、戦闘で選べない印を付けるだけにする（拒否はしない）。
    // どの流派を使えるかは主人公では悪魔で変わるので、データの段階では決まらない。
    for (const skill of entry.skills) {
      need(catalog.skill(skill), `${entry.id} のスキル ${skill} がない`)
      need(
        catalog.skill(skill)?.uses,
        `${entry.id} のスキル ${skill} に使用回数（uses）がない`
      )
    }
    need(
      catalog.good(entry.defaultWeapon)?.kind === "weapon",
      `${entry.id} の素の武器 ${entry.defaultWeapon} がない`
    )
    if (entry.unique)
      need(
        catalog.good(entry.weapon ?? "")?.kind === "weapon",
        `ユニークの仲間 ${entry.id} に固有の武器（weapon）がない`
      )
    need(
      !entry.fixedArmor || entry.unique,
      `${entry.id} の fixedArmor は unique の仲間にだけ付ける`
    )
    if (entry.weapon)
      need(
        catalog.good(entry.weapon)?.kind === "weapon",
        `${entry.id} の武器 ${entry.weapon} がない`
      )
    for (const gear of entry.gear ?? []) {
      const good = catalog.good(gear)
      need(
        good && (good.kind === "weapon" || good.kind === "armor"),
        `${entry.id} の装備 ${gear} がない`
      )
      if (good && !entry.unique)
        need(
          catalog.canEquip(entry.id, good.id),
          `${entry.id} の初期装備 ${gear} は職業が合わない`
        )
    }
    // 最初から着けている装備は部位ごとに一つ（そうでないと初期状態が作れない）
    const slots = new Set<string>()
    for (const gear of [
      ...(entry.weapon ? [entry.weapon] : []),
      ...(entry.gear ?? []),
    ]) {
      const good = catalog.good(gear)
      if (!good) continue
      const slot = slotOf(good)
      need(
        !slots.has(slot),
        `${entry.id} の最初の装備が同じ部位（${slot}）で重なっている`
      )
      slots.add(slot)
    }
  }
  for (const skill of data.skills) {
    need(
      skill.kind !== "hit" || skill.reach,
      `ワザ ${skill.id} に届き方（reach: melee / ranged）がない`
    )
    need(
      skill.repair === undefined || skill.kind === "heal",
      `防具を直すワザ ${skill.id} は kind を heal にする`
    )
    need(
      skill.sacrifice === undefined || skill.kind === "hit",
      `自分を削るワザ ${skill.id} は kind を hit にする`
    )
    need(
      (skill.drain === undefined && skill.bonusAgainst === undefined) ||
        skill.kind === "hit",
      `吸収・追撃のワザ ${skill.id} は kind を hit にする`
    )
  }
  const brawl = catalog.skill(data.brawl)
  need(brawl, `殴るワザ ${data.brawl} がない`)
  if (brawl) {
    need(
      brawl.kind === "hit" && brawl.reach === "melee",
      `殴るワザ ${brawl.id} は近接の hit にする`
    )
    need(brawl.uses === undefined, `殴るワザ ${brawl.id} に使用回数は付けない`)
  }
  for (const good of data.goods) {
    if (good.allowedJobs) {
      need(good.kind === "armor", `${good.id} の職業制限は防具にだけ付ける`)
      need(
        new Set(good.allowedJobs).size === good.allowedJobs.length,
        `${good.id} の装備職業が重複している`
      )
      for (const job of good.allowedJobs)
        need(
          members.some((member) => member.job === job),
          `${good.id} の装備職業 ${job} が存在しない`
        )
    }
    if (good.appraiseFrom !== undefined)
      need(
        data.layers.some((layer) => layer.no === good.appraiseFrom),
        `品物 ${good.id} の鑑定の到達層 ${good.appraiseFrom} がない`
      )
    if (good.kind !== "armor")
      need(
        good.durability === undefined,
        `${good.id} は防具ではないので耐久は持てない`
      )
    if (good.kind === "armor") {
      need(good.durability, `防具 ${good.id} に耐久（durability）がない`)
      // 防具は一人一つ。部位を分けない（暫定）
      need(
        slotOf(good) === "armor",
        `防具 ${good.id} の部位は armor だけにする`
      )
    }
    if (good.kind !== "weapon") {
      need(
        good.weaponType === undefined && good.skills === undefined,
        `${good.id} は武器ではないので武器種とワザは持てない`
      )
      continue
    }
    need(good.weaponType, `武器 ${good.id} に武器種（weaponType）がない`)
    need(good.power, `武器 ${good.id} に攻撃力（power）がない`)
    need(good.need, `武器 ${good.id} に必要な筋力・技量（need）がない`)
    need(
      good.skills?.length === WEAPON_SKILLS,
      `武器 ${good.id} のワザはちょうど${WEAPON_SKILLS}つにする`
    )
    // 同じワザが二つ並ぶと、残りの使用回数を分け合う指示が二つ出てしまう
    need(
      new Set(good.skills ?? []).size === (good.skills?.length ?? 0),
      `武器 ${good.id} のワザが重複している`
    )
    for (const skill of good.skills ?? []) {
      need(catalog.skill(skill), `武器 ${good.id} のワザ ${skill} がない`)
      need(
        !catalog.skill(skill)?.blessing,
        `武器 ${good.id} に祝福は付けられない`
      )
      need(
        catalog.skill(skill)?.uses,
        `武器 ${good.id} のワザ ${skill} に使用回数（uses）がない`
      )
    }
  }
  const curve = data.balance.growthCurve
  need(
    curve.bands[0] < curve.bands[1],
    "成長の段の境目は [序盤の終わり, 中盤の終わり] の順にする"
  )
  for (const type of growthTypes)
    need(curve.types[type], `成長の型 ${type} の倍率がない`)
  const rarity = data.balance.weapon.rarity
  need(
    Object.values(rarity.randomSkills).every((count) => count === 2),
    "武器のランダム枠は全レア度で2つにする"
  )
  if (data.smithy?.skillBook)
    need(
      catalog.good(data.smithy.skillBook)?.kind === "material",
      "スキルの書は素材にする"
    )
  const randomSlots = Math.max(...Object.values(rarity.randomSkills))
  need(
    randomSlots <= WEAPON_SKILLS - FIXED_WEAPON_SKILLS,
    `ランダムなワザの枠は${WEAPON_SKILLS - FIXED_WEAPON_SKILLS}つまで`
  )
  for (const entry of rarities)
    need(
      rarity.powerRate[entry][0] <= rarity.powerRate[entry][1],
      `レア度 ${entry} の上振れは [少ない, 多い]`
    )
  for (const type of weaponTypes) {
    const pool = data.weaponSkills[type]
    need(
      pool.length >= randomSlots,
      `武器種 ${type} のランダムなワザの候補が${randomSlots}つに足りない`
    )
    need(
      new Set(pool).size === pool.length,
      `武器種 ${type} のランダムなワザの候補が重複している`
    )
    for (const skill of pool) {
      need(catalog.skill(skill), `武器種 ${type} のワザ ${skill} がない`)
      need(
        !catalog.skill(skill)?.blessing,
        `武器種 ${type} の候補に祝福は入れられない`
      )
      need(
        catalog.skill(skill)?.uses,
        `武器種 ${type} のワザ ${skill} に使用回数（uses）がない`
      )
    }
  }
  for (const demon of data.demons)
    for (const skill of demon.skills) {
      need(catalog.skill(skill), `${demon.id} のワザ ${skill} がない`)
      need(
        catalog.skill(skill)?.uses,
        `${demon.id} のワザ ${skill} に使用回数（uses）がない`
      )
      // 合体した主人公が使えるように、流派付きのワザは悪魔の流派とそろえる
      const school = catalog.skill(skill)?.school
      need(
        !school || school === demon.school,
        `${demon.id} のワザ ${skill} の流派が悪魔の流派と違う`
      )
    }
  for (const demon of data.demons) {
    if (!demon.contract) continue
    need(
      !demon.contract.paper ||
        catalog.good(demon.contract.paper)?.kind === "material",
      `悪魔 ${demon.id} の契約書が不明`
    )
    const encounter = data.conversations?.find(
      (entry) => entry.id === demon.contract!.encounter
    )
    need(
      encounter &&
        encounter.trigger === "talk" &&
        encounter.participants[0] === demon.id &&
        encounter.once,
      `${demon.id} の契約には一度限りの出会い会話が必要`
    )
    const materials = new Set<string>()
    for (const material of demon.contract.materials) {
      need(
        catalog.good(material.good)?.kind === "material",
        `${demon.id} の契約素材が不明`
      )
      need(!materials.has(material.good), `${demon.id} の契約素材が重複`)
      materials.add(material.good)
    }
  }
  need(
    catalog.good(data.junk)?.kind === "material",
    `ガラクタ ${data.junk} は素材の品物にする`
  )
  if (data.rareJunk)
    need(
      catalog.good(data.rareJunk)?.kind === "material" &&
        data.rareJunk !== data.junk,
      `光るガラクタ ${data.rareJunk} はガラクタと別の素材の品物にする`
    )
  for (const entry of data.startingBag)
    need(catalog.good(entry.good), `最初の持ち物 ${entry.good} がない`)
  for (const entry of data.summon.failure)
    need(catalog.good(entry.good), `召喚の失敗で得る ${entry.good} がない`)
  for (const layer of data.layers)
    for (const station of layer.stations) {
      need(
        (station.event === "discovery" ||
          (station.weights?.discovery ?? 0) > 0) === !!station.discovery,
        `地点 ${station.id} のイベント定義が合わない`
      )
      if (station.weights) {
        need(
          !station.event && !station.boss,
          `地点 ${station.id} の抽選と固定イベントが重複`
        )
        need(
          Object.values(station.weights).some((weight) => weight > 0),
          `地点 ${station.id} の抽選が空`
        )
      }
      for (const choice of station.discovery?.choices ?? [])
        for (const id of choice.blessings ?? [])
          need(
            catalog.skill(id)?.blessing,
            `祭壇 ${station.id} の祝福 ${id} がない`
          )
      if (station.discovery)
        need(
          new Set(station.discovery.choices.map((choice) => choice.id)).size ===
            station.discovery.choices.length,
          `地点 ${station.id} の選択肢が重複`
        )
      for (const reward of [
        ...(station.rewardGoods ?? []),
        ...(station.discovery?.choices.flatMap(
          (choice) => choice.goods ?? []
        ) ?? []),
        ...(station.discovery?.choices.flatMap(
          (choice) => choice.costGoods ?? []
        ) ?? []),
      ])
        need(
          data.goods.some(
            (good) =>
              good.id === reward.good &&
              (good.kind === "item" || good.kind === "material")
          ),
          `地点 ${station.id} の報酬が不正`
        )
    }
  for (const id of data.recruiting.initial)
    need(catalog.recruit(id), `最初の募集 ${id} がない`)
  need(
    data.recruiting.initial.length <= data.recruiting.slots,
    "最初の募集が枠の数より多い"
  )
  need(
    new Set(data.recruiting.initial).size === data.recruiting.initial.length,
    "最初の募集が重複している"
  )
  const smithy = data.smithy
  for (const [index, upgrade] of (smithy?.upgrades ?? []).entries())
    for (const entry of upgrade.materials)
      need(
        catalog.good(entry.good),
        `強化+${index + 1}の素材 ${entry.good} がない`
      )
  if (smithy) byId(smithy.recipes, "レシピ", problems)
  for (const recipe of smithy?.recipes ?? []) {
    need(
      catalog.good(recipe.good),
      `レシピ ${recipe.id} の品物 ${recipe.good} がない`
    )
    for (const entry of recipe.materials)
      need(
        catalog.good(entry.good),
        `レシピ ${recipe.id} の素材 ${entry.good} がない`
      )
  }
  for (const foe of data.foes) {
    for (const skill of Object.keys(foe.skillNames ?? {}))
      need(
        catalog.skill(skill),
        `${foe.id} のワザ名が存在しないワザを指している: ${skill}`
      )
    for (const drop of foe.drops)
      need(catalog.good(drop.good), `${foe.id} の落とし物 ${drop.good} がない`)
    for (const skill of foe.skills ?? [])
      need(catalog.skill(skill), `${foe.id} のワザ ${skill} がない`)
  }
  need(data.reached < data.layers.length, "reached が層の数を超えている")
  for (const layer of data.layers) {
    const stations = byId(layer.stations, `${layer.id} の地点`, problems)
    need(
      stations.has(layer.start),
      `${layer.id} の開始地点 ${layer.start} がない`
    )
    need(catalog.foe(layer.boss), `${layer.id} のボス ${layer.boss} がない`)
    for (const foe of layer.foes)
      need(catalog.foe(foe), `${layer.id} の敵 ${foe} がない`)
    if (layer.group)
      need(
        layer.group[0] <= layer.group[1],
        `${layer.id} の group は [少ない, 多い]`
      )
    for (const entry of layer.treasure.goods)
      need(catalog.good(entry.good), `${layer.id} の宝 ${entry.good} がない`)
    if (layer.treasure.mimic)
      need(
        catalog.foe(layer.treasure.mimic.foe),
        `${layer.id} のミミック ${layer.treasure.mimic.foe} がない`
      )
    need(
      layer.stations.filter((entry) => entry.boss).length === 1,
      `${layer.id} にはボスの地点がちょうど一つ必要`
    )
    for (const entry of layer.stations) {
      for (const next of entry.next)
        need(
          stations.has(next),
          `${layer.id} の ${entry.id} の次 ${next} がない`
        )
      need(
        entry.boss ? entry.next.length === 0 : entry.next.length > 0,
        `${layer.id} の ${entry.id} で道のりが途切れている`
      )
      for (const foe of entry.foes ?? [])
        need(catalog.foe(foe), `${layer.id} の ${entry.id} の敵 ${foe} がない`)
      if (entry.event === "midboss")
        need(
          entry.foes?.length,
          `${layer.id} の ${entry.id}（中ボス）に foes がない`
        )
      need(
        entry.event !== "boss" || entry.boss,
        `${layer.id} の ${entry.id}：ボスの出来事は終点（boss）の地点だけ`
      )
    }
    need(
      layer.weights.battle + layer.weights.treasure + layer.weights.trap > 0,
      `${layer.id} に出来事がない`
    )
  }
  for (const shop of data.shops) {
    for (const good of [...shop.goods, ...(shop.appraise ?? [])])
      need(catalog.good(good), `店 ${shop.id} の品物 ${good} がない`)
    for (const good of shop.goods)
      need(catalog.good(good)?.price, `店 ${shop.id} の ${good} に値段がない`)
  }
  for (const quest of data.quests) {
    for (const foe of quest.encounter?.foes ?? [])
      need(catalog.foe(foe), `依頼 ${quest.id} の戦闘の敵 ${foe} がない`)
    if (quest.encounter) {
      need(
        quest.encounter.reached < data.layers.length,
        `依頼 ${quest.id} の解放層がない`
      )
      need(
        quest.encounter.foes.includes(quest.foe),
        `依頼 ${quest.id} の対象が戦闘にいない`
      )
    }
    need(catalog.foe(quest.foe), `依頼 ${quest.id} の敵 ${quest.foe} がない`)
    for (const entry of quest.reward.goods)
      need(
        catalog.good(entry.good),
        `依頼 ${quest.id} の報酬 ${entry.good} がない`
      )
  }
}
