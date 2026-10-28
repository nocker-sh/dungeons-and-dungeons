"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { cn } from "cn"
import { InputGroup } from "@/client/components/ui/input-group"
import { InputGroupAddon } from "@/client/components/ui/input-group-addon"
import { InputGroupButton } from "@/client/components/ui/input-group-button"
import { InputGroupInput } from "@/client/components/ui/input-group-input"
import { ComboboxTrigger } from "@/client/components/ui/combobox-trigger"
import { ComboboxClear } from "@/client/components/ui/combobox-clear"

type Props = ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean
  showClear?: boolean
}

export function ComboboxInput(props: Props) {
  const disabled = props.disabled === undefined ? false : props.disabled
  const showTrigger = props.showTrigger === undefined ? true : props.showTrigger
  const showClear = props.showClear === undefined ? false : props.showClear
  const restProps = omitProps(props, [
    "className",
    "children",
    "disabled",
    "showTrigger",
    "showClear",
  ])

  return (
    <InputGroup className={cn("w-auto", props.className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...restProps}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {props.children}
    </InputGroup>
  )
}
