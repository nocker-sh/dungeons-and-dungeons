import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"
import { SAVE_REVISION } from "@/lib/wiz/definition/save-revision"

/** 保存の構成 identity。規則の版と保存の形の版だけから作る（コンテンツの数値は含めない）。 */
export function saveIdentity(
  rulesRevision = "rules-1",
  revision = SAVE_REVISION
) {
  return WizRpgComponentIdentity.create(
    rulesRevision,
    Object.freeze({ save: revision })
  ).digest
}
