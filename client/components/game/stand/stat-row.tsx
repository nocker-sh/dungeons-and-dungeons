import type { ReactNode } from "react"

/** ステータスの1行。項目どうしの間をあけて右へ並べ、入りきらなければ折り返す。 */
type Props = { children: ReactNode }

export function StatRow(props: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "baseline",
        gap: "0 calc(var(--u)*2.4)",
      }}
    >
      {props.children}
    </div>
  )
}
