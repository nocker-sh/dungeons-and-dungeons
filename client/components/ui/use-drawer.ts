import * as React from "react"
import { DrawerContext } from "@/client/components/ui/drawer-shared"

export function useDrawer() {
  const context = React.useContext(DrawerContext)

  if (!context) {
    throw new Error("useDrawer must be used within a Drawer.")
  }

  return context
}
