"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"
import { cn } from "cn"
import { buttonVariants } from "@/client/components/ui/button-variants"
import type { Button } from "@/client/components/ui/button"

type Props = React.ComponentProps<typeof QuestionnairePrimitive.Previous> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">

export function QuestionnairePrevious(props: Props) {
  const size = props.size === undefined ? "default" : props.size
  const variant = props.variant === undefined ? "outline" : props.variant
  const restProps = omitProps(props, [
    "children",
    "className",
    "size",
    "variant",
  ])

  return (
    <QuestionnairePrimitive.Previous
      data-slot="questionnaire-previous"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "col-start-1 row-start-1 min-h-11 justify-self-start sm:min-h-0",
        props.className
      )}
      {...restProps}
    >
      {props.children ?? "Previous"}
    </QuestionnairePrimitive.Previous>
  )
}
