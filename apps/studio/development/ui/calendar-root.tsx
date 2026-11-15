import type { RootProps } from "react-day-picker"
import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = RootProps

export function CalendarRoot(props: Props) {
  const restProps = omitProps(props, ["className", "rootRef"])

  return (
    <div
      data-slot="calendar"
      ref={props.rootRef}
      className={cn(props.className)}
      {...restProps}
    />
  )
}
