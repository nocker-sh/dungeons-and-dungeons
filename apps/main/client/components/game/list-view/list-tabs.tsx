import { COLOR } from "@/client/components/stage/kit"
import { TornPlate } from "@/client/components/canvas/torn-plate"
import type { Tab } from "@/client/components/game/list-view/types"
import { TabButton } from "@/client/components/game/list-view/tab-button"

/** 一覧のタブ選択だけを表示する。選択行の更新は親に通知する。 */
type Props = {
  tabs: readonly Tab[]
  tab: number
  wide: boolean
  kind?: string
  onSelect: (name: string) => void
}

export function ListTabs(props: Props) {
  return (
    <>
      {" "}
      {props.tabs.length > 1 ? (
        <div
          style={{
            position: "absolute",
            ...(props.wide
              ? {
                  left: "6%",
                  top: props.kind === "demon-contracts" ? "20%" : "23%",
                }
              : { left: "5%", top: "15%" }),
            display: "flex",
            gap: "calc(var(--u)*1.2)",
            pointerEvents: "auto",
          }}
        >
          {props.tabs.map((entry, i) => (
            <TabButton
              key={entry.name}
              on={i === props.tab}
              onClick={() => {
                props.onSelect(entry.name)
              }}
              style={{
                position: "relative",
                padding: ".15em .8em",
                fontSize: `calc(var(--u)*${props.wide ? 3 : 3.4})`,
                color: i === props.tab ? COLOR.ink : COLOR.paper,
              }}
            >
              <TornPlate
                background={i === props.tab ? COLOR.paper : COLOR.ink}
                clip="polygon(6% 0, 100% 8%, 94% 100%, 0 90%)"
                style={{
                  outline: `2px solid ${COLOR.paper}`,
                  outlineOffset: -2,
                }}
              />
              <span style={{ position: "relative" }}>{entry.name}</span>
            </TabButton>
          ))}
        </div>
      ) : null}
    </>
  )
}
