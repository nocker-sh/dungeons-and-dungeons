import { useRouter } from "@void/react"
import { DevFrame } from "@/client/components/dev/dev-frame"

/** 一覧や条件編集を読み込まず、単一の実ゲームだけを起動する。 */
export default function PreviewFramePage() {
  const scene = useRouter().query.get("scene") ?? "battle"
  return <DevFrame scene={scene} />
}
