import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import useEmblaCarousel from "embla-carousel-react"
import type {
  CarouselProps,
  CarouselApi,
} from "@/client/components/ui/carousel-shared"
import { CarouselContext } from "@/client/components/ui/carousel-shared"

type Props = React.ComponentProps<"div"> & CarouselProps

export function Carousel(props: Props) {
  const orientation =
    props.orientation === undefined ? "horizontal" : props.orientation
  const restProps = omitProps(props, [
    "orientation",
    "opts",
    "setApi",
    "plugins",
    "className",
    "children",
  ])

  const [carouselRef, api] = useEmblaCarousel(
    {
      ...props.opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    props.plugins
  )
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) return
    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
  }, [])

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev()
  }, [api])

  const scrollNext = React.useCallback(() => {
    api?.scrollNext()
  }, [api])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext]
  )

  React.useEffect(() => {
    if (!api || !props.setApi) return
    props.setApi(api)
  }, [api, props.setApi])

  React.useEffect(() => {
    if (!api) return
    onSelect(api)
    api.on("reInit", onSelect)
    api.on("select", onSelect)

    return () => {
      api?.off("select", onSelect)
    }
  }, [api, onSelect])

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts: props.opts,
        orientation:
          orientation || (props.opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", props.className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...restProps}
      >
        {props.children}
      </div>
    </CarouselContext.Provider>
  )
}
