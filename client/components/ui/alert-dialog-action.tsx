import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"

type Props = React.ComponentProps<typeof Button>

export function AlertDialogAction(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn(props.className)}
      {...restProps}
    />
  )
}
