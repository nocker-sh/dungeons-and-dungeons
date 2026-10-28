/** 戦闘の外で使える道具か。回復・使用回数・治療・蘇生だけ。 */
export function usableInField(effect: { readonly type: string } | undefined) {
  return !!effect && ["heal", "refill", "cure", "revive"].includes(effect.type)
}
