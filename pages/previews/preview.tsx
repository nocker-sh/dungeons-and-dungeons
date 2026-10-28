import { useMemo } from "react"
import { GameApp } from "@/client/components/game/game-app"
import { previews } from "@/development/scenarios/index"
import { useSettle } from "@/pages/previews/use-settle"

export type Props = { slug: string; still: boolean }

export function Preview(props: Props) {
  const preview = useMemo(
    () => previews().find((entry) => entry.slug === props.slug),
    [props.slug]
  )
  const start = useMemo(() => preview?.start(), [preview])
  useSettle(props.still)
  if (!preview || !start)
    return <p style={{ padding: 24 }}>プレビュー {props.slug} はない</p>
  return <GameApp key={props.slug} preview={start} />
}
