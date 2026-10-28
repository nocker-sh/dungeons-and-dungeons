import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "cn"
import type { TooltipValueType } from "recharts"
import { useChart } from "@/client/components/ui/use-chart"
import { getPayloadConfigFromPayload } from "@/client/components/ui/get-payload-config-from-payload"

export type TooltipNameType = number | string

type Props = React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
  } & Omit<
    RechartsPrimitive.DefaultTooltipContentProps<
      TooltipValueType,
      TooltipNameType
    >,
    "accessibilityLayer"
  >

export function ChartTooltipContent(props: Props) {
  const indicator = props.indicator === undefined ? "dot" : props.indicator
  const hideLabel = props.hideLabel === undefined ? false : props.hideLabel
  const hideIndicator =
    props.hideIndicator === undefined ? false : props.hideIndicator

  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !props.payload?.length) {
      return null
    }

    const [item] = props.payload
    const key = String(props.labelKey ?? item?.dataKey ?? item?.name ?? "value")
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !props.labelKey && typeof props.label === "string"
        ? (config[props.label]?.label ?? props.label)
        : itemConfig?.label

    if (props.labelFormatter) {
      return (
        <div className={cn("font-medium", props.labelClassName)}>
          {props.labelFormatter(value, props.payload)}
        </div>
      )
    }

    if (!value) {
      return null
    }

    return (
      <div className={cn("font-medium", props.labelClassName)}>{value}</div>
    )
  }, [
    props.label,
    props.labelFormatter,
    props.payload,
    hideLabel,
    props.labelClassName,
    config,
    props.labelKey,
  ])

  if (!props.active || !props.payload?.length) {
    return null
  }

  const nestLabel = props.payload.length === 1 && indicator !== "dot"

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        props.className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {props.payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const key = String(
              props.nameKey ?? item.name ?? item.dataKey ?? "value"
            )
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor =
              props.color ?? item.payload?.fill ?? item.color

            return (
              <div
                key={index}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {props.formatter && item?.value !== undefined && item.name ? (
                  props.formatter(
                    item.value,
                    item.name,
                    item,
                    index,
                    item.payload
                  )
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                            {
                              "h-2.5 w-2.5": indicator === "dot",
                              "w-1": indicator === "line",
                              "w-0 border-[1.5px] border-dashed bg-transparent":
                                indicator === "dashed",
                              "my-0.5": nestLabel && indicator === "dashed",
                            }
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label ?? item.name}
                        </span>
                      </div>
                      {item.value != null && (
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {typeof item.value === "number"
                            ? item.value.toLocaleString()
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
