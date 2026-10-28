import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { ContextMenuContent } from "@/client/components/ui/context-menu-content"

type Props = React.ComponentProps<typeof ContextMenuContent>

export function ContextMenuSubContent(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <ContextMenuContent
      data-slot="context-menu-sub-content"
      className="shadow-lg"
      side="right"
      {...restProps}
    />
  )
}
