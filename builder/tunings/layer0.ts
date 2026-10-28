import type { TuningSpec } from "@/builder/lib/tuning/types"

/**
 * 0層のバランスを自動で合わせる指定。
 *   vp run cli tune builder/tunings/layer0.ts
 *
 * targets は builder/targets.ts の id。knobs は `--set` と同じパスで、
 * min / max は「ここまでなら動かしてよい」幅。keep が大きいほど動かさない。
 */
const layer0: TuningSpec = {
  id: "layer0",
  label: "0層：最初は突破できず、育てると突破できる",
  targets: [
    "first-battle",
    "mole-pair",
    "mole-pair-hp",
    "midboss-fresh",
    "fresh-boss",
    "boss-level",
    "fresh-clear",
    "campaign-clear",
    "campaign-trips",
  ],
  knobs: [
    { path: "foes.hiyokobu.hp", min: 24, max: 72, step: 2 },
    { path: "foes.hiyokobu.atk", min: 14, max: 44, step: 1 },
    { path: "foes.kamokutsu.hp", min: 70, max: 190, step: 4 },
    { path: "foes.kamokutsu.atk", min: 46, max: 120, step: 2 },
    { path: "foes.haribote.hp", min: 280, max: 760, step: 10 },
    { path: "foes.haribote.atk", min: 52, max: 128, step: 2 },
    { path: "foes.haribote-adult.hp", min: 700, max: 2400, step: 25 },
    { path: "foes.haribote-adult.atk", min: 42, max: 110, step: 2 },
    // 経験値は育つ速さそのものなので、なるべく触らない。
    { path: "balance.expBase", min: 12, max: 40, step: 1, keep: 2 },
    {
      path: "balance.armor.repairPerPoint",
      label: "防具の修理代（耐久1あたり）",
      min: 0.2,
      max: 1.2,
      step: 0.05,
      keep: 1.5,
    },
    {
      path: [
        "goods.greatsword.price",
        "goods.sword.price",
        "goods.sword-shield.price",
        "goods.axe.price",
        "goods.dagger.price",
        "goods.gun.price",
      ],
      label: "店の武器の値段（倍率）",
      mode: "scale",
      min: 0.6,
      max: 2,
      step: 0.05,
      keep: 1.5,
    },
  ],
}

export default layer0
