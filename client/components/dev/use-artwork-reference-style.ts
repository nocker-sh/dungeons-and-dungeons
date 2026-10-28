import { artworkReferenceStyle } from "@/client/components/dev/artwork-reference-style"
import { useArtworkVersion } from "@/client/components/dev/use-artwork-version"

export function useArtworkReferenceStyle(image?: string | null) {
  return artworkReferenceStyle(image, useArtworkVersion().version)
}
