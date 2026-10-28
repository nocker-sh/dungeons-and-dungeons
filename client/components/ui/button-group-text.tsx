import { omitProps } from "@/client/utils/omit-props"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"

type Props = useRender.ComponentProps<"div">

export function ButtonGroupText(props: Props) {
  const restProps = omitProps(props, ["className", "render"])

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex items-center gap-2 rounded-lg border bg-muted px-2.5 text-sm font-medium [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
          props.className
        ),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "button-group-text",
    },
  })
}
