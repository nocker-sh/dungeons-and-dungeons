import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"p">

export function EmptyDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        props.className
      )}
      {...restProps}
    />
  )
}
