import { useContext } from "react"
import { ArtworkVersionContext } from "@/client/components/dev/artwork-version-provider"

export function useArtworkVersion() {
  return useContext(ArtworkVersionContext)
}
