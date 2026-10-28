"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"
import { cn } from "cn"

type Props = React.ComponentProps<typeof QuestionnairePrimitive.Description>

export function QuestionnaireDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <QuestionnairePrimitive.Description
      data-slot="questionnaire-description"
      className={cn(
        "text-sm text-pretty text-muted-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}
