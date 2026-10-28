import type { ArtworkVersion } from "@/client/components/dev/artwork-version-provider"

/** 未生成のv1には、元画像を薄い参考表示として残す。 */
export function artworkReferenceStyle(
  image: string | null | undefined,
  version: ArtworkVersion
) {
  return version === "v1" && image && !image.includes("/v1/")
    ? { opacity: 0.35, filter: "saturate(0.35)" }
    : undefined
}
