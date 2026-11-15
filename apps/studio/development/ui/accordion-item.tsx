import { omitProps } from "@/client/utils/omit-props"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "cn"

type Props = AccordionPrimitive.Item.Props

export function AccordionItem(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b", props.className)}
      {...restProps}
    />
  )
}
