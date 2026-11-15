import { omitProps } from "@/client/utils/omit-props"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"

type Props = useRender.ComponentProps<"a">

export function BreadcrumbLink(props: Props) {
  const restProps = omitProps(props, ["className", "render"])

  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "transition-colors hover:text-foreground",
          props.className
        ),
      },
      restProps
    ),
    render: props.render,
    state: {
      slot: "breadcrumb-link",
    },
  })
}
