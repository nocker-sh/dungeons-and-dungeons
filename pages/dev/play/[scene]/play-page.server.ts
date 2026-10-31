import { defineHandler, type InferProps } from "void"
import { getPreviewPage } from "@/development/studio/get-preview-page"

export const ssr = false
export type Props = InferProps<typeof loader>
export const loader = defineHandler((context) =>
  getPreviewPage(
    new URL(context.req.url).searchParams,
    context.req.param("scene") ?? "battle"
  )
)
