import type { TuningSpec } from "../lib/tune"

/**
 * 1層（巨人たちの墓場）のバランスを自動で合わせる指定。
 *   bun builder/cli.ts tune builder/tunings/layer1.ts --targets midboss-layer1,fresh-boss-layer1
 *   bun builder/cli.ts tune builder/tunings/layer1.ts        # 一周の目標まで含める（重い）
 *
 * ねらいは「前の層を抜けたばかりでは終点のボスに勝てないが、
 * 中ボスまでは通せて、街と探索をくり返すと突破できる」こと。
 */
const layer1: TuningSpec = {
  id: "layer1",
  label: "1層：着いたばかりでは突破できず、育てると突破できる",
  targets: [
    "midboss-layer1",
    "fresh-boss-layer1",
    "campaign-clear-layer1",
    "campaign-gap-layer1",
  ],
  knobs: [
    {
      path: "foes.washinoko.hp",
      label: "中ボスのHP",
      min: 700,
      max: 3200,
      step: 20,
    },
    {
      path: "foes.washinoko.atk",
      label: "中ボスの攻撃力",
      min: 70,
      max: 150,
      step: 2,
    },
    {
      path: "foes.washinoko-adult.hp",
      label: "ボスのHP",
      min: 1600,
      max: 7000,
      step: 50,
    },
    {
      path: "foes.washinoko-adult.atk",
      label: "ボスの攻撃力",
      min: 70,
      max: 150,
      step: 2,
    },
    {
      path: ["foes.bone-imp.hp", "foes.stone-golem.hp", "foes.giant.hp"],
      label: "ふつうの敵のHP（倍率）",
      mode: "scale",
      min: 0.5,
      max: 2,
      step: 0.05,
      keep: 1.5,
    },
    {
      path: ["foes.bone-imp.atk", "foes.stone-golem.atk", "foes.giant.atk"],
      label: "ふつうの敵の攻撃力（倍率）",
      mode: "scale",
      min: 0.5,
      max: 2,
      step: 0.05,
      keep: 1.5,
    },
    {
      path: [
        "foes.bone-imp.exp",
        "foes.stone-golem.exp",
        "foes.giant.exp",
        "foes.washinoko.exp",
        "foes.washinoko-adult.exp",
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
        "foes.bone-imp.gold.0",
        "foes.bone-imp.gold.1",
        "foes.stone-golem.gold.0",
        "foes.stone-golem.gold.1",
        "foes.giant.gold.0",
        "foes.giant.gold.1",
        "foes.washinoko.gold.0",
        "foes.washinoko.gold.1",
        "foes.washinoko-adult.gold.0",
        "foes.washinoko-adult.gold.1",
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

export default layer1
