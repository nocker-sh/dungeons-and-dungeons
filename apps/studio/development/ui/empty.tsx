import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function Empty(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="empty"
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance",
        props.className
      )}
      {...restProps}
    />
  )
}
