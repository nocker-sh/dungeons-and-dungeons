import { useArtworkVersion } from "@/client/components/dev/use-artwork-version"

export function useArtworkGridColumns() {
  const { columnCount } = useArtworkVersion()
  return columnCount === null
    ? "repeat(auto-fit, minmax(min(100%, 320px), 1fr))"
    : `repeat(${columnCount}, minmax(0, 1fr))`
}
