/**
 * 一度きりのエフェクトの入口。
 *
 * - 一覧と表示の器は `store` と `layer`
 * - 見た目の部品は種類ごとに `screen`（画面全体）、`hit`（当たり）、`number`（数字）、`cut-in`（カットイン）
 * - 呼び出しはここを通さず `use-fx` の `useFx()` を使う
 */
export { FxStore } from "@/components/stage/fx/store"
export { FxLayer } from "@/components/stage/fx/layer"
export { Blades, Flash, FocusLines } from "@/components/stage/fx/screen"
export { Burst, Shards, Slash } from "@/components/stage/fx/hit"
export { DamageAt, NumberAt } from "@/components/stage/fx/number"
export { CutIn, SpecialCutIn } from "@/components/stage/fx/cut-in"
