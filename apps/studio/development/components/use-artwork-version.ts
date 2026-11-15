import { useContext } from "react"
import { ArtworkVersionContext } from "@/development/components/artwork-version-provider"

export function useArtworkVersion() {
  return useContext(ArtworkVersionContext)
}
