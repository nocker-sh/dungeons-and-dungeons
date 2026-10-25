import { FoeArt, foeBoxes } from "@/components/screens/battle/foe-art"
import { FoePlate } from "@/components/screens/battle/foe-plate"
import type { BattleParts } from "@/components/screens/battle/parts"
import type { BattleView, FoeAttack } from "@/components/screens/battle/types"

/**
 * 敵の居る場所。絵と名前・体力の札を置き、狙いを選べるときは押せる。
 * 狙っている敵を押すと選んでいるワザを放ち、ほかの敵を押すと狙いを移す。
 * キーボード・コントローラーは選ぶ（アクティブにする）と狙いが移り、決定で放つ。
 */
export function Foes({
  view,
  wide,
  parts,
  shownHp,
  gone,
  attacking,
  choosing,
  aim,
  onAim,
  onFire,
}: {
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
}) {
  const boxes = foeBoxes(view.foes.length, wide)
  const single = view.foes.length === 1
  return (
    <div
      aria-hidden={!choosing}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        pointerEvents: "none",
      }}
    >
      {view.foes.map((foe, i) =>
        gone.includes(foe.id) ? null : (
          <div
            key={foe.id}
            ref={parts.foeRef(foe.id)}
            role={choosing ? "button" : undefined}
            tabIndex={choosing ? -1 : undefined}
            aria-label={
              choosing
                ? foe.id === aim
                  ? `${foe.name}へ放つ`
                  : `${foe.name}を狙う`
                : undefined
            }
            data-foe-pick={choosing ? "" : undefined}
            data-action={choosing && foe.id === aim ? "放つ" : undefined}
            className={choosing && foe.id === aim ? "foe cta" : "foe"}
            onFocus={choosing ? () => onAim(foe.id) : undefined}
            onClick={
              choosing
                ? () => (foe.id === aim ? onFire() : onAim(foe.id))
                : undefined
            }
            style={{
              position: "absolute",
              ...boxes[i],
              pointerEvents: choosing ? "auto" : "none",
              cursor: choosing ? "pointer" : undefined,
              // 狙いは矢印で見せるので、フォーカスの枠は出さない
              outline: "none",
            }}
          >
            <FoeArt
              foe={foe.foe}
              appearanceId={foe.appearanceId}
              attacking={attacking?.id === foe.id}
              skill={attacking?.skill}
              defeated={(shownHp[foe.id] ?? foe.hp) <= 0}
            />
            {!single ? (
              <div
                style={{
                  position: "absolute",
                  left: "8%",
                  right: "8%",
                  // スマホは札の下端を頭の上にそろえ、状態が増えたら上へ伸ばす（奥の敵の札が見出しへ届かない）
                  ...(wide ? { top: "-2%" } : { bottom: "86%" }),
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
      {single && !gone.includes(view.foes[0].id) ? (
        <div
          style={{
            position: "absolute",
            right: wide ? "2%" : "3%",
            top: view.foes[0].status.length
              ? wide
                ? "11%"
                : "12%"
              : wide
                ? "7%"
                : "5%",
            rotate: "-4deg",
            width: wide ? "30vw" : "64vw",
          }}
        >
          <FoePlate foe={view.foes[0]} compact={false} />
        </div>
      ) : null}
    </div>
  )
}
