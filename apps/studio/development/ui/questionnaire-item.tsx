"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"
import { cn } from "cn"

type Props = React.ComponentProps<typeof QuestionnairePrimitive.Item>

export function QuestionnaireItem(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <QuestionnairePrimitive.Item
      data-slot="questionnaire-item"
      className={cn(
        "flex min-w-0 flex-col gap-4 border-0 p-0 outline-none",
        props.className
      )}
      {...restProps}
    />
  )
}
