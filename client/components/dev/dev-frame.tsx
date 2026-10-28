import { useRouter } from "@void/react"
import { Frame } from "@/client/components/dev/frame"

/** スタジオ・CLI が撮る一場面（/dev/frame/{scene}?config=）。 */
type Props = { scene: string }

export function DevFrame(props: Props) {
  const config = useRouter().query.get("config") ?? ""
  return (
    <Frame key={`${props.scene}:${config}`} scene={props.scene} json={config} />
  )
}
