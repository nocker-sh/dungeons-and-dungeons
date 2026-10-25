import { describe, expect, it } from "vite-plus/test"
import { ContentError, GameCatalog, type GameContent } from "@/lib/wiz"
import {
  aContent,
  contentId,
  goodBySlug,
  memberBySlug,
  realContent,
} from "@/lib/wiz/testing"

function problemsOf(content: unknown) {
  try {
    new GameCatalog(content)
    return null
  } catch (error) {
    if (error instanceof ContentError) return error.problems
    throw error
  }
}

function expectRejected(content: unknown, message: string) {
  const problems = problemsOf(content)
  expect(problems, message).not.toBe(null)
  expect(problems, message).toContain(message)
}

describe("コンテンツの検証（hunt）", () => {
  const greatsword = goodBySlug("greatsword")
  const weaponSkills = greatsword.skills!
  const leather = goodBySlug("leather")
  const potion = goodBySlug("potion")
  // 使用回数のないワザ（殴る）と、届き方のある攻撃のワザ
  const brawl = contentId("brawl")
  const melee = contentId("helmsplit")

  it("本物の作品データは通る", () => {
    expect(problemsOf(realContent())).toBe(null)
  })

  it("武器のワザがちょうど3つでないと拒否する", () => {
    for (const skills of [
      weaponSkills.slice(0, 1),
      weaponSkills.slice(0, 2),
      [...weaponSkills, melee],
    ])
      expectRejected(
        aContent().withGood("greatsword", { skills }).build(),
        `武器 ${greatsword.id} のワザはちょうど3つにする`
      )
  })

  it("武器のワザが重複していると拒否する（残りを分け合う指示が二つ出るため）", () => {
    expectRejected(
      aContent()
        .withGood("greatsword", {
          skills: [weaponSkills[0], ...weaponSkills.slice(0, 3)],
        })
        .build(),
      `武器 ${greatsword.id} のワザが重複している`
    )
  })

  it("武器のワザに使用回数がないと拒否する", () => {
    const content = aContent()
      .withGood("greatsword", {
        skills: [...weaponSkills.slice(0, 3), brawl],
      })
      .build()
    expectRejected(
      content,
      `武器 ${greatsword.id} のワザ ${brawl} に使用回数（uses）がない`
    )
  })

  it("武器に武器種・攻撃力・必要な能力がないと拒否する", () => {
    expectRejected(
      aContent().withGood("greatsword", { weaponType: undefined }).build(),
      `武器 ${greatsword.id} に武器種（weaponType）がない`
    )
    expectRejected(
      aContent().withGood("greatsword", { power: undefined }).build(),
      `武器 ${greatsword.id} に攻撃力（power）がない`
    )
    expectRejected(
      aContent().withGood("greatsword", { need: undefined }).build(),
      `武器 ${greatsword.id} に必要な筋力・技量（need）がない`
    )
  })

  it("武器ではない品物に武器種やワザは持たせない", () => {
    expectRejected(
      aContent().withGood("potion", { weaponType: "sword" }).build(),
      `${potion.id} は武器ではないので武器種とワザは持てない`
    )
    expectRejected(
      aContent()
        .withGood("leather", { skills: [melee] })
        .build(),
      `${leather.id} は武器ではないので武器種とワザは持てない`
    )
  })

  it("防具に耐久がないと拒否し、防具でない品物に耐久は持たせない", () => {
    expectRejected(
      aContent().withGood("leather", { durability: undefined }).build(),
      `防具 ${leather.id} に耐久（durability）がない`
    )
    expectRejected(
      aContent().withGood("potion", { durability: 10 }).build(),
      `${potion.id} は防具ではないので耐久は持てない`
    )
  })

  it("防具の部位は armor だけにする（兜や盾の部位は作らない）", () => {
    expectRejected(
      aContent().withGood("leather", { slot: "head" }).build(),
      `防具 ${leather.id} の部位は armor だけにする`
    )
    expect(
      problemsOf(aContent().withGood("leather", { slot: "armor" }).build())
    ).toBe(null)
  })

  it("ユニークの仲間に固有の武器がないと拒否する", () => {
    const content = aContent().build()
    expectRejected(
      {
        ...content,
        recruits: content.recruits.map((recruit) =>
          recruit.member.unique
            ? { ...recruit, member: { ...recruit.member, weapon: undefined } }
            : recruit
        ),
      },
      `ユニークの仲間 ${contentId("husky")} に固有の武器（weapon）がない`
    )
  })

  it("R の仲間に契約がない・モードの並びや品物が合わない・装備を持たせると拒否する", () => {
    const content = aContent().build()
    const alma = contentId("alma")
    const withAlma = (patch: object) => ({
      ...content,
      recruits: content.recruits.map((recruit) =>
        recruit.member.id === alma
          ? { ...recruit, member: { ...recruit.member, ...patch } }
          : recruit
      ),
    })
    // 実データは1人1モードなので、ほかの R のモードを借りて3つ並べる
    const modes = ["alma", "sera", "rivet"].map((slug, index) => ({
      ...memberBySlug(slug).pact!.modes[0]!,
      level: [1, 6, 12][index]!,
    }))
    expectRejected(
      withAlma({ pact: undefined }),
      `R の仲間 ${alma} に契約（pact）がない`
    )
    expectRejected(
      withAlma({
        pact: {
          modes: modes.map((mode) => ({ ...mode, level: mode.level + 1 })),
        },
      }),
      `${alma} の最初のモードはレベル1から選べるようにする`
    )
    expectRejected(
      withAlma({ pact: { modes: [modes[0], modes[2], modes[1]] } }),
      `${alma} のモードはレベルの低い順に並べる`
    )
    expectRejected(
      withAlma({
        pact: { modes: [modes[0], { level: 6, weapon: leather.id }] },
      }),
      `${alma} のモード ${leather.id} は3つのワザを持つ武器の品物にする`
    )
    for (const patch of [
      { unique: true },
      { weapon: greatsword.id },
      { gear: [leather.id] },
      { fixedArmor: true },
    ])
      expectRejected(
        withAlma(patch),
        `${alma} は契約の仲間なので、武器・防具・ユニークを持たせない`
      )
  })

  it("主人公はちょうど一人で、募集には入れない", () => {
    const content = aContent().build()
    expectRejected(
      {
        ...content,
        party: [
          ...content.party,
          { ...content.recruits[0].member, hero: true },
        ],
      },
      "最初からいる仲間には主人公がちょうど一人必要"
    )
    expectRejected(
      aContent().withPartyMember("hero", { hero: undefined }).build(),
      "最初からいる仲間には主人公がちょうど一人必要"
    )
    expectRejected(
      {
        ...content,
        recruits: content.recruits.map((recruit, index) =>
          index === 0
            ? { ...recruit, member: { ...recruit.member, hero: true } }
            : recruit
        ),
      },
      "募集に主人公は入れられない"
    )
  })

  it("「殴る」は使用回数なしの近接の hit にする", () => {
    const content = aContent().build()
    expectRejected(
      {
        ...content,
        skills: content.skills.map((skill) =>
          skill.id === brawl ? { ...skill, uses: 3 } : skill
        ),
      },
      `殴るワザ ${brawl} に使用回数は付けない`
    )
    expectRejected(
      {
        ...content,
        skills: content.skills.map((skill) =>
          skill.id === brawl ? { ...skill, reach: "ranged" as const } : skill
        ),
      },
      `殴るワザ ${brawl} は近接の hit にする`
    )
    expectRejected({ ...content, brawl: "ghost" }, "殴るワザ ghost がない")
  })

  it("攻撃のワザに届き方がないと拒否する", () => {
    const content = aContent().build()
    expectRejected(
      {
        ...content,
        skills: content.skills.map((skill) =>
          skill.id === melee ? { ...skill, reach: undefined } : skill
        ),
      },
      `ワザ ${melee} に届き方（reach: melee / ranged）がない`
    )
  })

  it("防具を直すワザは kind を heal にする", () => {
    const content = aContent().build()
    expectRejected(
      {
        ...content,
        skills: content.skills.map((skill) =>
          skill.id === contentId("mend")
            ? { ...skill, kind: "support" as const }
            : skill
        ),
      },
      `防具を直すワザ ${contentId("mend")} は kind を heal にする`
    )
  })

  it("仲間の素の武器や装備がないと拒否する", () => {
    const hero = contentId("hero")
    expectRejected(
      aContent().withPartyMember("hero", { defaultWeapon: "ghost" }).build(),
      `${hero} の素の武器 ghost がない`
    )
    expectRejected(
      aContent().withPartyMember("hero", { weapon: "ghost" }).build(),
      `${hero} の武器 ghost がない`
    )
    expectRejected(
      aContent()
        .withPartyMember("hero", { gear: ["ghost"] })
        .build(),
      `${hero} の装備 ghost がない`
    )
    expectRejected(
      aContent()
        .withPartyMember("hero", { gear: [potion.id] })
        .build(),
      `${hero} の装備 ${potion.id} がない`
    )
    expectRejected(
      aContent()
        .withPartyMember("hero", { skills: ["ghost"] })
        .build(),
      `${hero} のスキル ghost がない`
    )
    expectRejected(
      aContent()
        .withPartyMember("hero", { skills: [brawl] })
        .build(),
      `${hero} のスキル ${brawl} に使用回数（uses）がない`
    )
  })

  it("最初から着けている装備が同じ部位で重なっていると拒否する", () => {
    // 初期状態が作れないので、カタログの検証で止める（StateIntegrityError にしない）
    const hero = contentId("hero")
    expectRejected(
      aContent()
        .withGood("leather", { allowedJobs: undefined })
        .withGood("mail", { allowedJobs: undefined })
        .withPartyMember("hero", { gear: [leather.id, contentId("mail")] })
        .build(),
      `${hero} の最初の装備が同じ部位（armor）で重なっている`
    )
    expectRejected(
      aContent()
        .withPartyMember("hero", {
          weapon: contentId("sword"),
          gear: [contentId("sword")],
        })
        .build(),
      `${hero} の最初の装備が同じ部位（weapon）で重なっている`
    )
    expectRejected(
      aContent()
        .withPartyMember("hero", { gear: [contentId("robe")] })
        .build(),
      `${hero} の初期装備 ${contentId("robe")} は職業が合わない`
    )
    expect(
      problemsOf(
        aContent()
          .withPartyMember("hero", { weapon: contentId("sword"), gear: [] })
          .build()
      )
    ).toBe(null)
  })

  it("ランダムなワザの候補が足りない・重複していると拒否する", () => {
    const content = aContent().build()
    const poolSkill = content.weaponSkills.greatsword![0]
    expectRejected(
      {
        ...content,
        weaponSkills: {
          ...content.weaponSkills,
          greatsword: [poolSkill],
        },
      },
      `武器種 greatsword のランダムなワザの候補が2つに足りない`
    )
    expectRejected(
      {
        ...content,
        weaponSkills: {
          ...content.weaponSkills,
          greatsword: [poolSkill, poolSkill],
        },
      },
      `武器種 greatsword のランダムなワザの候補が重複している`
    )
    expectRejected(
      {
        ...content,
        weaponSkills: {
          ...content.weaponSkills,
          greatsword: [poolSkill, "ghost"],
        },
      },
      `武器種 greatsword のワザ ghost がない`
    )
    expectRejected(
      {
        ...content,
        weaponSkills: {
          ...content.weaponSkills,
          greatsword: [poolSkill, brawl],
        },
      },
      `武器種 greatsword のワザ ${brawl} に使用回数（uses）がない`
    )
  })

  it("ランダムなワザの枠が固定でない枠より多いと拒否する", () => {
    const content = aContent()
      .withBalance({
        weapon: {
          ...realContent().balance.weapon,
          rarity: {
            ...realContent().balance.weapon.rarity,
            randomSkills: { N: 0, R: 1, SR: 3 },
          },
        },
      })
      .build()
    expectRejected(content, "ランダムなワザの枠は2つまで")
  })

  it("上振れの幅が [少ない, 多い] でないと拒否する", () => {
    const content = aContent()
      .withBalance({
        weapon: {
          ...realContent().balance.weapon,
          rarity: {
            ...realContent().balance.weapon.rarity,
            powerRate: { N: [0, 0], R: [0.15, 0.08], SR: [0.2, 0.3] },
          },
        },
      })
      .build()
    expectRejected(content, "レア度 R の上振れは [少ない, 多い]")
  })

  it("成長の段の境目が逆だと拒否する", () => {
    const content = aContent()
      .withBalance({
        growthCurve: {
          ...realContent().balance.growthCurve,
          bands: [21, 11],
        },
      })
      .build()
    expectRejected(
      content,
      "成長の段の境目は [序盤の終わり, 中盤の終わり] の順にする"
    )
  })

  it("id が重複していると拒否する", () => {
    const content = aContent().build()
    expectRejected(
      { ...content, goods: [...content.goods, content.goods[0]] },
      `品物 の id が重複: ${content.goods[0].id}`
    )
    expectRejected(
      { ...content, skills: [...content.skills, content.skills[0]] },
      `ワザ の id が重複: ${content.skills[0].id}`
    )
    expectRejected(
      { ...content, foes: [...content.foes, content.foes[0]] },
      `敵 の id が重複: ${content.foes[0].id}`
    )
    expectRejected(
      {
        ...content,
        layers: content.layers.map((layer, index) =>
          index === 0
            ? { ...layer, stations: [...layer.stations, layer.stations[0]] }
            : layer
        ),
      },
      `${contentId("layer0")} の地点 の id が重複: s`
    )
  })

  it("道のりの誤りを拒否する", () => {
    const content = aContent().build()
    const layer0 = content.layers[0]
    const lastStation = layer0.stations.find((station) => station.boss)!.id
    expectRejected(
      aContent()
        .withStation("layer0", "n1", { next: ["ghost"] })
        .build(),
      `${layer0.id} の n1 の次 ghost がない`
    )
    expectRejected(
      aContent().withStation("layer0", "n1", { next: [] }).build(),
      `${layer0.id} の n1 で道のりが途切れている`
    )
    expectRejected(
      aContent()
        .withStation("layer0", lastStation, { next: ["s"] })
        .build(),
      `${layer0.id} の ${lastStation} で道のりが途切れている`
    )
    expectRejected(
      aContent().withStation("layer0", "n1", { boss: true }).build(),
      `${layer0.id} にはボスの地点がちょうど一つ必要`
    )
    expectRejected(
      aContent()
        .withStation("layer0", lastStation, { boss: undefined, next: ["s"] })
        .build(),
      `${layer0.id} にはボスの地点がちょうど一つ必要`
    )
    expectRejected(
      aContent().withLayer("layer0", { start: "ghost" }).build(),
      `${layer0.id} の開始地点 ghost がない`
    )
    expectRejected(
      aContent().withStation("layer0", "n1", { event: "boss" }).build(),
      `${layer0.id} の n1：ボスの出来事は終点（boss）の地点だけ`
    )
    expectRejected(
      aContent().withStation("layer0", "n1", { event: "midboss" }).build(),
      `${layer0.id} の n1（中ボス）に foes がない`
    )
    expectRejected(
      aContent()
        .withStation("layer0", "n1", { foes: ["ghost"] })
        .build(),
      `${layer0.id} の n1 の敵 ghost がない`
    )
    expectRejected(
      aContent()
        .withLayer("layer0", { weights: { battle: 0, treasure: 0, trap: 0 } })
        .build(),
      `${layer0.id} に出来事がない`
    )
    expectRejected(
      aContent().withLayer("layer0", { boss: "ghost" }).build(),
      `${layer0.id} のボス ghost がない`
    )
    expectRejected(
      aContent()
        .withLayer("layer0", { foes: ["ghost"] })
        .build(),
      `${layer0.id} の敵 ghost がない`
    )
    expectRejected(
      aContent()
        .withLayer("layer0", { group: [3, 1] })
        .build(),
      `${layer0.id} の group は [少ない, 多い]`
    )
    expectRejected(
      aContent()
        .withLayer("layer0", {
          treasure: {
            ...layer0.treasure,
            goods: [{ good: "ghost", count: 1 }],
          },
        })
        .build(),
      `${layer0.id} の宝 ghost がない`
    )
  })

  it("reached が層の数を超えていると拒否する", () => {
    expectRejected(
      aContent().withReached(realContent().layers.length).build(),
      "reached が層の数を超えている"
    )
  })

  it("店・宿・依頼・召喚・募集の参照の誤りを拒否する", () => {
    const content = aContent().build()
    expectRejected(
      {
        ...content,
        shops: [...content.shops, { id: "ghost-shop", goods: ["ghost"] }],
      },
      "店 ghost-shop の品物 ghost がない"
    )
    expectRejected(
      {
        ...content,
        shops: [
          ...content.shops,
          { id: "free", goods: [contentId("crystal")] },
        ],
      },
      `店 free の ${contentId("crystal")} に値段がない`
    )
    expectRejected(
      {
        ...content,
        quests: content.quests.map((quest, index) =>
          index === 0 ? { ...quest, foe: "ghost" } : quest
        ),
      },
      `依頼 ${content.quests[0].id} の敵 ghost がない`
    )
    expectRejected(
      {
        ...content,
        quests: content.quests.map((quest, index) =>
          index === 0
            ? {
                ...quest,
                reward: { gold: 0, goods: [{ good: "ghost", count: 1 }] },
              }
            : quest
        ),
      },
      `依頼 ${content.quests[0].id} の報酬 ghost がない`
    )
    expectRejected(
      {
        ...content,
        hero: {
          ...content.hero,
          looks: [content.hero.looks[0], content.hero.looks[0]],
        },
      },
      "主人公の外見の候補が重複している"
    )
    expectRejected(
      { ...content, junk: potion.id },
      `ガラクタ ${potion.id} は素材の品物にする`
    )
    expectRejected(
      { ...content, startingBag: [{ good: "ghost", count: 1 }] },
      "最初の持ち物 ghost がない"
    )
    expectRejected(
      aContent()
        .withSummon({ failure: [{ good: "ghost", count: 1 }] })
        .build(),
      "召喚の失敗で得る ghost がない"
    )
    expectRejected(
      aContent()
        .withRecruiting({ initial: ["ghost"] })
        .build(),
      "最初の募集 ghost がない"
    )
    expectRejected(
      aContent()
        .withRecruiting({ slots: 1, initial: ["r-jig", "n-luca"] })
        .build(),
      "最初の募集が枠の数より多い"
    )
    expectRejected(
      aContent()
        .withRecruiting({ initial: ["r-jig", "r-jig"] })
        .build(),
      "最初の募集が重複している"
    )
    expectRejected(
      {
        ...content,
        demons: content.demons.map((demon, index) =>
          index === 0 ? { ...demon, skills: ["ghost"] } : demon
        ),
      },
      `${content.demons[0].id} のワザ ghost がない`
    )
    expectRejected(
      {
        ...content,
        foes: content.foes.map((foe, index) =>
          index === 0 ? { ...foe, drops: [{ good: "ghost", count: 1 }] } : foe
        ),
      },
      `${content.foes[0].id} の落とし物 ghost がない`
    )
    expectRejected(
      {
        ...content,
        foes: content.foes.map((foe, index) =>
          index === 0 ? { ...foe, skills: ["ghost"] } : foe
        ),
      },
      `${content.foes[0].id} のワザ ghost がない`
    )
  })

  it("鍛冶屋のレシピと強化の素材の誤りを拒否する", () => {
    const content = aContent().build()
    const smithy = content.smithy!
    expectRejected(
      {
        ...content,
        smithy: {
          ...smithy,
          upgrades: [{ gold: 10, materials: [{ good: "ghost", count: 1 }] }],
        },
      },
      "強化+1の素材 ghost がない"
    )
    expectRejected(
      {
        ...content,
        smithy: {
          ...smithy,
          recipes: [{ ...smithy.recipes[0], good: "ghost" }],
        },
      },
      `レシピ ${smithy.recipes[0].id} の品物 ghost がない`
    )
    expectRejected(
      {
        ...content,
        smithy: {
          ...smithy,
          recipes: [
            {
              ...smithy.recipes[0],
              materials: [{ good: "ghost", count: 1 }],
            },
          ],
        },
      },
      `レシピ ${smithy.recipes[0].id} の素材 ghost がない`
    )
    expectRejected(
      {
        ...content,
        smithy: {
          ...smithy,
          recipes: [smithy.recipes[0], smithy.recipes[0]],
        },
      },
      `レシピ の id が重複: ${smithy.recipes[0].id}`
    )
  })

  it("誤りは一つ目で止めずにまとめて返す", () => {
    const content = aContent().build()
    const problems = problemsOf({
      ...content,
      hero: {
        ...content.hero,
        looks: [content.hero.looks[0], content.hero.looks[0]],
      },
      junk: potion.id,
      brawl: "ghost2",
    })
    expect(problems?.length).toBeGreaterThanOrEqual(3)
  })

  it("形が違うデータは zod の誤りとして返す", () => {
    const problems = problemsOf({ ...realContent(), startingGold: -1 })
    expect(problems?.[0]).toContain("startingGold")
    expect(problemsOf(null)).not.toBe(null)
    expect(problemsOf({})).not.toBe(null)
    expect(problemsOf({ ...realContent(), party: [] })).not.toBe(null)
  })

  it("検証済みのカタログは凍っていて、引き表が全部そろう", () => {
    const catalog = new GameCatalog(realContent())
    expect(Object.isFrozen(catalog)).toBe(true)
    for (const good of realContent().goods)
      expect(catalog.good(good.id)?.id).toBe(good.id)
    for (const skill of realContent().skills)
      expect(catalog.skill(skill.id)?.id).toBe(skill.id)
    for (const recruit of realContent().recruits) {
      expect(catalog.recruit(recruit.id)?.id).toBe(recruit.id)
      expect(catalog.member(recruit.member.id)?.id).toBe(recruit.member.id)
    }
    for (const layer of realContent().layers) {
      expect(catalog.layerIndex(layer.id)).toBe(layer.no)
      expect(catalog.station(layer.id, layer.start)?.id).toBe(layer.start)
    }
    expect(catalog.good("ghost")).toBe(undefined)
    expect(catalog.station(contentId("layer0"), "ghost")).toBe(undefined)
    expect(catalog.layerIndex("ghost")).toBe(-1)
    expect(catalog.recipe("ghost")).toBe(undefined)
    for (const type of ["greatsword", "sword", "axe", "gun", "dagger"] as const)
      expect(catalog.weaponPool(type).length).toBeGreaterThanOrEqual(2)
  })

  it("鍛冶屋がないデータでも動く", () => {
    const content = aContent().build()
    const { smithy: _smithy, ...rest } = content
    expect(problemsOf(rest)).toBe(null)
    const catalog = new GameCatalog(rest as GameContent)
    expect(catalog.data.smithy).toBe(undefined)
    expect(catalog.recipe(contentId("craft-axe"))).toBe(undefined)
  })
})
