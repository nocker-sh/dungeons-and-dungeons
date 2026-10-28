import { omitProps } from "@/client/utils/omit-props"
import * as ResizablePrimitive from "react-resizable-panels"

type Props = ResizablePrimitive.PanelProps

export function ResizablePanel(props: Props) {
  const restProps = omitProps(props, [])

  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...restProps} />
}
