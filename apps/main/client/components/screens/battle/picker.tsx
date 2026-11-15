import { Revolver } from "@/client/components/stage/revolver"
import { useFx } from "@/client/components/stage/use-fx"
import { Word } from "@/client/components/stage/word"
import { useWide } from "@/client/components/stage/use-wide"
import { UI_LAYER, STAGE_LAYER } from "@/client/components/canvas/tokens"

/** スキルとアイテムを右のリボルバーで選ぶ。スキルは狙っている敵を押して放つ。アイテムは「使う」、ケイヤクは「変える」と「‹ もどる」。 */
type Props = {
  kind: "skill" | "item" | "pact"
  items: {
    key: string
    no: number
    unit: string
    name: string
    note: string
    locked?: boolean
  }[]
  selected: number
  onSelect: (index: number) => void
  onBack: () => void
  onPick: (key: string) => void
}

export function Picker(props: Props) {
  const wide = useWide()
  const fx = useFx()
  const unavailable =
    !props.items[props.selected] || !!props.items[props.selected].locked
  // 選ぶと親が menu を切り替え、AnimatePresence が板とリボルバーを外へ飛ばす
  const choose = (index: number) => {
    const item = props.items[index]
    if (!item || item.locked) return fx.shake(0.6)
    props.onPick(item.key)
  }
  return (
    <div className="ui-layer" style={{ ...UI_LAYER, zIndex: STAGE_LAYER.pick }}>
      <Revolver
        label={
          props.kind === "skill"
            ? "スキル"
            : props.kind === "pact"
              ? "ケイヤク"
              : "アイテム"
        }
        ownEnter
        items={props.items}
        selected={props.selected}
        onSelect={props.onSelect}
        onConfirm={choose}
        style={{ zIndex: 24 }}
      />
      {props.kind === "skill" ? null : (
        <Word
          text={props.kind === "pact" ? "変える" : "使う"}
          size={10}
          paper
          big
          tilt={-4}
          rotate={-6}
          delay={150}
          disabled={unavailable}
          style={{
            zIndex: 25,
            filter: unavailable ? "opacity(0.4)" : undefined,
            ...(wide
              ? { right: "5vw", bottom: "10%" }
              : { right: "4vw", bottom: "8%" }),
          }}
          onClick={() => choose(props.selected)}
        />
      )}
      <Word
        text="‹ もどる"
        size={wide ? 4.4 : 4.8}
        tilt={-4}
        rotate={3}
        from="left"
        delay={200}
        style={{
          zIndex: 25,
          ...(wide
            ? { left: "30vw", bottom: "14%" }
            : { left: "4vw", bottom: "12%" }),
        }}
        onClick={props.onBack}
      />
    </div>
  )
}
