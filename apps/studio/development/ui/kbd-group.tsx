import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function KbdGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", props.className)}
      {...restProps}
    />
  )
}
