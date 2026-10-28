import type { WeekNumberProps } from "react-day-picker"
import { omitProps } from "@/client/utils/omit-props"

type Props = WeekNumberProps

export function CalendarWeekNumber(props: Props) {
  const restProps = omitProps(props, ["children"])

  return (
    <td {...restProps}>
      <div className="flex size-(--cell-size) items-center justify-center text-center">
        {props.children}
      </div>
    </td>
  )
}
