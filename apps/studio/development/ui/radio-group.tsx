"use client"

import { omitProps } from "@/client/utils/omit-props"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "cn"

type Props = RadioGroupPrimitive.Props

export function RadioGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-2", props.className)}
      {...restProps}
    />
  )
}
