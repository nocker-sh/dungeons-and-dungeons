import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "cn"
import type { ChartConfig } from "@/client/components/ui/chart-shared"
import { ChartContext } from "@/client/components/ui/use-chart"
import { ChartStyle } from "@/client/components/ui/chart-style"

export const INITIAL_DIMENSION = { width: 320, height: 200 } as const

type Props = React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"]
  initialDimension?: {
    width: number
    height: number
  }
}

export function ChartContainer(props: Props) {
  const initialDimension =
    props.initialDimension === undefined
      ? INITIAL_DIMENSION
      : props.initialDimension
  const restProps = omitProps(props, [
    "id",
    "className",
    "children",
    "config",
    "initialDimension",
  ])

  const uniqueId = React.useId()
  const chartId = `chart-${props.id ?? uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config: props.config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          props.className
        )}
        {...restProps}
      >
        <ChartStyle id={chartId} config={props.config} />
        <RechartsPrimitive.ResponsiveContainer
          initialDimension={initialDimension}
        >
          {props.children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}
