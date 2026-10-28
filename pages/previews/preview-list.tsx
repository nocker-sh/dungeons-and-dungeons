import { Link } from "@void/react"
import { previews } from "@/development/scenarios/index"

/** 見た目の確認用の場面の一覧。 */
export default function PreviewList() {
  return (
    <main style={{ padding: "24px", fontFamily: "system-ui", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>プレビュー</h1>
      <p style={{ opacity: 0.7 }}>
        場面を直接開く。本物の保存には触れない。?still
        を付けると繰り返しの動きも止める。
      </p>
      <ul>
        {previews().map((preview) => (
          <li key={preview.slug}>
            <Link href={`/previews/${preview.slug}`}>{preview.slug}</Link> —{" "}
            {preview.title}
          </li>
        ))}
      </ul>
    </main>
  )
}
