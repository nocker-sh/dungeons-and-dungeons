import { omitProps } from "@/client/utils/omit-props"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cn } from "cn"

type Props = AvatarPrimitive.Fallback.Props

export function AvatarFallback(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        props.className
      )}
      {...restProps}
    />
  )
}
