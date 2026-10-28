import { defineHandler, type InferProps } from "void"
import { devCategories } from "@/development/categories"

// 一覧の画面はブラウザの保存・画面の大きさを使うので、ブラウザだけで描く
export const ssr = false

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => {
  const category = c.req.param("category") ?? ""
  if (!devCategories.some((item) => item.value === category))
    return c.redirect("/dev/characters")
  return { category }
})
