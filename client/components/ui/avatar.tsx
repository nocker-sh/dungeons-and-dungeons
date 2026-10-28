import { omitProps } from "@/client/utils/omit-props"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cn } from "cn"

type Props = AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg"
}

export function Avatar(props: Props) {
  const size = props.size === undefined ? "default" : props.size
  const restProps = omitProps(props, ["className", "size"])

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        props.className
      )}
      {...restProps}
    />
  )
}
