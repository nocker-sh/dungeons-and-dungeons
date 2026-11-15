import { omitProps } from "@/client/utils/omit-props"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cn } from "cn"

type Props = AvatarPrimitive.Image.Props

export function AvatarImage(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        props.className
      )}
      {...restProps}
    />
  )
}
