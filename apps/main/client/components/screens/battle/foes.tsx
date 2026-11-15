import { FoeArt } from "@/client/components/screens/battle/foe-art"
import { foeBoxes } from "@/client/components/screens/battle/foe-boxes"
import { FoePlate } from "@/client/components/screens/battle/foe-plate"
import type { BattleParts } from "@/client/components/screens/battle/parts"
import type {
  BattleView,
  FoeAttack,
} from "@/client/components/screens/battle/types"

/**
 * 敵の居る場所。絵と名前・体力の札を置き、狙いを選べるときは押せる。
 * 狙っている敵を押すと選んでいるワザを放ち、ほかの敵を押すと狙いを移す。
 * キーボード・コントローラーは選ぶ（アクティブにする）と狙いが移り、決定で放つ。
 */
type Props = {
  view: BattleView
  wide: boolean
  parts: BattleParts
  shownHp: Record<string, number>
  gone: readonly string[]
  /** 攻撃の絵に切り替えている敵。 */
  attacking: FoeAttack | null
  /** 狙いを選べるとき。 */
  choosing: boolean
  /** 狙っている敵。 */
  aim: string | null
  onAim: (id: string) => void
  /** 狙っている敵へ、選んでいるワザを放つ。 */
  onFire: () => void
}

export function Foes(props: Props) {
  const boxes = foeBoxes(props.view.foes.length, props.wide)
  const single = props.view.foes.length === 1
  return (
    <div
      aria-hidden={!props.choosing}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        pointerEvents: "none",
      }}
    >
      {props.view.foes.map((foe, i) =>
        props.gone.includes(foe.id) ? null : (
          <div
            key={foe.id}
            ref={props.parts.foeRef(foe.id)}
            role={props.choosing ? "button" : undefined}
            tabIndex={props.choosing ? -1 : undefined}
            aria-label={
              props.choosing
                ? foe.id === props.aim
                  ? `${foe.name}へ放つ`
                  : `${foe.name}を狙う`
                : undefined
            }
            data-foe-pick={props.choosing ? "" : undefined}
            data-action={
              props.choosing && foe.id === props.aim ? "放つ" : undefined
            }
            className={
              props.choosing && foe.id === props.aim ? "foe cta" : "foe"
            }
            onFocus={props.choosing ? () => props.onAim(foe.id) : undefined}
            onClick={
              props.choosing
                ? () =>
                    foe.id === props.aim ? props.onFire() : props.onAim(foe.id)
                : undefined
            }
            style={{
              position: "absolute",
              ...boxes[i],
              pointerEvents: props.choosing ? "auto" : "none",
              cursor: props.choosing ? "pointer" : undefined,
              // 狙いは矢印で見せるので、フォーカスの枠は出さない
              outline: "none",
            }}
          >
            <FoeArt
              foe={foe.foe}
              appearanceId={foe.appearanceId}
              attacking={props.attacking?.id === foe.id}
              skill={props.attacking?.skill}
              defeated={(props.shownHp[foe.id] ?? foe.hp) <= 0}
            />
            {!single ? (
              <div
                style={{
                  position: "absolute",
                  left: "8%",
                  right: "8%",
                  // スマホは札の下端を頭の上にそろえ、状態が増えたら上へ伸ばす（奥の敵の札が見出しへ届かない）
                  ...(props.wide ? { top: "-2%" } : { bottom: "86%" }),
                  rotate: "-3deg",
                }}
              >
                {/* 狙いは矢印で見せる */}
                <FoePlate foe={foe} compact />
              </div>
            ) : null}
          </div>
        )
      )}
      {single && !props.gone.includes(props.view.foes[0].id) ? (
        <div
          style={{
            position: "absolute",
            right: props.wide ? "2%" : "3%",
            top: props.view.foes[0].status.length
              ? props.wide
                ? "11%"
                : "12%"
              : props.wide
                ? "7%"
                : "5%",
            rotate: "-4deg",
            width: props.wide ? "30vw" : "64vw",
          }}
        >
          <FoePlate foe={props.view.foes[0]} compact={false} />
        </div>
      ) : null}
    </div>
  )
}
