import { useParams, useRouter } from "@void/react"
import { Preview } from "@/pages/previews/preview"

/**
 * 一つの場面を直接開く（/previews/{slug}）。ゲームと同じ時間で再生する。
 * ?still で繰り返しの動きも止める（見比べ・撮影用）。画面の大きさはブラウザで変える。
 */
export default function PreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const still = useRouter().query.get("still")
  return <Preview slug={slug} still={still !== null && still !== "0"} />
}
