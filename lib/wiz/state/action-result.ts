import type { StatusKind } from "@/lib/wiz/content/constants"
import type { ActorRef } from "@/lib/wiz/state/state-schema"

/** 一人の対象に起きたこと。1行動ごとに対象の数だけ並ぶ。 */
export type ActionResult = Readonly<{
  target: ActorRef
  /** 受けた被害の合計（防具の耐久で受けた分を含む）。 */
  damage?: number
  /** そのうち防具の耐久で受けた分。 */
  armor?: number
  /** この一撃で防具の耐久が尽きた。 */
  broke?: boolean
  heal?: number
  /** 戻した防具の耐久。 */
  repaired?: number
  /** 戻したワザの使用回数の合計。 */
  refill?: number
  guarded?: boolean
  /** 防いだ（protect）。 */
  blocked?: boolean
  /** 敵の遠距離の攻撃が後衛に外れた。 */
  missed?: boolean
  down?: boolean
  revived?: boolean
  status?: StatusKind
  /** 確率で状態がかからなかった。 */
  resisted?: StatusKind
  cured?: readonly StatusKind[]
}>
