import { omitProps } from "@/client/utils/omit-props"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

type Props = SliderPrimitive.Root.Props

export function Slider(props: Props) {
  const min = props.min === undefined ? 0 : props.min
  const max = props.max === undefined ? 100 : props.max
  const restProps = omitProps(props, [
    "className",
    "defaultValue",
    "value",
    "min",
    "max",
  ])

  const _values = Array.isArray(props.value)
    ? props.value
    : Array.isArray(props.defaultValue)
      ? props.defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn(
        "data-horizontal:w-full data-vertical:h-full",
        props.className
      )}
      data-slot="slider"
      defaultValue={props.defaultValue}
      value={props.value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...restProps}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
