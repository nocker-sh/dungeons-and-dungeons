import { createContext, useState } from "react"
import type { ReactNode } from "react"

export type ArtworkVersion = "v0" | "v1"

export const ArtworkVersionContext = createContext<{
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

export type Props = { children: ReactNode }

export function ArtworkVersionProvider(props: Props) {
  const [version, setVersion] = useState<ArtworkVersion>("v1")
  const [columnCount, setColumnCount] = useState<number | null>(null)
  return (
    <ArtworkVersionContext.Provider
      value={{ version, setVersion, columnCount, setColumnCount }}
    >
      {props.children}
    </ArtworkVersionContext.Provider>
  )
}
