import { createContext, useContext } from "react"
import { FormationCards } from "@/client/components/game/formation-cards"

/** 下の仲間の札から一人を選ばせる（回復薬・癒やしの祈りなどの対象）。 */
export type TargetRequest = {
  /** 選べる仲間。 */
  eligible: readonly string[]
  /** 何のために選ぶか（画面に出す）。 */
  label: string
  /** 選ぶ前に確認する、仲間ごとの効果。 */
  details?: readonly { member: string; name: string; description: string }[]
  detailLabel?: string
  onPick: (id: string) => void
  onCancel: () => void
}

export type FormationControl = {
  /** 並んでいる札の要素（位置を測る側が DOM を探さずに使う）。 */
  cards: FormationCards
  /** 枠の上へ絵が抜けている仲間。 */
  lifted: string | null
  lift: (id: string | null) => void
  /** 仲間を押したとき。場面ごとに差し替える（街では立ち絵、戦闘では詳細）。 */
  press: (id: string) => void
  openBag: () => void
  bagOpen: boolean
  /** バッグを開いている間は札を引っ込める。 */
  cardsHidden: boolean
  /** 仲間を選ばせている間の依頼。 */
  target: TargetRequest | null
  requestTarget: (request: TargetRequest | null) => void
  /** 押したときの動きを場面が差し替える。null で既定（立ち絵）に戻す。 */
  setPress: (press: ((id: string) => void) | null) => void
  /** 数字の変化を止めておく（宿の夜）。解くと数え上がる。 */
  frozen: boolean
  freeze: (frozen: boolean) => void
}

export const FormationContext = createContext<FormationControl>({
  cards: new FormationCards(),
  lifted: null,
  lift: () => {},
  press: () => {},
  openBag: () => {},
  bagOpen: false,
  cardsHidden: false,
  target: null,
  requestTarget: () => {},
  setPress: () => {},
  frozen: false,
  freeze: () => {},
})

export function useFormation() {
  return useContext(FormationContext)
}
