import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Button } from "@/client/components/ui/button"
import { ChevronRightIcon } from "lucide-react"
import { useCarousel } from "@/client/components/ui/carousel-shared"

type Props = React.ComponentProps<typeof Button>

export function CarouselNext(props: Props) {
  const variant = props.variant === undefined ? "outline" : props.variant
  const size = props.size === undefined ? "icon-sm" : props.size
  const restProps = omitProps(props, ["className", "variant", "size"])

  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      className={cn(
        "absolute touch-manipulation rounded-full",
        orientation === "horizontal"
          ? "inset-y-0 -right-12 my-auto"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        props.className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...restProps}
    >
      <ChevronRightIcon />
      <span className="sr-only">Next slide</span>
    </Button>
  )
}
