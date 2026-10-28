import { omitProps } from "@/client/utils/omit-props"
import * as ResizablePrimitive from "react-resizable-panels"
import { cn } from "cn"

type Props = ResizablePrimitive.GroupProps

export function ResizablePanelGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        props.className
      )}
      {...restProps}
    />
  )
}
