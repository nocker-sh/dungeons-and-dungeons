import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { useCarousel } from "@/client/components/ui/carousel-shared"

type Props = React.ComponentProps<"div">

export function CarouselItem(props: Props) {
  const restProps = omitProps(props, ["className"])

  const { orientation } = useCarousel()

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        props.className
      )}
      {...restProps}
    />
  )
}
