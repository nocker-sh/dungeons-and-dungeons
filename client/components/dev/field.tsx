import { Label } from "@/client/components/ui/label"

type Props = {
  label: string
  children: React.ReactNode
}

export function Field(props: Props) {
  return (
    <Label style={{ display: "grid", gap: 6, fontSize: 12, width: "100%" }}>
      {props.label}
      {props.children}
    </Label>
  )
}
