import { contentSource } from "@/content/game-content"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import type { StudioConfig } from "@/development/studio/config"
import { studioMembers } from "@/development/studio/scenarios"
import type { Dispatch, SetStateAction } from "react"
import { sectionStyle, rowStyle } from "@/client/components/dev/studio-layout"
import { Field } from "@/client/components/dev/field"
import { Choice } from "@/client/components/dev/choice"

/** 起動時の画面・隊列・敵の条件。再生と入出力は親が受け持つ。 */
type Props = {
  config: StudioConfig
  update: (patch: Partial<StudioConfig>) => void
  setTime: Dispatch<SetStateAction<number>>
}

export function StudioConditions(props: Props) {
  return (
    <>
      <div style={sectionStyle}>
        <Field label="乱数の種">
          <Input
            type="number"
            min={0}
            max={0xffffffff}
            value={props.config.seed}
            onChange={(event) =>
              props.update({ seed: Number(event.target.value) })
            }
          />
        </Field>
        <Field label="長さ（ms）">
          <Input
            type="number"
            min={100}
            max={60000}
            value={props.config.duration}
            onChange={(event) => {
              props.setTime((previous) =>
                Math.min(previous, Number(event.target.value))
              )
              props.update({ duration: Number(event.target.value) })
            }}
          />
        </Field>
      </div>
      <div style={sectionStyle}>
        {props.config.party.map((slug, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px",
              gap: 8,
            }}
          >
            <Field label={`${index + 1}人目`}>
              <Choice
                value={slug}
                disabled={index === 0}
                options={studioMembers.filter(
                  (member) =>
                    member.slug === slug ||
                    !props.config.party.includes(member.slug)
                )}
                onChange={(value) =>
                  props.update({
                    party: props.config.party.map((entry, at) =>
                      at === index ? value : entry
                    ),
                  })
                }
              />
            </Field>
            <Field label="HP %">
              <Input
                type="number"
                min={0}
                max={100}
                disabled={props.config.scene !== "battle"}
                value={props.config.hp[index]}
                onChange={(event) =>
                  props.update({
                    hp: props.config.hp.map((entry, at) =>
                      at === index ? Number(event.target.value) : entry
                    ),
                  })
                }
              />
            </Field>
          </div>
        ))}
        <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          未実装のキャラの能力は同ロールの表示モック。
        </p>
      </div>
      <div style={sectionStyle}>
        {props.config.foes.map((slug, index) => (
          <div key={index} style={rowStyle}>
            <Field label={`敵${index + 1}`}>
              <Choice
                value={slug}
                disabled={props.config.scene !== "battle"}
                options={contentSource.foes}
                onChange={(value) =>
                  props.update({
                    foes: props.config.foes.map((entry, at) =>
                      at === index ? value : entry
                    ),
                  })
                }
              />
            </Field>
            {props.config.foes.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                disabled={props.config.scene !== "battle"}
                aria-label={`敵${index + 1}を削除`}
                onClick={() =>
                  props.update({
                    foes: props.config.foes.filter((_, at) => at !== index),
                  })
                }
              >
                −
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={
            props.config.scene !== "battle" || props.config.foes.length >= 4
          }
          onClick={() =>
            props.update({
              foes: [...props.config.foes, contentSource.foes[0].slug],
            })
          }
        >
          敵を追加
        </Button>
      </div>
    </>
  )
}
