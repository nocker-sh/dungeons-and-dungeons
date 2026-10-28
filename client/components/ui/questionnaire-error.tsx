"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"
import { cn } from "cn"

type Props = React.ComponentProps<typeof QuestionnairePrimitive.Error>

export function QuestionnaireError(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <QuestionnairePrimitive.Error
      data-slot="questionnaire-error"
      className={cn("mt-2 text-sm text-destructive", props.className)}
      {...restProps}
    />
  )
}
