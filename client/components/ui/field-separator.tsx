"use client"

import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"
import { Separator } from "@/client/components/ui/separator"

type Props = React.ComponentProps<"div"> & {
  children?: React.ReactNode
}

export function FieldSeparator(props: Props) {
  const restProps = omitProps(props, ["children", "className"])

  return (
    <div
      data-slot="field-separator"
      data-content={!!props.children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        props.className
      )}
      {...restProps}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {props.children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {props.children}
        </span>
      )}
    </div>
  )
}
