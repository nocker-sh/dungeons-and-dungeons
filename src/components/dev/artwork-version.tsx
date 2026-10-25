import { createContext, useContext, useState, type ReactNode } from "react"

export type ArtworkVersion = "v0" | "v1"

const ArtworkVersionContext = createContext<{
  version: ArtworkVersion
  setVersion: (version: ArtworkVersion) => void
  columnCount: number | null
  setColumnCount: (columnCount: number) => void
}>({
  version: "v1",
  setVersion: () => {},
  columnCount: null,
  setColumnCount: () => {},
})

export function ArtworkVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState<ArtworkVersion>("v1")
  const [columnCount, setColumnCount] = useState<number | null>(null)
  return (
    <ArtworkVersionContext.Provider
      value={{ version, setVersion, columnCount, setColumnCount }}
    >
      {children}
    </ArtworkVersionContext.Provider>
  )
}

export function useArtworkVersion() {
  return useContext(ArtworkVersionContext)
}

/** 未生成のv1には、元画像を薄い参考表示として残す。 */
export function useArtworkReferenceStyle(image?: string | null) {
  const { version } = useArtworkVersion()
  return version === "v1" && image && !image.startsWith("/images/styles/v1/")
    ? { opacity: 0.35, filter: "saturate(0.35)" }
    : undefined
}

export function useArtworkGridColumns() {
  const { columnCount } = useArtworkVersion()
  return columnCount === null
    ? "repeat(auto-fit, minmax(min(100%, 320px), 1fr))"
    : `repeat(${columnCount}, minmax(0, 1fr))`
}
