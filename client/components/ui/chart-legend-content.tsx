import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "cn"
import { useChart } from "@/client/components/ui/use-chart"
import { getPayloadConfigFromPayload } from "@/client/components/ui/get-payload-config-from-payload"

type Props = React.ComponentProps<"div"> & {
  hideIcon?: boolean
  nameKey?: string
} & RechartsPrimitive.DefaultLegendContentProps

export function ChartLegendContent(props: Props) {
  const hideIcon = props.hideIcon === undefined ? false : props.hideIcon
  const verticalAlign =
    props.verticalAlign === undefined ? "bottom" : props.verticalAlign

  const { config } = useChart()

  if (!props.payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        props.className
      )}
    >
      {props.payload
        .filter((item) => item.type !== "none")
        .map((item, index) => {
          const key = String(props.nameKey ?? item.dataKey ?? "value")
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}
