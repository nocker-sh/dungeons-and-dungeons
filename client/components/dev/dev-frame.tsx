import { framePresentationSchema } from "@/development/studio/frame-presentation"
import { useRouter } from "@void/react"
import { Frame } from "@/client/components/dev/frame"

/** スタジオ・CLI が撮る一場面（/dev/frame/{scene}?config=）。 */
type Props = { scene: string }

export function DevFrame(props: Props) {
  const query = useRouter().query
  const config = query.get("config") ?? ""
  const presentation = framePresentationSchema.safeParse({
    mode: query.get("mode") ?? undefined,
    at: query.get("at") ?? undefined,
    guides: query.get("guides") ?? undefined,
  })
  if (!presentation.success)
    return <p role="alert">{presentation.error.message}</p>
  return (
    <Frame
      key={`${props.scene}:${config}`}
      scene={props.scene}
      json={config}
      at={presentation.data.at}
      guides={presentation.data.guides === "1"}
      mode={presentation.data.mode}
    />
  )
}
