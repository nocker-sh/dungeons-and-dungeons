import { defineHandler, type InferProps } from "void"
import { getPreviewCatalog } from "@/development/studio/get-preview-catalog"
import { getPreviewPage } from "@/development/studio/get-preview-page"

export const ssr = false
export type Props = InferProps<typeof loader>
export const loader = defineHandler((context) => {
  const query = new URL(context.req.url).searchParams
  if (query.get("catalog") === "1" && query.size === 1)
    return { catalog: getPreviewCatalog(), request: null, error: null }
  return { catalog: null, ...getPreviewPage(query, null) }
})
