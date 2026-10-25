import type { TuningSpec } from "../lib/tune"

/**
 * 3層（毒沼の温室）のバランスを自動で合わせる指定。
 *   bun builder/cli.ts tune builder/tunings/layer3.ts --targets midboss-layer3,fresh-boss-layer3
 *   bun builder/cli.ts tune builder/tunings/layer3.ts        # 一周の目標まで含める（重い）
 *
 * ねらいは「前の層を抜けたばかりでは終点のボスに勝てないが、
 * 中ボスまでは通せて、街と探索をくり返すと突破できる」こと。
 */
const layer3: TuningSpec = {
  id: "layer3",
  label: "3層：着いたばかりでは突破できず、育てると突破できる",
  targets: [
    "midboss-layer3",
    "fresh-boss-layer3",
    "campaign-clear-layer3",
    "campaign-gap-layer3",
  ],
  knobs: [
    {
      path: "foes.futabane.hp",
      label: "中ボスのHP",
      min: 1700,
      max: 7500,
      step: 20,
    },
    {
      path: "foes.futabane.atk",
      label: "中ボスの攻撃力",
      min: 90,
      max: 280,
      step: 2,
    },
    {
      path: "foes.yukimebae.hp",
      label: "ボスのHP",
      min: 2800,
      max: 15000,
      step: 50,
    },
    {
      path: "foes.yukimebae.atk",
      label: "ボスの攻撃力",
      min: 85,
      max: 260,
      step: 2,
    },
    {
      path: [
        "foes.swamp-leech.hp",
        "foes.biting-flower.hp",
        "foes.vine-scarecrow.hp",
        "foes.spore-swarm.hp",
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
        "foes.swamp-leech.atk",
        "foes.biting-flower.atk",
        "foes.vine-scarecrow.atk",
        "foes.spore-swarm.atk",
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
        "foes.swamp-leech.exp",
        "foes.biting-flower.exp",
        "foes.vine-scarecrow.exp",
        "foes.spore-swarm.exp",
        "foes.futabane.exp",
        "foes.yukimebae.exp",
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
        "foes.swamp-leech.gold.0",
        "foes.swamp-leech.gold.1",
        "foes.biting-flower.gold.0",
        "foes.biting-flower.gold.1",
        "foes.vine-scarecrow.gold.0",
        "foes.vine-scarecrow.gold.1",
        "foes.spore-swarm.gold.0",
        "foes.spore-swarm.gold.1",
        "foes.futabane.gold.0",
        "foes.futabane.gold.1",
        "foes.yukimebae.gold.0",
        "foes.yukimebae.gold.1",
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

export default layer3
