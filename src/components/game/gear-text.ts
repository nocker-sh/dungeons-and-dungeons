export const NO_ATTACK_UPGRADE_MESSAGE =
  "今の編成では攻撃力が上がる仲間はいません"

/** 武器と防具の説明文。値はエンジンのQueryから受け取り、並べ方だけを決める。 */

type WeaponInfo = {
  typeName: string
  power: number
  /** 個体のレア度（N・R・SR）。 */
  rarity: string
  /** 固定値より上振れしている攻撃力。 */
  extraPower: number
  need: { readonly str: number; readonly tec: number }
  skills: readonly {
    name: string
    desc?: string
    uses: number | null
    random: boolean
  }[]
}

type Fit = {
  attack: number
  met: boolean
  short: { str: number; tec: number }
  favorite: boolean
}

/** ランダムに入ったワザに付ける印。 */
export const RANDOM_SKILL_MARK = "＊"

/** 鑑定前の収集目標。個体の追加ワザやレア度を確定したものとして示さない。 */
export function gearGoalDesc(entry: {
  desc: string
  weapon: WeaponInfo | null
  allowedJobs?: readonly string[] | null
  equipMembers?: readonly {
    name: string
    short?: { str: number; tec: number } | null
    currentArmor?: { name: string; stat: string } | null
    armorComparison?: { before: ArmorState; after: ArmorState } | null
    attackComparison?: {
      before: number
      after: number
      favorite: boolean
    } | null
  }[]
  ownedGear?: readonly { name: string; stat: string; owner: string | null }[]
}) {
  const description = entry.weapon
    ? [
        entry.desc,
        `固定のワザ（未強化）：${entry.weapon.skills
          .filter((skill) => !skill.random)
          .map(
            (skill) =>
              `${skill.name}（${skill.uses === null ? "回数制限なし" : `${skill.uses}回`}）${skill.desc ? `：${skill.desc}` : ""}`
          )
          .join("\n")}`,
        "追加のワザ・レア度・攻撃力の上振れは、鑑定で決まります。",
      ]
        .filter(Boolean)
        .join("\n")
    : gearDesc(entry)
  return [
    description,
    ...(entry.ownedGear ?? []).map(
      (gear) =>
        `手持ち：${gear.name}（${gear.stat}・${gear.owner ?? "未装備"}）`
    ),
    entry.equipMembers
      ? entry.equipMembers.length
        ? `装備できる仲間：${entry.equipMembers.map((member) => member.name).join("・")}`
        : "今の編成に装備できる仲間はいません。"
      : "",
    ...(entry.equipMembers ?? []).flatMap((member) => {
      const shortage = member.short ? shortText(member.short) : ""
      return shortage ? [`${member.name}：${shortage}`] : []
    }),
    ...(entry.equipMembers?.some((member) => member.attackComparison)
      ? [
          "N・未強化の攻撃力の目安：",
          ...entry.equipMembers.flatMap((member) =>
            member.attackComparison
              ? [
                  `${member.name}：${member.attackComparison.before} → ${member.attackComparison.after}（${member.attackComparison.favorite ? "得意" : "得意ではない"}）`,
                ]
              : []
          ),
        ]
      : []),
    ...(entry.equipMembers?.some((member) => member.armorComparison)
      ? ["未強化・消耗なしで着替えた目安："]
      : []),
    ...(entry.equipMembers ?? []).flatMap((member) => [
      ...(member.currentArmor !== undefined
        ? [
            `${member.name}の現在の防具：${
              member.currentArmor
                ? `${member.currentArmor.name}（${member.currentArmor.stat}）`
                : "防具なし"
            }`,
          ]
        : []),
      ...(member.armorComparison
        ? [armorComparisonText(member.armorComparison, member.name)]
        : []),
    ]),
  ]
    .filter(Boolean)
    .join("\n")
}

type ArmorState = {
  attack?: number
  hp: number
  maxHp: number
  str: number
  tec: number
  spd: number
  durability: number
  maxDurability: number
}

/** 受け取る仲間と、渡して防具を失う仲間の変化。数値はQueryで計算する。 */
export function armorComparisonText(
  comparison: {
    before: ArmorState
    after: ArmorState
    previousOwner?: {
      name: string
      before: ArmorState
      after: ArmorState
    } | null
  } | null,
  label = "着替え後"
) {
  if (!comparison) return ""
  const describe = (before: ArmorState, after: ArmorState, label: string) =>
    [
      `${label}：耐久 ${before.durability}/${before.maxDurability} → ${after.durability}/${after.maxDurability}`,
      ...(after.maxDurability > 0 && after.durability === 0
        ? ["着替え後は耐久切れ：ダメージを防げません。修理が必要です。"]
        : []),
      ...(before.hp !== after.hp || before.maxHp !== after.maxHp
        ? [
            `現在HP（生命力） ${before.hp}/${before.maxHp} → ${after.hp}/${after.maxHp}`,
          ]
        : []),
      ...(before.attack !== undefined &&
      after.attack !== undefined &&
      before.attack !== after.attack
        ? [`攻撃力 ${before.attack} → ${after.attack}`]
        : []),
      ...(
        [
          ["maxHp", "最大HP"],
          ["str", "筋力"],
          ["tec", "技量"],
          ["spd", "速さ"],
        ] as const
      )
        .filter(([key]) => before[key] !== after[key])
        .map(([key, label]) => `${label} ${before[key]} → ${after[key]}`),
    ].join("　")
  return [
    describe(comparison.before, comparison.after, label),
    comparison.previousOwner
      ? describe(
          comparison.previousOwner.before,
          comparison.previousOwner.after,
          `${comparison.previousOwner.name}は防具なしになる`
        )
      : "",
  ]
    .filter(Boolean)
    .join("　")
}

/** 必要な能力の不足。足りていれば空文字。 */
export function shortText(short: { str: number; tec: number }) {
  const parts = [
    ...(short.str ? [`筋力が${short.str}`] : []),
    ...(short.tec ? [`技量が${short.tec}`] : []),
  ]
  return parts.length ? `${parts.join("・")}足りない：攻撃力が下がる` : ""
}

/**
 * 一覧に出す説明。武器なら付くワザ4つと、その仲間が持ったときの攻撃力・不足を添える。
 * この個体だけのワザには印を付ける。fit を渡さなければ武器そのものの説明だけ。
 */
export function gearDesc(
  entry: {
    desc: string
    weapon: WeaponInfo | null
    allowedJobs?: readonly string[] | null
  },
  fit?: Fit | null
) {
  if (!entry.weapon)
    return [
      entry.desc,
      entry.allowedJobs
        ? `装備できる職業：${entry.allowedJobs.join("・")}`
        : "",
    ]
      .filter(Boolean)
      .join("　")
  const skills = entry.weapon.skills
  const parts = [
    `ワザ：${skills
      .map(
        (skill) =>
          `${skill.random ? RANDOM_SKILL_MARK : ""}${skill.name}（${skill.uses ?? 0}回）`
      )
      .join("・")}`,
  ]
  if (skills.some((skill) => skill.random))
    parts.push(`${RANDOM_SKILL_MARK}はこの個体だけのワザ`)
  if (fit) {
    parts.unshift(
      `${fit.favorite ? "得意" : "得意でない"}・攻撃力 ${fit.attack}`
    )
    const short = shortText(fit.short)
    if (short) parts.push(short)
  }
  return parts.join("　")
}
