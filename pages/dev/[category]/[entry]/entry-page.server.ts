import { defineHandler, type InferProps } from "void"
import { gameContent } from "@/content/game-content"
import {
  devCategories,
  devGroups,
  type DevDataCategory,
} from "@/development/categories"
import effects from "@/concept/data/effects.json"
import entryAliases from "@/concept/data/entry-aliases.json"
import { devConceptEntries } from "@/development/concept-entries"
import playerAppearances from "@/concept/data/players.json"
import {
  goodsCatalog,
  goodKindsByCategory,
  isGoodsCategory,
  type GoodsDevCategory,
} from "@/development/goods"

export const ssr = false

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => {
  const category = c.req.param("category") ?? ""
  const entry = c.req.param("entry") ?? ""
  // shortcut: Void 1.1.11 は動的なページ同士を文字列順に並べ、/dev/studio/{scene} もここに当たるので、ここで受ける。順序が直ったら pages/dev/studio に戻す
  if (category === "studio" || category === "frame") return { category, entry }
  if (!devCategories.some((item) => item.value === category))
    return c.redirect("/dev/characters")
  const aliases: Record<string, Record<string, string>> = entryAliases
  const canonicalEntry = aliases[category]?.[entry]
  if (canonicalEntry) return c.redirect(`/dev/${category}/${canonicalEntry}`)
  const exists =
    category === "conversations"
      ? gameContent.conversations?.some(
          (conversation) => conversation.id === entry
        )
      : category === "effects"
        ? effects.some((effect) => effect.id === entry)
        : category === "player"
          ? playerAppearances.some((item) => item.slug === entry)
          : isGoodsCategory(category)
            ? goodsCatalog.some(
                (item) =>
                  item.kind === goodKindsByCategory[category] &&
                  item.slug === entry
              )
            : devGroups[
                category as Exclude<
                  DevDataCategory,
                  "player" | GoodsDevCategory
                >
              ]?.some((group) =>
                devConceptEntries.some(
                  (item) => item.category === group && item.slug === entry
                )
              )
  if (!exists) return c.redirect(`/dev/${category}`)
  return { category, entry }
})
