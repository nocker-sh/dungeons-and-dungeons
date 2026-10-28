import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function EmptyContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance",
        props.className
      )}
      {...restProps}
    />
  )
}
