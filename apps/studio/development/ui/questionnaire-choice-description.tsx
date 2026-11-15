"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"span">

export function QuestionnaireChoiceDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <span
      data-slot="questionnaire-choice-description"
      className={cn("text-muted-foreground", props.className)}
      {...restProps}
    />
  )
}
