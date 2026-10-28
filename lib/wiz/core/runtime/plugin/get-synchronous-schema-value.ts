import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WizStandardSchema,
  WizStandardSchemaValidationError,
} from "@/lib/wiz/core/standard-schema"
import { pluginSceneModuleOwnership } from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"

export const getSynchronousSchemaValue = <TInput, TOutput>(
  schema: WizStandardSchema<TInput, TOutput>,
  input: unknown
): WizDeepReadonly<TOutput> | null => {
  try {
    return pluginSceneModuleOwnership.ownImmutable(schema.validate(input))
  } catch (error) {
    if (error instanceof WizStandardSchemaValidationError) {
      return null
    }
    throw error
  }
}
