import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { useCarousel } from "@/client/components/ui/carousel-shared"

type Props = React.ComponentProps<"div">

export function CarouselContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  const { carouselRef, orientation } = useCarousel()

  return (
    <div
      ref={carouselRef}
      className="overflow-hidden"
      data-slot="carousel-content"
    >
      <div
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          props.className
        )}
        {...restProps}
      />
    </div>
  )
}
