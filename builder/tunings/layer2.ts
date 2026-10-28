import type { TuningSpec } from "@/builder/lib/tuning/types"

/**
 * 2層（錆びた鉄橋）のバランスを自動で合わせる指定。
 *   vp run cli tune builder/tunings/layer2.ts --targets midboss-layer2,fresh-boss-layer2
 *   vp run cli tune builder/tunings/layer2.ts        # 一周の目標まで含める（重い）
 *
 * ねらいは「前の層を抜けたばかりでは終点のボスに勝てないが、
 * 中ボスまでは通せて、街と探索をくり返すと突破できる」こと。
 */
const layer2: TuningSpec = {
  id: "layer2",
  label: "2層：着いたばかりでは突破できず、育てると突破できる",
  targets: [
    "midboss-layer2",
    "fresh-boss-layer2",
    "campaign-clear-layer2",
    "campaign-gap-layer2",
  ],
  knobs: [
    {
      path: "foes.mitsuashi.hp",
      label: "中ボスのHP",
      min: 1200,
      max: 5200,
      step: 20,
    },
    {
      path: "foes.mitsuashi.atk",
      label: "中ボスの攻撃力",
      min: 70,
      max: 220,
      step: 2,
    },
    {
      path: "foes.kabemimi-fortress.hp",
      label: "ボスのHP",
      min: 2600,
      max: 11000,
      step: 50,
    },
    {
      path: "foes.kabemimi-fortress.atk",
      label: "ボスの攻撃力",
      min: 70,
      max: 210,
      step: 2,
    },
    {
      path: [
        "foes.rust-hound.hp",
        "foes.gear-worm.hp",
        "foes.scrap-lump.hp",
        "foes.bridge-shade.hp",
      ],
      label: "ふつうの敵のHP（倍率）",
      mode: "scale",
      min: 0.5,
      max: 2,
      step: 0.05,
      keep: 1.5,
    },
    {
      path: [
        "foes.rust-hound.atk",
        "foes.gear-worm.atk",
        "foes.scrap-lump.atk",
        "foes.bridge-shade.atk",
      ],
      label: "ふつうの敵の攻撃力（倍率）",
      mode: "scale",
      min: 0.5,
      max: 2,
      step: 0.05,
      keep: 1.5,
    },
    {
      path: [
        "foes.rust-hound.exp",
        "foes.gear-worm.exp",
        "foes.scrap-lump.exp",
        "foes.bridge-shade.exp",
        "foes.mitsuashi.exp",
        "foes.kabemimi-fortress.exp",
      ],
      label: "この層の経験値（倍率）",
      mode: "scale",
      min: 0.4,
      max: 3,
      step: 0.05,
      keep: 2,
    },
    {
      path: [
        "foes.rust-hound.gold.0",
        "foes.rust-hound.gold.1",
        "foes.gear-worm.gold.0",
        "foes.gear-worm.gold.1",
        "foes.scrap-lump.gold.0",
        "foes.scrap-lump.gold.1",
        "foes.bridge-shade.gold.0",
        "foes.bridge-shade.gold.1",
        "foes.mitsuashi.gold.0",
        "foes.mitsuashi.gold.1",
        "foes.kabemimi-fortress.gold.0",
        "foes.kabemimi-fortress.gold.1",
      ],
      label: "この層の稼ぎ（倍率）",
      mode: "scale",
      min: 0.4,
      max: 3,
      step: 0.05,
      keep: 2,
    },
  ],
}

export default layer2
