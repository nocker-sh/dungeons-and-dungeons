import { Card } from "@/client/components/ui/card"
import { CardContent } from "@/client/components/ui/card-content"
import type { CatalogGood } from "@/development/goods"
import { EquipmentCharacters } from "@/client/components/dev/equipment-characters"
import { useArtworkVersion } from "@/client/components/dev/use-artwork-version"
import { useArtworkGridColumns } from "@/client/components/dev/use-artwork-grid-columns"
import { useArtworkReferenceStyle } from "@/client/components/dev/use-artwork-reference-style"

/** 人物・モンスターと同じワークスペース内に品物の詳細を表示する。 */
type Props = { good: CatalogGood }

export function GoodDetails(props: Props) {
  const { version } = useArtworkVersion()
  const gridColumns = useArtworkGridColumns()
  const image =
    version === "v0"
      ? props.good.image
      : (props.good.imageVersions.v1 ?? props.good.image)
  const referenceStyle = useArtworkReferenceStyle(image)
  return (
    <article>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>{props.good.name}</h1>
        <p>
          {(props.good.slug.startsWith("pact-")
            ? `契約の力（${props.good.weapon?.typeName ?? "固有装備"}型）`
            : props.good.weapon?.typeName) ??
            { armor: "防具", item: "道具", material: "素材", weapon: "武器" }[
              props.good.kind
            ]}
          {props.good.exclusive ? "・鑑定限定" : ""}
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
              aria-label={`${props.good.name}${image ? "" : "（未登録）"}`}
            >
              {image ? (
                <a
                  href={image}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${props.good.name}の画像を開く`}
                >
                  <img
                    key={props.good.id}
                    src={image}
                    alt={props.good.name}
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
              <p>{props.good.stat}</p>
              <p style={{ marginTop: 12 }}>{props.good.desc}</p>
              {props.good.kind === "armor" && (
                <p style={{ marginTop: 12 }}>
                  装備できる職業：
                  {props.good.allowedJobs?.join("・") ?? "すべて"}
                </p>
              )}
              {props.good.usage && (
                <p style={{ marginTop: 12 }}>{props.good.usage}</p>
              )}
            </CardContent>
          </Card>
          {props.good.weapon && (
            <Card>
              <CardContent>
                <h2 style={{ fontWeight: 600, marginBottom: 12 }}>ワザ</h2>
                <ul style={{ display: "grid", gap: 16 }}>
                  {props.good.weapon.skills.map((skill, index) => (
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
              {props.good.sources.map((source) => (
                <p key={source}>{source}</p>
              ))}
              <p style={{ marginTop: 12 }}>
                {props.good.price !== null
                  ? `買値 ${props.good.price}G ／ `
                  : ""}
                売値 {props.good.sell}G
              </p>
            </CardContent>
          </Card>
          {(props.good.upgradeMaterial ||
            props.good.materialUses.length > 0) && (
            <Card>
              <CardContent>
                <h2 style={{ fontWeight: 600, marginBottom: 12 }}>
                  素材の用途
                </h2>
                {props.good.upgradeMaterial && <p>装備の強化</p>}
                {props.good.materialUses.map((name) => (
                  <p key={name}>{name}の生産</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <EquipmentCharacters good={props.good} />
    </article>
  )
}
