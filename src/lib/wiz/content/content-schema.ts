import { conversationSchema } from "@/lib/wiz/conversations/schema"
import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  HERO_NAME_STORED_MAX,
  PARTY_SLOTS,
  eventKinds,
  growthTypes,
  magicSchools,
  rarities,
  reaches,
  roles,
  statusKinds,
  targets,
  weaponTypes,
} from "@/lib/wiz/content/constants"

/**
 * 作品のデータ（仲間・層・敵・品物・悪魔…）の形。
 * 中身は src/lib/content が持ち、エンジンは受け取ったものだけを使う。
 * 後から足した項目はすべて省略できる。
 */
const id = z.string().min(1)
const count = z.number().int().nonnegative()
const positive = z.number().int().positive()

/** 素の能力。str：筋力、tec：技量。攻撃力は武器が持つ。 */
const stats = z.strictObject({
  maxHp: positive,
  str: count,
  tec: count,
  spd: count,
})

/** レベルが1上がるときの伸び。spd は伸びる確率（0〜1）。 */
const growth = z.strictObject({
  maxHp: count,
  str: count,
  tec: count,
  spd: z.number().min(0).max(1),
})

/** 成長の型ごとの、段ごとの伸びの倍率。 */
const growthWeights = z.strictObject({
  early: z.number().nonnegative(),
  middle: z.number().nonnegative(),
  late: z.number().nonnegative(),
})

/** 規則の数値。調整はここで行い、式はエンジンが持つ。 */
const balance = z.strictObject({
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

const member = z.strictObject({
  id,
  name: z.string().min(1),
  job: z.string().min(1),
  role: z.enum(roles),
  exploration: z
    .enum(["scout", "bargain", "trapper", "camp", "hunter"])
    .optional(),
  combatStyle: z.string().min(1).optional(),
  hero: z.boolean().optional(),
  lv: positive,
  stats,
  /** この仲間だけのスキル（回復・補助など）。武器のワザとは別。 */
  skills: z.array(id),
  /**
   * 使える魔法の流派。流派の付いたキャラ固有のスキルは、その流派を使える仲間だけが選べる。
   * 主人公は合体している悪魔の流派を使うので書かない。武器に付くワザは誰でも使える。
   */
  schools: z.array(z.enum(magicSchools)).optional(),
  /** 得意な武器種。得意な武器では攻撃力が上がる。 */
  favorite: z.enum(weaponTypes),
  /** 武器を装備していないときに使う武器。持ち物にはならない。 */
  defaultWeapon: id,
  /** 最初から装備している武器。 */
  weapon: id.optional(),
  /** 最初から装備している防具など。 */
  gear: z.array(id).optional(),
  /** この仲間だけの伸び。省略で balance.growth。 */
  growth: growth.optional(),
  /** 成長の型。省略で normal。 */
  growthType: z.enum(growthTypes).optional(),
  /**
   * 専用の武器を持つ仲間（R・ユニーク）。専用の武器（`weapon`）は付け替えられず、
   * 拾った武器を素材にして鍛冶屋で鍛え直す。防具は `fixedArmor` がなければ着替えられる。
   */
  unique: z.boolean().optional(),
  /** 防具も変えられない（固定装備の仲間）。`unique` と一緒に使う。 */
  fixedArmor: z.boolean().optional(),
  /**
   * 悪魔と契約して戦う仲間（R）。武器も防具も持たず、戦闘中の「ケイヤク」でモードを変える。
   * モードの戦い方（武器種・攻撃力・3つのワザ）は `weapon` の品物で決まり、level に届くと選べるようになる。
   */
  pact: z
    .strictObject({
      modes: z
        .array(
          z.strictObject({
            level: positive,
            weapon: id,
            roles: z.array(z.enum(roles)).min(1).optional(),
            combatStyle: z.string().min(1).optional(),
          })
        )
        .min(1),
    })
    .optional(),
})

const status = z.strictObject({
  kind: z.enum(statusKinds),
  turns: positive,
  /** かかる確率（0〜1）。省略で必ず。 */
  chance: z.number().min(0).max(1).optional(),
})

const skill = z.strictObject({
  id,
  blessing: z.boolean().optional(),
  name: z.string().min(1),
  desc: z.string(),
  /** 最大の使用回数。省略で無制限（敵のワザと「殴る」）。 */
  uses: positive.optional(),
  /** hit：被害、heal：回復、support：被害も回復もなく状態だけ。 */
  kind: z.enum(["hit", "heal", "support"]),
  /** 攻撃の届き方。hit のワザには必ず付ける。後衛から近接は被害が減る。 */
  reach: z.enum(reaches).optional(),
  power: z.number().positive().optional(),
  target: z.enum(targets).optional(),
  status: status.optional(),
  cure: z.array(z.enum(statusKinds)).optional(),
  revive: z.boolean().optional(),
  /** 味方の防具の耐久を戻す量（キャラ固有のスキル）。 */
  repair: positive.optional(),
  /** 魔法の流派。省略すると流派を持たないワザ（誰でも使える）。 */
  school: z.enum(magicSchools).optional(),
  /**
   * 自分を削って放つワザ（悪魔の流派）。払う最大HPの割合。
   * 今のHPがこれを上回っていないと選べず、払った分は防具を通さずHPから減る。
   */
  sacrifice: z.number().positive().max(0.9).optional(),
  drain: z.number().positive().max(1).optional(),
  bonusAgainst: z
    .strictObject({
      status: z.enum(statusKinds),
      factor: z.number().min(1).max(3),
    })
    .optional(),
})

const effect = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("heal"),
    hp: positive,
    all: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal("refill"), uses: positive }),
  z.strictObject({
    type: z.literal("damage"),
    amount: positive,
    all: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal("status"),
    status,
    target: z.enum(targets).optional(),
  }),
  z.strictObject({
    type: z.literal("cure"),
    kinds: z.array(z.enum(statusKinds)).min(1),
    all: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal("revive"), hp: positive }),
])

const good = z.strictObject({
  id,
  name: z.string().min(1),
  kind: z.enum(["weapon", "armor", "item", "material"]),
  desc: z.string(),
  stat: z.string(),
  price: positive.optional(),
  sell: positive.optional(),
  /** 契約書や一度だけ手に入る約束の品を売って進行不能にしない。 */
  sellable: z.boolean().optional(),
  /**
   * 店に並ぶのに要る到達の深さ（層の番号）。省略で最初から並ぶ。
   * 深く潜るほど強い段の武器・防具が買えるようにするための項目。
   */
  unlock: count.optional(),
  /** 鑑定の候補に加わる到達層。省略した品物は、従来どおり最初から候補になる。 */
  appraiseFrom: count.optional(),
  /** 通常段の鑑定重み。一つ先の段ではaheadを掛ける。 */
  appraisalWeight: z.number().positive().optional(),
  /** 古い段になっても鑑定候補に残す品の重み。省略した装備は従来の段範囲に従う。 */
  appraisalRetentionWeight: z.number().positive().optional(),
  /** 買うと袋ではなく召喚石が増える品物。増える数。 */
  stones: positive.optional(),
  /** 装備の部位。同じ部位は一人一つ。省略で武器は weapon、防具は armor。 */
  slot: id.optional(),
  /** 武器種（武器には必ず付ける）。 */
  weaponType: z.enum(weaponTypes).optional(),
  /** 武器の攻撃力（武器には必ず付ける）。 */
  power: z.number().positive().optional(),
  /** 強化1段で増える攻撃力。省略すると1。固定武器の成長に使う。 */
  powerPerPlus: z.number().positive().optional(),
  /** 装備に必要な筋力・技量（武器には必ず付ける）。足りなくても装備はできる。 */
  need: z.strictObject({ str: count, tec: count }).optional(),
  /** 武器に付くワザ。ちょうど4つ。前の2つはその武器で固定、後ろの2つは個体によってランダムなワザに変わる。 */
  skills: z.array(id).optional(),
  /** 防具の最大の耐久（防具には必ず付ける）。受けた被害はここから先に減る。 */
  durability: positive.optional(),
  /** 装備できる職業。省略なら職業制限なし。ユニークの固有装備は別扱い。 */
  allowedJobs: z.array(id).min(1).optional(),
  bonus: z
    .strictObject({
      str: z.number().int().optional(),
      tec: z.number().int().optional(),
      spd: z.number().int().optional(),
      maxHp: z.number().int().optional(),
    })
    .optional(),
  effect: effect.optional(),
})

const foe = z.strictObject({
  id,
  /** 通常攻撃の呼び名と届き方。省略した従来データは近接の「攻撃」。 */
  attack: z
    .strictObject({ name: z.string().min(1), reach: z.enum(reaches) })
    .optional(),
  /** 同じ効果のワザでも、本人の部位に合わせて呼び名を変える。 */
  skillNames: z.record(id, z.string().min(1)).optional(),
  name: z.string().min(1),
  hp: positive,
  atk: count,
  spd: count,
  exp: count,
  gold: z.tuple([count, count]),
  drops: z.array(z.strictObject({ good: id, count: positive })),
  /** 倒すと手に入る召喚石。中ボス・ボスに付ける。 */
  stones: count.optional(),
  /** 使うワザ。手番ごとに skillRate の確率で、使えるワザから一つ選ぶ。 */
  skills: z.array(id).optional(),
  skillRate: z.number().min(0).max(1).optional(),
  /** 状態異常への耐性（0〜1）。かかる確率に (1 − 耐性) を掛ける。 */
  resist: z
    .partialRecord(z.enum(statusKinds), z.number().min(0).max(1))
    .optional(),
})

const discovery = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  choices: z
    .array(
      z.strictObject({
        id,
        label: z.string().min(1),
        description: z.string().min(1),
        blessings: z.array(id).min(1).optional(),
        healRatio: z.number().min(0).max(1).optional(),
        fatigue: count.optional(),
        refill: count.optional(),
        cost: count.optional(),
        costGoods: z
          .array(z.strictObject({ good: id, count: positive }))
          .optional(),
        healthCostRatio: z.number().positive().max(0.9).optional(),
        damageRatio: z.number().min(0).max(0.9).optional(),
        goods: z
          .array(z.strictObject({ good: id, count: positive }))
          .optional(),
      })
    )
    .min(2)
    .max(3),
})

const station = z.strictObject({
  id,
  x: z.number().int(),
  y: z.number().int(),
  next: z.array(id),
  boss: z.boolean().optional(),
  event: z.enum(eventKinds).optional(),
  label: z.string().min(1).optional(),
  hint: z.string().min(1).optional(),
  danger: z.enum(["low", "medium", "high", "unknown"]).optional(),
  mystery: z.boolean().optional(),
  weights: z
    .strictObject({
      battle: count,
      treasure: count,
      trap: count,
      discovery: count,
    })
    .optional(),
  discovery: discovery.optional(),
  rewardGoods: z
    .array(z.strictObject({ good: id, count: positive }))
    .optional(),
  /** この地点で必ず出る敵（中ボスなど）。省略で層の敵から選ぶ。 */
  foes: z.array(id).min(1).optional(),
})

const layer = z.strictObject({
  id,
  no: count,
  name: z.string().min(1),
  foes: z.array(id).min(1),
  /** 一度の戦闘に出る敵の数。省略で1。 */
  group: z.tuple([positive, positive]).optional(),
  boss: id,
  start: id,
  stations: z.array(station).min(2),
  weights: z.strictObject({ battle: count, treasure: count, trap: count }),
  treasure: z.strictObject({
    gold: z.tuple([count, count]),
    goods: z.array(z.strictObject({ good: id, count: positive })),
    mimic: z
      .strictObject({ foe: id, chance: z.number().min(0).max(1) })
      .optional(),
  }),
  trap: z.tuple([count, count]),
  /**
   * 地点ごとに見せる背景の候補（作品側の絵の識別子）。path は道中、treasure は宝箱、
   * rest は休める発見。省略した種類は path を使う。選び方はエンジンの LayerScenes。
   */
  scenes: z
    .strictObject({
      path: z.array(id).min(1),
      treasure: z.array(id).min(1).optional(),
      rest: z.array(id).min(1).optional(),
    })
    .optional(),
})

const demon = z.strictObject({
  id,
  name: z.string().min(1),
  /** 旧制作データの読み込み専用。ゲームでは階級と抽選を使わない。 */
  rank: z.enum(["SSR", "SR", "R"]).optional(),
  weight: positive.optional(),
  contract: z
    .strictObject({
      encounter: id,
      paper: id.optional(),
      gold: count,
      stones: count.optional(),
      materials: z.array(z.strictObject({ good: id, count: positive })).min(1),
    })
    .optional(),
  skills: z.array(id).min(1),
  /** この悪魔の魔法の流派。合体している主人公はこの流派を使う。 */
  school: z.enum(magicSchools).optional(),
  /**
   * 合体の効果。悪魔のレベル1つごとに主人公へ足す分。
   * ワザの威力そのものは `summon.powerPerLevel` で上がる（合体の効果とは別）。
   */
  fusion: z
    .strictObject({
      /** レベル1つごとに上がる攻撃力の割合。 */
      attack: z.number().nonnegative().optional(),
      /** レベル1つごとに増える最大HP。 */
      maxHp: count.optional(),
      /** レベル1つごとに増える状態異常への耐性（合計は1まで）。 */
      resist: z
        .partialRecord(z.enum(statusKinds), z.number().min(0).max(1))
        .optional(),
    })
    .optional(),
})

const room = z.strictObject({
  id,
  name: z.string().min(1),
  price: count,
  heal: z.enum(["half", "full"]),
  fatigue: z.number().int(),
  dirt: z.number().int(),
  levelUp: z.boolean(),
  clean: z.boolean().optional(),
})

const shop = z.strictObject({
  id,
  goods: z.array(id),
  appraise: z.array(id).optional(),
})

const stack = z.strictObject({ good: id, count: positive })

const recruit = z.strictObject({
  id,
  /** 新規募集を終了。旧保存の仲間・装備参照は維持する。 */
  retired: z.boolean().optional(),
  price: positive,
  /** 募集の枠に並ぶ出やすさ。省略で1。珍しい者ほど小さくする。 */
  weight: positive.optional(),
  /** 珍しさの表示。 */
  rank: z.enum(["SSR", "SR", "R"]).optional(),
  member,
})

/** 召喚：成功すれば悪魔、失敗すれば燃えカスなどの素材。同じ悪魔は経験値になる。 */
const summon = z.strictObject({
  /** 成功する確率（0〜1）。 */
  success: z.number().min(0).max(1),
  /** 失敗したときに手に入る物。 */
  failure: z.array(stack).min(1),
  /** 同じ悪魔が出たときの経験値。 */
  duplicateExp: positive,
  /** 1レベル上がるのに要る経験値。 */
  levelExp: positive,
  maxLevel: positive,
  /** 悪魔のレベル1つごとに、主人公のワザの威力に足す割合。 */
  powerPerLevel: z.number().nonnegative(),
})

/** 冒険者の募集：枠の数、枠を引き直す値段、最初に並ぶ募集。 */
const recruiting = z.strictObject({
  slots: positive,
  reroll: positive,
  initial: z.array(id),
})

/** 鍛冶屋：強化は +1 ごとの費用（配列の長さが上限）、生産はレシピ。 */
const cost = z.strictObject({ gold: count, materials: z.array(stack) })
const smithy = z.strictObject({
  skillBook: id.optional(),
  upgrades: z.array(cost),
  recipes: z.array(cost.extend({ id, good: id })),
})

const quest = z.strictObject({
  id,
  /** 探索なしで戦う依頼。勝利時に自動精算する。`place` は戦う場所の背景の鍵。 */
  encounter: z
    .strictObject({
      place: z.enum([
        "town",
        "farm",
        "highway",
        "rim-road",
        "shop-street",
        "back-alley",
      ]),
      foes: z.array(id).min(1).max(3),
      reached: count,
    })
    .optional(),
  requiresCleared: z.boolean().optional(),
  requiresFullPartyAlive: z.boolean().optional(),
  requiresBossVictory: z.boolean().optional(),
  name: z.string().min(1),
  desc: z.string(),
  foe: id,
  count: positive,
  reward: z.strictObject({
    gold: count,
    goods: z.array(z.strictObject({ good: id, count: positive })),
  }),
})

/**
 * 主人公。始めるときに名前と外見を決める。
 * `looks` は設定資料の外見の id で、絵と名前は画面側が同じ id から引く。
 */
const hero = z.strictObject({
  /** 登録前の仮の呼び名。 */
  name: z.string().min(1).max(HERO_NAME_STORED_MAX),
  /** 選べる外見の候補。先頭が最初に選ばれている外見。 */
  looks: z.array(id).min(1),
  /** 衣装は見た目だけ。所持・装備・能力補正には使わない。 */
  outfits: z.array(id).optional(),
})

export const contentSchema = z.strictObject({
  worldMap: z
    .strictObject({
      width: positive,
      height: positive,
      start: id,
      tiles: z
        .array(
          z.strictObject({
            id,
            x: count,
            y: count,
            name: z.string().min(1),
            biome: z.enum(["road", "village", "forest", "wetland", "mountain"]),
            settlement: z.boolean().optional(),
            requires: z.array(id).optional(),
            minimumReached: count.optional(),
            goods: z
              .array(z.strictObject({ good: id, count: positive }))
              .optional(),
            place: id.optional(),
            dungeon: id.optional(),
          })
        )
        .min(1),
    })
    .optional(),
  startingCompanions: z
    .array(id)
    .max(PARTY_SLOTS - 1)
    .optional(),
  conversations: z.array(conversationSchema).optional(),
  conversationResidents: z.array(id).optional(),
  /** 入ったときに場面が始まりうる街の場所。 */
  conversationPlaces: z.array(id).optional(),
  startingGold: count,
  startingStones: count,
  /** 最初から契約・合体している悪魔。召喚石は使わない。 */
  startingDemon: id.optional(),
  startingBag: z.array(z.strictObject({ good: id, count: positive })),
  hero,
  junk: id,
  /** 光るガラクタ。鑑定すると必ず R 以上の武器になる。 */
  rareJunk: id.optional(),
  /** 使える手が尽きたときの弱い攻撃（使用回数なし）。 */
  brawl: id,
  reached: count,
  /** 最初からいる仲間（今は主人公だけ）。残りは募集で集める。 */
  party: z.array(member).min(1).max(PARTY_SLOTS),
  skills: z.array(skill),
  /** 武器種ごとの、ランダムなワザの候補。レア度の高い個体に付く。 */
  weaponSkills: z.record(z.enum(weaponTypes), z.array(id)),
  goods: z.array(good),
  foes: z.array(foe),
  layers: z.array(layer).min(1),
  demons: z.array(demon).min(1),
  rooms: z.array(room).min(1),
  shops: z.array(shop),
  recruits: z.array(recruit),
  quests: z.array(quest),
  balance,
  summon,
  recruiting,
  smithy: smithy.optional(),
})

export type GameContent = z.input<typeof contentSchema>
export type ReadonlyContent = WizDeepReadonly<z.output<typeof contentSchema>>
type Content = z.output<typeof contentSchema>
export type MemberDef = Content["party"][number]
export type HeroDef = Content["hero"]
export type SkillDef = Content["skills"][number]
export type GoodDef = Content["goods"][number]
export type FoeDef = Content["foes"][number]
export type LayerDef = Content["layers"][number]
export type StationDef = LayerDef["stations"][number]
export type DemonDef = Content["demons"][number]
export type RoomDef = Content["rooms"][number]
export type ShopDef = Content["shops"][number]
export type RecruitDef = Content["recruits"][number]
export type QuestDef = Content["quests"][number]
export type RecipeDef = NonNullable<Content["smithy"]>["recipes"][number]
export type CostDef = NonNullable<Content["smithy"]>["upgrades"][number]
export type Effect = z.output<typeof effect>
