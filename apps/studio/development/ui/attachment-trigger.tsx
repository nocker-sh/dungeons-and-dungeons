import { omitProps } from "@/client/utils/omit-props"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"

type Props = useRender.ComponentProps<"button">

export function AttachmentTrigger(props: Props) {
  const restProps = omitProps(props, ["className", "render", "type"])

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: props.render ? props.type : (props.type ?? "button"),
        className: cn("absolute inset-0 z-10 outline-none", props.className),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "attachment-trigger",
    },
  })
}
