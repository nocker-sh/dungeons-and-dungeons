import { useEffect, useRef, useState } from "react"
import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { CanvasButton } from "@/client/components/canvas/canvas-button"
import { PALETTE } from "@/client/components/canvas/tokens"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"

type Props = { onClose: () => void }

export function Inscription(props: Props) {
  const game = useGame()
  const state = useGameState()
  const smithy = game.queries.inscriptions(state)
  const [selected, setSelected] = useState<{
    gear: string
    slot: number
  } | null>(null)
  const [notice, setNotice] = useState("")
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus()
    return () => {
      queueMicrotask(() => {
        document
          .querySelector<HTMLButtonElement>("[data-inscription-trigger]")
          ?.focus()
      })
    }
  }, [])
  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus()
  }, [selected])
  useEffect(() => {
    const back = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (dialog.current?.closest("[inert]")) return
      if (event.key === "Tab") {
        const buttons = [
          ...(dialog.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)"
          ) ?? []),
        ]
        if (!buttons.length) return
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement
        )
        const next = event.shiftKey
          ? (index - 1 + buttons.length) % buttons.length
          : (index + 1) % buttons.length
        event.preventDefault()
        event.stopImmediatePropagation()
        buttons[next]?.focus()
        return
      }
      if (event.key !== "Escape" && event.key !== "Backspace") return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (selected) setSelected(null)
      else props.onClose()
    }
    window.addEventListener("keydown", back, true)
    return () => window.removeEventListener("keydown", back, true)
  }, [selected, props.onClose])
  if (!smithy) return null
  const weapon = smithy.inscriptions.find(
    (entry) => entry.gear === selected?.gear
  )
  const button = {
    display: "block",
    width: "100%",
    padding: 12,
    marginTop: 10,
    border: "2px solid",
    background: "#ddd7c9",
    textAlign: "left",
  } as const
  return (
    <CanvasBox
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="ワザの付け替え"
      data-gamepad-scroll
      style={{
        position: "absolute",
        inset: "8% 4% 8%",
        maxWidth: 620,
        margin: "0 auto",
        overflowY: "auto",
        background: PALETTE.paper,
        color: PALETTE.ink,
        border: "3px solid",
        padding: 18,
        zIndex: 50,
        pointerEvents: "auto",
      }}
    >
      <CanvasBox style={{ fontSize: 25, fontWeight: 900 }}>
        ワザの付け替え
      </CanvasBox>
      <CanvasBox style={{ margin: "12px 0", lineHeight: 1.5 }}>
        スキルの書：{smithy.books}
        冊。変更1回につき1冊。固有ワザは変更できません。
      </CanvasBox>
      <CanvasBox role="status">{notice}</CanvasBox>
      {weapon && selected ? (
        <>
          <CanvasBox style={{ fontWeight: 800 }}>
            {weapon.name}：{weapon.skills[selected.slot].name}（
            {weapon.skills[selected.slot].uses === null
              ? "無制限"
              : `${weapon.skills[selected.slot].uses}回`}
            ）→
          </CanvasBox>
          <CanvasBox style={{ fontSize: 13, marginTop: 5 }}>
            持ち主：{weapon.owner ?? "未装備"}・レア度：{weapon.rarity}
            {weapon.skills[selected.slot].reach ? (
              <span data-inscription-current-reach>
                ・現在のワザ：
                {weapon.skills[selected.slot].reach === "melee"
                  ? "近接"
                  : "遠距離"}
              </span>
            ) : null}
          </CanvasBox>
          <CanvasBox
            data-inscription-current-description
            style={{ fontSize: 13, marginTop: 5, lineHeight: 1.5 }}
          >
            現在：{weapon.skills[selected.slot].desc}
          </CanvasBox>
          {weapon.candidates.map((skill) => (
            <CanvasButton
              key={skill.id}
              disabled={smithy.books < 1}
              style={{
                ...button,
                color: PALETTE.ink,
                borderStyle: smithy.books > 0 ? "solid" : "dashed",
              }}
              onClick={() => {
                const result = inPhase(game, "town")?.inscribe(
                  weapon.gear,
                  selected.slot,
                  skill.id
                )
                if (result && !(result instanceof GameCommandError)) {
                  setNotice(
                    `「${skill.name}」に変更しました。スキルの書を1冊使いました。`
                  )
                  setSelected(null)
                }
              }}
            >
              <CanvasBox style={{ fontWeight: 800 }}>
                {skill.name}・
                {skill.uses === null ? "無制限" : `${skill.uses}回`}
              </CanvasBox>
              <CanvasBox style={{ fontSize: 13, marginTop: 5 }}>
                {skill.reach ? (
                  <span data-inscription-reach={skill.reach}>
                    {skill.reach === "melee" ? "近接" : "遠距離"}・
                  </span>
                ) : null}
                {skill.desc}
              </CanvasBox>
            </CanvasButton>
          ))}
          {smithy.books < 1 ? (
            <CanvasBox
              data-inscription-no-book
              style={{ marginTop: 12, fontWeight: 800, lineHeight: 1.5 }}
            >
              スキルの書がないため変更できません。
            </CanvasBox>
          ) : null}
          <CanvasButton
            data-modal-close
            onClick={() => setSelected(null)}
            style={button}
          >
            武器を選び直す
          </CanvasButton>
        </>
      ) : smithy.inscriptions.length === 0 ? (
        <CanvasBox
          data-inscription-empty
          style={{ margin: "18px 0", lineHeight: 1.5 }}
        >
          付け替えできる武器がありません。武器を鑑定するか、武器屋で購入してください。
        </CanvasBox>
      ) : (
        smithy.inscriptions.map((entry) => (
          <CanvasBox
            key={entry.gear}
            role="group"
            aria-label={`${entry.name}・レア度${entry.rarity}・${entry.owner ? `${entry.owner}が装備中` : "未装備"}`}
            style={{ marginTop: 18 }}
          >
            <CanvasBox style={{ fontWeight: 800 }}>
              {entry.name}
              {entry.owner ? `（${entry.owner}）` : "（未装備）"}
            </CanvasBox>
            <CanvasBox style={{ fontSize: 13, marginTop: 5 }}>
              レア度：{entry.rarity}
            </CanvasBox>
            <CanvasBox style={{ fontSize: 13, marginTop: 5 }}>
              固有：{entry.skills[0].name}（
              {entry.skills[0].uses === null
                ? "無制限"
                : `${entry.skills[0].uses}回`}
              ）
            </CanvasBox>
            {entry.skills.slice(1).map((skill, index) => (
              <CanvasButton
                key={index}
                style={button}
                onClick={() => {
                  setNotice("")
                  setSelected({ gear: entry.gear, slot: index + 1 })
                }}
              >
                枠{index + 2}：{skill.name}（
                {skill.uses === null ? "無制限" : `${skill.uses}回`}）を変更
              </CanvasButton>
            ))}
          </CanvasBox>
        ))
      )}
      <CanvasButton
        onClick={props.onClose}
        style={{ ...button, textAlign: "center" }}
      >
        閉じる
      </CanvasButton>
    </CanvasBox>
  )
}
