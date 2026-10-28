import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { getDefaultClassNames } from "react-day-picker"
import type { DayButton, Locale } from "react-day-picker"
import { Button } from "@/client/components/ui/button"

type Props = React.ComponentProps<typeof DayButton> & {
  locale?: Partial<Locale>
}

export function CalendarDayButton(props: Props) {
  const restProps = omitProps(props, [
    "className",
    "day",
    "modifiers",
    "locale",
  ])

  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (props.modifiers.focused) ref.current?.focus()
  }, [props.modifiers.focused])

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={props.day.date.toLocaleDateString(props.locale?.code)}
      data-selected-single={
        props.modifiers.selected &&
        !props.modifiers.range_start &&
        !props.modifiers.range_end &&
        !props.modifiers.range_middle
      }
      data-range-start={props.modifiers.range_start}
      data-range-end={props.modifiers.range_end}
      data-range-middle={props.modifiers.range_middle}
      className={cn(
        "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        props.className
      )}
      {...restProps}
    />
  )
}
