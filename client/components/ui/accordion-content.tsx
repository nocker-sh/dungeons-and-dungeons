import { omitProps } from "@/client/utils/omit-props"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { cn } from "cn"

type Props = AccordionPrimitive.Panel.Props

export function AccordionContent(props: Props) {
  const restProps = omitProps(props, ["className", "children"])

  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...restProps}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-2.5 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          props.className
        )}
      >
        {props.children}
      </div>
    </AccordionPrimitive.Panel>
  )
}
