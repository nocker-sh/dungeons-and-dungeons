import type { ChevronProps } from "react-day-picker"
import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "lucide-react"

type Props = ChevronProps

export function CalendarChevron(props: Props) {
  const restProps = omitProps(props, ["className", "orientation"])

  if (props.orientation === "left") {
    return (
      <ChevronLeftIcon
        className={cn("size-4", props.className)}
        {...restProps}
      />
    )
  }

  if (props.orientation === "right") {
    return (
      <ChevronRightIcon
        className={cn("size-4", props.className)}
        {...restProps}
      />
    )
  }

  return (
    <ChevronDownIcon className={cn("size-4", props.className)} {...restProps} />
  )
}
