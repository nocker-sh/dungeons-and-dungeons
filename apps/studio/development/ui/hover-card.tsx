import { omitProps } from "@/client/utils/omit-props"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

type Props = PreviewCardPrimitive.Root.Props

export function HoverCard(props: Props) {
  const restProps = omitProps(props, [])

  return <PreviewCardPrimitive.Root data-slot="hover-card" {...restProps} />
}
