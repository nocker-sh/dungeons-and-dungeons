import type { Props as SourceProps } from "@/development/components/workspace-shared"
import { Workspace } from "@/development/components/workspace"

type Props = SourceProps

export function DevWorkspace(props: Props) {
  return <Workspace {...props} />
}
