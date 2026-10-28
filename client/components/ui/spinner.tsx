import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

type Props = React.ComponentProps<"svg">

export function Spinner(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", props.className)}
      {...restProps}
    />
  )
}
