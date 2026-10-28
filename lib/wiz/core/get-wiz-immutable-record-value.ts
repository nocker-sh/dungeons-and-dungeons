/**
 * own propertyだけを参照するdefinition lookup。
 */
export const getWizImmutableRecordValue = <TRecord extends object>(
  record: TRecord,
  key: string
): TRecord[keyof TRecord] | undefined =>
  Object.hasOwn(record, key)
    ? (record as Readonly<Record<string, TRecord[keyof TRecord]>>)[key]
    : undefined
