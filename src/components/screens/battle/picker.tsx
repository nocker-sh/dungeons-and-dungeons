import { Revolver } from "@/components/stage/revolver"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { UI_LAYER, STAGE_LAYER } from "@/components/canvas/tokens"

/** スキルとアイテムを右のリボルバーで選ぶ。スキルは狙っている敵を押して放つ。アイテムは「使う」、ケイヤクは「変える」と「‹ もどる」。 */
export function Picker({
  kind,
  items,
  selected,
  onSelect,
  onBack,
  onPick,
}: {
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
}) {
  const wide = useWide()
  const fx = useFx()
  // 選ぶと親が menu を切り替え、AnimatePresence が板とリボルバーを外へ飛ばす
  const choose = (index: number) => {
    const item = items[index]
    if (!item || item.locked) return fx.shake(0.6)
    onPick(item.key)
  }
  return (
    <div className="ui-layer" style={{ ...UI_LAYER, zIndex: STAGE_LAYER.pick }}>
      <Revolver
        label={
          kind === "skill"
            ? "スキル"
            : kind === "pact"
              ? "ケイヤク"
              : "アイテム"
        }
        ownEnter
        items={items}
        selected={selected}
        onSelect={onSelect}
        onConfirm={choose}
        style={{ zIndex: 24 }}
      />
      {kind === "skill" ? null : (
        <Word
          text={kind === "pact" ? "変える" : "使う"}
          size={10}
          paper
          big
          tilt={-4}
          rotate={-6}
          delay={150}
          style={{
            zIndex: 25,
            ...(wide
              ? { right: "5vw", bottom: "10%" }
              : { right: "4vw", bottom: "8%" }),
          }}
          onClick={() => choose(selected)}
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
        onClick={onBack}
      />
    </div>
  )
}
