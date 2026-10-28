"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"

type Props = SelectPrimitive.Group.Props

export function SelectGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", props.className)}
      {...restProps}
    />
  )
}
