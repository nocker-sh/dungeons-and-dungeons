import { artworkReferenceStyle } from "@/development/components/artwork-reference-style"
import { useArtworkVersion } from "@/development/components/use-artwork-version"

export function useArtworkReferenceStyle(image?: string | null) {
  return artworkReferenceStyle(image, useArtworkVersion().version)
}
