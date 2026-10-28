"use client"

import { omitProps } from "@/client/utils/omit-props"
import { useMemo } from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}

export function FieldError(props: Props) {
  const restProps = omitProps(props, ["className", "children", "errors"])

  const content = useMemo(() => {
    if (props.children) {
      return props.children
    }

    if (!props.errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(props.errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [props.children, props.errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-sm font-normal text-destructive", props.className)}
      {...restProps}
    >
      {content}
    </div>
  )
}
