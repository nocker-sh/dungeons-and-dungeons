import {
  useArtworkVersion,
  useArtworkGridColumns,
  useArtworkReferenceStyle,
} from "./artwork-version"
import type { ConceptCharacter } from "@/lib/concept/characters"
import conversationProfiles from "@/lib/concept/data/conversation-profiles.json"
import skillData from "@/lib/content/data/skills.json"
import foeData from "@/lib/content/data/foes.json"
import {
  portraitStates,
  type PortraitState,
} from "@/lib/concept/portrait-types"
import { Card, CardContent } from "@/components/ui/card"
import { devConceptEntries } from "@/lib/dev/concept-entries"
import { dialogues } from "@/lib/concept/dialogues"
import { playerAppearances } from "@/lib/concept/players"
import { growthMemberOf, heroGrowthMember } from "@/lib/dev/growth"
import { GrowthSection } from "./growth-page"
import { DevDataLayout } from "./data-layout"
import type { DevDataCategory } from "@/lib/dev/categories"
import { GoodDetails } from "./good-details"
import { OutfitPreview } from "./outfit-preview"
import {
  goodsCatalog,
  goodKindsByCategory,
  isGoodsCategory,
  type GoodsDevCategory,
} from "@/lib/dev/goods"

export const devGroups: Record<
  Exclude<DevDataCategory, "player" | GoodsDevCategory>,
  string[]
> = {
  characters: ["キャラの一覧", "募集の仲間"],
  residents: ["街の住人"],
  demons: ["契約する悪魔"],
  backgrounds: ["場所"],
  monsters: ["敵"],
}

type Props = {
  category: DevDataCategory
  selectedSlug?: string
  onEntryChange: (slug: string) => void
}
export function DevWorkspace(props: Props) {
  return <Workspace {...props} />
}

function Workspace({ category, selectedSlug, onEntryChange }: Props) {
  const { version } = useArtworkVersion()
  const gridColumns = useArtworkGridColumns()
  const entries =
    category === "player" || isGoodsCategory(category)
      ? []
      : devConceptEntries.filter((entry) =>
          devGroups[category].includes(entry.category)
        )
  const selected =
    entries.find((entry) => entry.slug === selectedSlug) ??
    (category === "monsters"
      ? entries.find((entry) => entry.section === "スライム")
      : undefined) ??
    entries[0]
  const appearance =
    playerAppearances.find((item) => item.slug === selectedSlug) ??
    playerAppearances[0]
  const selectedReferenceStyle = useArtworkReferenceStyle(selected?.image)
  const appearanceReferenceStyle = useArtworkReferenceStyle(appearance.image)
  const goods = isGoodsCategory(category)
    ? goodsCatalog.filter((good) => good.kind === goodKindsByCategory[category])
    : []
  const selectedGood =
    goods.find((good) => good.slug === selectedSlug) ?? goods[0]
  const menuEntries =
    category === "player"
      ? playerAppearances
      : isGoodsCategory(category)
        ? goods
        : entries
  const activeId =
    category === "player" ? appearance.id : (selectedGood?.id ?? selected?.id)
  const selectedGrowth =
    category === "characters" ? growthMemberOf(selected?.id) : undefined
  const menuSections =
    category === "weapons"
      ? ["両手剣", "片手剣", "斧", "魔法銃", "短剣"].map((label) => ({
          label,
          entries: goods.filter((good) => good.weapon?.typeName === label),
        }))
      : category === "backgrounds"
        ? ["ダンジョン", "街"].map((label) => ({
            label,
            entries: entries.filter((entry) => entry.section === label),
          }))
        : category === "characters"
          ? ["N", "R", "SR"].map((label) => ({
              label,
              entries: entries.filter((entry) => entry.rarity === label),
            }))
          : category === "demons"
            ? [{ label: "契約する悪魔", entries }]
            : category === "monsters"
              ? [
                  "スライム",
                  "ミミック",
                  "キャンドラ",
                  "トード",
                  "ウォール",
                  "スクラップアイ",
                  "レイス",
                  "ヴルム",
                  "ホーク",
                  "パロット",
                  "ダック",
                  "コルンバ",
                  "カリクス",
                  "ナッツハイド",
                  "パッチクローク",
                  "スプラウト",
                  "ククルス",
                  "アクアサウル",
                  "サバト",
                  "ジェムホッグ",
                  "スネイル",
                  "その他",
                ].map((label) => ({
                  label,
                  entries: entries.filter(
                    (entry) => (entry.section ?? "その他") === label
                  ),
                }))
              : [{ label: "", entries: menuEntries }]

  return (
    <DevDataLayout
      category={category}
      sections={menuSections}
      activeId={activeId}
      onEntryChange={onEntryChange}
    >
      {category === "player" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              gap: 24,
            }}
          >
            <figure>
              <Card className="p-0">
                <img
                  src={appearance.image}
                  alt={appearance.name}
                  style={{
                    width: "100%",
                    aspectRatio: "3 / 4",
                    objectFit: "contain",
                    ...appearanceReferenceStyle,
                  }}
                />
              </Card>
              <figcaption>{appearance.name}</figcaption>
            </figure>
          </div>
          {heroGrowthMember && (
            <OutfitPreview member={heroGrowthMember.id} look={appearance.id} />
          )}
          {heroGrowthMember && <GrowthSection member={heroGrowthMember} />}
        </>
      ) : selectedGood ? (
        <GoodDetails good={selectedGood} />
      ) : (
        selected && (
          <article>
            <header style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600 }}>{selected.name}</h1>
              {selected.title && <p>{selected.title}</p>}
            </header>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  category === "backgrounds" ? "1fr" : gridColumns,
                gap: 24,
                alignItems: "start",
              }}
            >
              {category === "monsters" ? (
                <>
                  <PortraitFigure
                    name={selected.name}
                    label="通常"
                    image={selected.image}
                  />
                  <PortraitFigure
                    name={selected.name}
                    label={`通常攻撃：${selected.attack?.name ?? "攻撃"}（${selected.attack?.reach === "ranged" ? "遠距離" : "近接"}）`}
                    image={selected.attackImage ?? selected.attackImages?.[0]}
                  />
                  {foeData
                    .find((foe) => foe.id === selected.id.split(":")[0])
                    ?.skills?.map((skillId) => {
                      const skill = skillData.find(
                        (entry) => entry.id === skillId
                      )
                      return (
                        <PortraitFigure
                          key={skillId}
                          name={selected.name}
                          label={`${selected.skillNames?.[skillId] ?? skill?.name ?? "ワザ"}（${skill?.reach === "ranged" ? "遠距離" : "近接"}）`}
                          image={selected.skillPortraits?.[skillId]}
                        />
                      )
                    })}
                  <PortraitFigure
                    name={selected.name}
                    label="戦闘不能"
                    image={selected.defeatedImage}
                  />
                  <PortraitFigure
                    name={selected.name}
                    label="睡眠"
                    image={selected.sleepingImage}
                  />
                </>
              ) : selected.portraits ? (
                category === "characters" || category === "demons" ? (
                  <>
                    {selected.contractModes?.length ? (
                      <section
                        aria-label="ケイヤク"
                        style={{ gridColumn: "1 / -1" }}
                      >
                        <h2>ケイヤク</h2>
                        <p>モードが増えると、戦い方の選択肢が広がります。</p>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: gridColumns,
                            gap: 24,
                          }}
                        >
                          {selected.contractModes.map((mode) => (
                            <div key={mode.weapon}>
                              <PortraitFigure
                                name={selected.name}
                                label={`${mode.name}（Lv${mode.level}で解放・戦闘通常）`}
                                image={mode.battlePortrait}
                              />
                              {!mode.bargain ? <p>{mode.description}</p> : null}
                              {mode.bargain ? (
                                <dl style={{ marginTop: 8 }}>
                                  <dt>契約相手</dt>
                                  <dd>{mode.bargain.partner}</dd>
                                  <dt>借りる力</dt>
                                  <dd>{mode.bargain.borrow}</dd>
                                  <dt>渡すもの</dt>
                                  <dd>{mode.bargain.price}</dd>
                                </dl>
                              ) : null}
                              <p>
                                {mode.roles?.join("・")}：{mode.combatStyle}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    <PortraitSection
                      key={selected.id}
                      title="上半身"
                      versioned={
                        category === "characters" || category === "demons"
                      }
                      versions={selected.bustPortraitVersions}
                      name={selected.name}
                      states={portraitStates.filter(
                        (portrait) =>
                          portrait.value !== "skill" &&
                          portrait.value !== "special"
                      )}
                      images={selected.bustPortraits}
                      rearImage={selected.battleRearPortrait}
                    />
                    {category === "demons" ? (
                      <>
                        <PortraitFigure
                          name={selected.name}
                          label="全身（保存版）"
                          image={selected.portraits.normal}
                        />
                        {Object.entries(selected.skillPortraits ?? {}).map(
                          ([skill, image]) => (
                            <PortraitFigure
                              key={skill}
                              name={selected.name}
                              label={
                                skillData.find((entry) => entry.id === skill)
                                  ?.name ?? "ワザ"
                              }
                              image={image}
                            />
                          )
                        )}
                      </>
                    ) : (
                      <>
                        <OutfitPreview
                          member={selected.id}
                          look={selected.id}
                        />
                      </>
                    )}
                  </>
                ) : (
                  portraitStates
                    .filter((portrait) =>
                      category === "residents"
                        ? portrait.value !== "skill" &&
                          (portrait.value !== "special" ||
                            Boolean(selected.portraits?.special))
                        : portrait.value !== "special"
                    )
                    .map((portrait) => (
                      <PortraitFigure
                        key={portrait.value}
                        name={selected.name}
                        label={
                          portrait.value === "special" && selected.specialMotion
                            ? `${portrait.label}（${selected.specialMotion}）`
                            : portrait.label
                        }
                        image={
                          (version === "v1" && portrait.value !== "skill"
                            ? selected.bustPortraitVersions?.find(
                                (entry) => entry.version === "v1"
                              )?.portraits[portrait.value]
                            : undefined) ?? selected.portraits?.[portrait.value]
                        }
                      />
                    ))
                )
              ) : (
                selected.image && (
                  <figure>
                    <Card className="p-0">
                      <img
                        key={selected.id}
                        src={selected.image}
                        alt={selected.name}
                        style={{
                          width: "100%",
                          ...(category === "backgrounds"
                            ? {}
                            : { aspectRatio: "3 / 4" }),
                          objectFit: "contain",
                          ...selectedReferenceStyle,
                        }}
                      />
                    </Card>
                  </figure>
                )
              )}
              {selected.costumePortraits?.flatMap((costume) => [
                <PortraitFigure
                  key={costume.slug}
                  name={selected.name}
                  label={
                    costume.portraits ? `${costume.name}・通常` : costume.name
                  }
                  image={costume.image}
                />,
                ...portraitStates.flatMap(({ value, label }) => {
                  const image =
                    value !== "normal" && value !== "skill"
                      ? costume.portraits?.[value]
                      : undefined
                  return image
                    ? [
                        <PortraitFigure
                          key={`${costume.slug}-${value}`}
                          name={selected.name}
                          label={`${costume.name}・${label}`}
                          image={image}
                        />,
                      ]
                    : []
                }),
              ])}
              {[
                ["戦闘（縦）", selected.battleImage],
                ["戦闘（横）", selected.battleWideImage],
              ].map(([label, image]) =>
                image ? (
                  <figure key={label}>
                    <Card className="p-0">
                      <img
                        src={image}
                        alt={`${selected.name}・${label}`}
                        style={{
                          width: "100%",
                          maxHeight: "80vh",
                          objectFit: "contain",
                        }}
                      />
                    </Card>
                    <figcaption>{label}</figcaption>
                  </figure>
                ) : null
              )}
              {conversationProfiles
                .filter((entry) => entry.id === selected.id)
                .map((profile) => (
                  <Card key={profile.id}>
                    <CardContent style={{ display: "grid", gap: 12 }}>
                      <h2>会話の個性・背景（制作案）</h2>
                      <p>話し方：{profile.voice}</p>
                      <p>個性：{profile.personality}</p>
                      <p>背景：{profile.background}</p>
                      <p>{profile.backgroundStatus}</p>
                      <a href="/dev/conversations">台本・条件を調整する</a>
                    </CardContent>
                  </Card>
                ))}
              <div style={{ display: "grid", gap: 24 }}>
                {(selected.introduction ||
                  selected.weapon ||
                  selected.shield ||
                  selected.equipmentChangeable === false ||
                  dialogues.some(
                    (dialogue) => dialogue.speakerId === selected.id
                  )) && (
                  <Card>
                    <CardContent>
                      {selected.introduction && <p>{selected.introduction}</p>}
                      {selected.weapon && <p>武器：{selected.weapon}</p>}
                      {selected.shield && <p>盾：{selected.shield}</p>}
                      {selected.equipmentChangeable === false && (
                        <p>装備変更不可</p>
                      )}

                      {dialogues
                        .filter(
                          (dialogue) => dialogue.speakerId === selected.id
                        )
                        .map((dialogue) => (
                          <blockquote
                            key={dialogue.id}
                            style={{ marginTop: 16 }}
                          >
                            「{dialogue.text}」
                          </blockquote>
                        ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            {selectedGrowth && <GrowthSection member={selectedGrowth} />}
          </article>
        )
      )}
    </DevDataLayout>
  )
}

function PortraitSection({
  title,
  name,
  states,
  images,
  versions,
  versioned,
  rearImage,
}: {
  title: string
  name: string
  states: readonly { value: PortraitState; label: string }[]
  images?: Partial<Record<PortraitState, string | null>>
  versions?: ConceptCharacter["bustPortraitVersions"]
  versioned: boolean
  rearImage?: string | null
}) {
  const { version } = useArtworkVersion()
  const gridColumns = useArtworkGridColumns()
  const displayedImages:
    | Partial<Record<PortraitState, string | null>>
    | undefined =
    !versioned || version === "v0"
      ? images
      : {
          ...images,
          ...versions?.find((entry) => entry.version === version)?.portraits,
        }
  return (
    <section style={{ gridColumn: "1 / -1" }} aria-label={`${title}立ち絵`}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        {title}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: 24,
        }}
      >
        {rearImage ? (
          <PortraitFigure
            name={name}
            label="後ろ姿（敵の方を向く）"
            image={rearImage}
          />
        ) : null}
        {states.map((state) => (
          <PortraitFigure
            key={state.value}
            name={name}
            label={state.value === "talk" ? "会話" : state.label}
            image={displayedImages?.[state.value]}
          />
        ))}
      </div>
    </section>
  )
}

function PortraitFigure({
  name,
  label,
  image,
}: {
  name: string
  label: string
  image?: string | null
}) {
  const referenceStyle = useArtworkReferenceStyle(image)
  return (
    <figure>
      <Card className="p-0">
        <div
          style={{ aspectRatio: "3 / 4" }}
          aria-label={`${name}・${label}${image ? "" : "（未登録）"}`}
        >
          {image ? (
            <img
              src={image}
              alt={`${name}・${label}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                ...referenceStyle,
              }}
            />
          ) : (
            <span style={{ display: "block", padding: 16 }}>未登録</span>
          )}
        </div>
      </Card>
      <figcaption style={{ marginTop: 8 }}>{label}</figcaption>
    </figure>
  )
}
