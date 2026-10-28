import { omitProps } from "@/client/utils/omit-props"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

type Props = PreviewCardPrimitive.Trigger.Props

export function HoverCardTrigger(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <PreviewCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      {...restProps}
    />
  )
}
