import { Card, CardContent } from "@/components/ui/card"
import type { CatalogGood } from "@/lib/dev/goods"
import { EquipmentCharacters } from "./outfit-preview"
import {
  useArtworkVersion,
  useArtworkGridColumns,
  useArtworkReferenceStyle,
} from "./artwork-version"

/** 人物・モンスターと同じワークスペース内に品物の詳細を表示する。 */
export function GoodDetails({ good }: { good: CatalogGood }) {
  const { version } = useArtworkVersion()
  const gridColumns = useArtworkGridColumns()
  const image =
    version === "v0" ? good.image : (good.imageVersions.v1 ?? good.image)
  const referenceStyle = useArtworkReferenceStyle(image)
  return (
    <article>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>{good.name}</h1>
        <p>
          {good.weapon?.typeName ??
            { armor: "防具", item: "道具", material: "素材", weapon: "武器" }[
              good.kind
            ]}
          {good.exclusive ? "・鑑定限定" : ""}
        </p>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: 24,
          alignItems: "start",
        }}
      >
        <figure>
          <Card className="p-0">
            <div
              style={{ aspectRatio: "1 / 1" }}
              aria-label={`${good.name}${image ? "" : "（未登録）"}`}
            >
              {image ? (
                <a
                  href={image}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${good.name}の画像を開く`}
                >
                  <img
                    key={good.id}
                    src={image}
                    alt={good.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      ...referenceStyle,
                    }}
                  />
                </a>
              ) : (
                <span style={{ display: "block", padding: 16 }}>未登録</span>
              )}
            </div>
          </Card>
        </figure>
        <div style={{ display: "grid", gap: 24 }}>
          <Card>
            <CardContent>
              <h2 style={{ fontWeight: 600, marginBottom: 12 }}>性能</h2>
              <p>{good.stat}</p>
              <p style={{ marginTop: 12 }}>{good.desc}</p>
              {good.kind === "armor" && (
                <p style={{ marginTop: 12 }}>
                  装備できる職業：{good.allowedJobs?.join("・") ?? "すべて"}
                </p>
              )}
              {good.usage && <p style={{ marginTop: 12 }}>{good.usage}</p>}
            </CardContent>
          </Card>
          {good.weapon && (
            <Card>
              <CardContent>
                <h2 style={{ fontWeight: 600, marginBottom: 12 }}>ワザ</h2>
                <ul style={{ display: "grid", gap: 16 }}>
                  {good.weapon.skills.map((skill, index) => (
                    <li key={skill.id}>
                      <p>
                        {skill.name}・{skill.uses}回{" "}
                        <span className="text-muted-foreground">
                          （{index < 2 ? "固定" : "個体によって変化"}）
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {skill.desc}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent>
              <h2 style={{ fontWeight: 600, marginBottom: 12 }}>
                入手先・価格
              </h2>
              {good.sources.map((source) => (
                <p key={source}>{source}</p>
              ))}
              <p style={{ marginTop: 12 }}>
                {good.price !== null ? `買値 ${good.price}G ／ ` : ""}売値{" "}
                {good.sell}G
              </p>
            </CardContent>
          </Card>
          {(good.upgradeMaterial || good.materialUses.length > 0) && (
            <Card>
              <CardContent>
                <h2 style={{ fontWeight: 600, marginBottom: 12 }}>
                  素材の用途
                </h2>
                {good.upgradeMaterial && <p>装備の強化</p>}
                {good.materialUses.map((name) => (
                  <p key={name}>{name}の生産</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <EquipmentCharacters good={good} />
    </article>
  )
}
