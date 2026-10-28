import { omitProps } from "@/client/utils/omit-props"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "cn"

type Props = AccordionPrimitive.Root.Props

export function Accordion(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", props.className)}
      {...restProps}
    />
  )
}
