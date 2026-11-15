import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div"> & { ratio: number }

export function AspectRatio(props: Props) {
  const restProps = omitProps(props, ["ratio", "className"])

  return (
    <div
      data-slot="aspect-ratio"
      style={
        {
          "--ratio": props.ratio,
        } as React.CSSProperties
      }
      className={cn("relative aspect-(--ratio)", props.className)}
      {...restProps}
    />
  )
}
