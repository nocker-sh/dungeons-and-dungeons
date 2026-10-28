import type { TuningSpec } from "@/builder/lib/tuning/types"

/**
 * 4層（底なしの祭壇）のバランスを自動で合わせる指定。
 *   vp run cli tune builder/tunings/layer4.ts --targets midboss-layer4,fresh-boss-layer4
 *   vp run cli tune builder/tunings/layer4.ts        # 一周の目標まで含める（重い）
 *
 * ねらいは「前の層を抜けたばかりでは終点のボスに勝てないが、
 * 中ボスまでは通せて、街と探索をくり返すと突破できる」こと。
 */
const layer4: TuningSpec = {
  id: "layer4",
  label: "4層：着いたばかりでは突破できず、育てると突破できる",
  targets: [
    "midboss-layer4",
    "fresh-boss-layer4",
    "campaign-clear-layer4",
    "campaign-gap-layer4",
  ],
  knobs: [
    {
      path: "foes.agohitsu.hp",
      label: "中ボスのHP",
      min: 2400,
      max: 10000,
      step: 20,
    },
    {
      path: "foes.agohitsu.atk",
      label: "中ボスの攻撃力",
      min: 100,
      max: 330,
      step: 2,
    },
    {
      path: "foes.slime-swordsman.hp",
      label: "ボスのHP",
      min: 4000,
      max: 22000,
      step: 50,
    },
    {
      path: "foes.slime-swordsman.atk",
      label: "ボスの攻撃力",
      min: 95,
      max: 300,
      step: 2,
    },
    {
      path: [
        "foes.altar-shade.hp",
        "foes.wax-warden.hp",
        "foes.fallen-adventurer.hp",
        "foes.contract-familiar.hp",
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
        "foes.altar-shade.atk",
        "foes.wax-warden.atk",
        "foes.fallen-adventurer.atk",
        "foes.contract-familiar.atk",
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
        "foes.altar-shade.exp",
        "foes.wax-warden.exp",
        "foes.fallen-adventurer.exp",
        "foes.contract-familiar.exp",
        "foes.agohitsu.exp",
        "foes.slime-swordsman.exp",
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
        "foes.altar-shade.gold.0",
        "foes.altar-shade.gold.1",
        "foes.wax-warden.gold.0",
        "foes.wax-warden.gold.1",
        "foes.fallen-adventurer.gold.0",
        "foes.fallen-adventurer.gold.1",
        "foes.contract-familiar.gold.0",
        "foes.contract-familiar.gold.1",
        "foes.agohitsu.gold.0",
        "foes.agohitsu.gold.1",
        "foes.slime-swordsman.gold.0",
        "foes.slime-swordsman.gold.1",
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

export default layer4
