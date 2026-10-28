"use client"

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { MinusIcon } from "lucide-react"

type Props = React.ComponentProps<"div">

export function InputOTPSeparator(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <div
      data-slot="input-otp-separator"
      className="flex items-center [&_svg:not([class*='size-'])]:size-4"
      role="separator"
      {...restProps}
    >
      <MinusIcon />
    </div>
  )
}
