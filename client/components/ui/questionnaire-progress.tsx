"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"
import { cn } from "cn"

type Props = React.ComponentProps<typeof QuestionnairePrimitive.Progress>

export function QuestionnaireProgress(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <QuestionnairePrimitive.Progress
      data-slot="questionnaire-progress"
      className={cn(
        "min-h-[1lh] w-fit min-w-[14ch] text-xs font-medium text-muted-foreground tabular-nums",
        props.className
      )}
      {...restProps}
    />
  )
}
