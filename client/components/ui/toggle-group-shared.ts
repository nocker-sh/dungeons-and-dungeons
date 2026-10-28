"use client"

import * as React from "react"
import type { VariantProps } from "class-variance-authority"
import { toggleVariants } from "@/client/components/ui/toggle-variants"

export const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
})
