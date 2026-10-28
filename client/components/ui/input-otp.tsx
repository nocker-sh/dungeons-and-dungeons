"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { OTPInput } from "input-otp"

type Props = React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}

export function InputOTP(props: Props) {
  const restProps = omitProps(props, ["className", "containerClassName"])

  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "cn-input-otp flex items-center has-disabled:opacity-50",
        props.containerClassName
      )}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", props.className)}
      {...restProps}
    />
  )
}
