import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"
import { ChevronLeftIcon } from "lucide-react"
import { useCarousel } from "@/client/components/ui/carousel-shared"

type Props = React.ComponentProps<typeof Button>

export function CarouselPrevious(props: Props) {
  const variant = props.variant === undefined ? "outline" : props.variant
  const size = props.size === undefined ? "icon-sm" : props.size
  const restProps = omitProps(props, ["className", "variant", "size"])

  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      className={cn(
        "absolute touch-manipulation rounded-full",
        orientation === "horizontal"
          ? "inset-y-0 -left-12 my-auto"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        props.className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...restProps}
    >
      <ChevronLeftIcon />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
}
