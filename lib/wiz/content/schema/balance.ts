import { z } from "zod"
import { growthTypes, rarities } from "@/lib/wiz/content/constants"
import { count, positive, growth, growthWeights } from "./primitives"

/** 規則の数値。調整はここで行い、式はエンジンが持つ。 */
export const balance = z.strictObject({
  exploration: z
    .strictObject({
      discount: z.number().min(0).max(0.5),
      trapReduction: z.number().min(0).max(0.5),
      campRefill: count,
      lootGold: z.number().min(0).max(0.5),
    })
    .optional(),
  /** 次のレベルまでの経験値 = expBase × レベル^expPower（四捨五入）。 */
  expBase: positive,
  /**
   * レベルの重み。1 なら一次（レベル × expBase）、大きいほど上のレベルが遠くなる。
   * 1レベルの伸びを大きくして、踏破までのレベルを抑えるための項目。
   */
  expPower: z.number().positive(),
  /** 仲間ごとの growth がなければこれ。 */
  growth,
  /** 成長の型。段の境目のレベルと、型ごとの伸びの倍率。 */
  growthCurve: z.strictObject({
    /** [序盤の終わりのレベル, 中盤の終わりのレベル]。これを超えると次の段。 */
    bands: z.tuple([positive, positive]),
    /** 型ごとの倍率。growth に掛ける（spd は伸びる確率に掛ける）。 */
    types: z.record(z.enum(growthTypes), growthWeights),
  }),
  /** 地点へ一つ進むごとの疲れと汚れ。 */
  wear: z.strictObject({ fatigue: count, dirt: count }),
  /** この疲れ以上では出撃できない。 */
  exhaustedAt: positive,
  /** 被害 = 攻撃力 × 威力 × 振れ幅。防御値はない。 */
  damage: z.strictObject({
    swing: z.tuple([z.number().positive(), z.number().positive()]),
  }),
  /** 回復 = (base + 攻撃力) × 威力 × 振れ幅。 */
  heal: z.strictObject({
    base: count,
    swing: z.tuple([z.number().positive(), z.number().positive()]),
  }),
  /** 武器の攻撃力 = （power ＋ 強化の段 ＋ 上振れ） × 条件の倍率 × 得意の倍率。 */
  weapon: z.strictObject({
    /** 必要な筋力・技量に届かないときの倍率の下限。 */
    needFloor: z.number().min(0).max(1),
    /** 強化の段がこの数だけ進むごとに、武器のワザの最大の使用回数が1増える。 */
    usesPerPlus: positive,
    /** 得意な武器種の倍率。 */
    favorite: z.number().positive(),
    /** 得意でない武器種の倍率。 */
    other: z.number().positive(),
    /** 武器の個体差。鑑定で個体を引くときに使う。 */
    rarity: z.strictObject({
      /** レア度の出やすさ（重み）。 */
      weights: z.record(z.enum(rarities), count),
      /** 固定の攻撃力に足す上振れの幅。武器の攻撃力に対する割合 [少ない, 多い]。 */
      powerRate: z.record(
        z.enum(rarities),
        z.tuple([z.number().min(0), z.number().min(0)])
      ),
      /** 装備したとき、その武器のワザの最大の使用回数に足す数。 */
      uses: z.record(z.enum(rarities), count),
      /** 固定でない2枠のうち、武器種の候補からランダムなワザに変わる数。 */
      randomSkills: z.record(z.enum(rarities), count),
      /** 売値の倍率。 */
      sell: z.record(z.enum(rarities), z.number().positive()),
    }),
  }),
  /** 毒で一度に失うHP = 最大HP ÷ poisonDivisor。 */
  poisonDivisor: positive,
  /** 守りの加護を受けたときの被害の倍率（0 なら完全に防ぐ）。 */
  protect: z.number().min(0).max(1),
  taunt: z.number().min(0).max(1).optional(),
  /** 防御したときの被害の倍率。 */
  guard: z.number().min(0).max(1),
  /** 後衛：melee は後衛から近接で攻撃したときの被害の倍率、hit は敵の遠距離の攻撃が後衛に当たる確率。 */
  backRow: z.strictObject({
    melee: z.number().min(0).max(1),
    hit: z.number().min(0).max(1),
  }),
  /** 前衛のタンクが敵に狙われる重み（ほかの仲間は1）。 */
  tankTarget: z.number().min(1),
  /** 防具の耐久。 */
  armor: z.strictObject({
    /** 鍛冶屋の強化1段ごとに増える最大の耐久。 */
    durabilityPerPlus: count,
    /** 耐久1点を直すのにかかるお金。費用は切り上げ。 */
    repairPerPoint: z.number().positive(),
  }),
  /** 悪魔と契約して戦う仲間（R）：モードの攻撃力はレベルで上がる（強化の段に置き換える）。 */
  pact: z.strictObject({
    /** 1レベルごとに増える強化の段。 */
    plusPerLevel: z.number().positive(),
    /** 強化の段の上限。 */
    maxPlus: positive,
  }),
  /** ユニークの仲間：装備は変えられず、固有の武器を拾った武器で鍛え直す。 */
  unique: z.strictObject({
    /** 固有の武器を鍛え直せる上限の段。 */
    maxPlus: positive,
    /** 1段上げるのに必要な手応え。 */
    progressPerStep: positive,
    /** 素材にした武器のレア度ごとに得られる手応え。 */
    materialProgress: z.record(z.enum(rarities), count),
    /** 一度鍛え直すのにかかるお金。 */
    gold: count,
  }),
  /** 魔法の流派。 */
  school: z.strictObject({
    /**
     * 相性の倍率。合体している悪魔と同じ流派を使える仲間は、その流派のワザの威力がこの倍になる。
     */
    affinity: z.number().positive(),
  }),
  /** 再生（regen）で一度に戻すHP = 最大HP ÷ regenDivisor。 */
  regenDivisor: positive,
  /** 売値。 */
  sell: z.strictObject({
    /** 強化・鍛え直しの段1つごとに、元の売値のこの割合を足す。 */
    perPlus: z.number().nonnegative(),
  }),
  /**
   * 深さの手当て。層の終点を1とした深さの割合（地点の x ÷ 終点の x）に掛けて足す。
   * 「戻る」より「進む」が得になるようにするための項目。
   */
  /**
   * ガラクタの鑑定の候補。武器は到達した層の段とその前後の段から引く。
   * 一つ先の段（掘り出し物）は重み ahead で出る（他の品は1）。
   */
  appraisal: z.strictObject({
    ahead: z.number().min(0),
  }),
  /** 全滅したとき、その探索で拾ったガラクタ（光るガラクタを含む）を持ち帰れる割合（切り上げ・仮）。 */
  wipe: z.strictObject({ keepJunk: z.number().min(0).max(1) }).optional(),
  /** 倒した敵1体ごとに、武器の個体をそのまま落とす確率（仮）。 */
  weaponDrop: z
    .strictObject({
      chance: z.number().min(0).max(1),
    })
    .optional(),
  depth: z.strictObject({
    /** 戦闘で得る金貨に足す割合。 */
    gold: z.number().nonnegative(),
    /** 宝で得る金貨に足す割合。 */
    treasure: z.number().nonnegative(),
    /** 宝で得る品物の数に足す割合（切り捨てで個数が増える）。 */
    goods: z.number().nonnegative(),
    /** 中ボスを倒してから戻ると、持ち帰る金貨にこの割合を足す。 */
    retreatBonus: z.number().nonnegative(),
    /** 到達した層1つごとに、鑑定で R・SR が出やすくなる割合。 */
    rarityPerLayer: z.number().nonnegative(),
    /** 宝に光るガラクタが混ざり始める深さ（層の終点を1とした割合）。 */
    rareJunkFrom: z.number().min(0).max(1),
    /** その深さより奥の宝に、光るガラクタが1つ混ざる確率。 */
    rareJunkChance: z.number().min(0).max(1),
  }),
})
