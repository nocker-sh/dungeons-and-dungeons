type Props = { file: string; source: string }

/** 公開資料へ端末情報や秘密の値を持ち込まない。 */
export function publicDocumentProblems(props: Props): string[] {
  const problems: string[] = []
  if (
    /(?:\/Users\/|\/home\/[A-Za-z0-9_-]+\/|[A-Za-z]:\\Users\\)/.test(
      props.source
    )
  )
    problems.push(`${props.file}: 端末固有の絶対パスを公開しない`)
  if (
    /(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(
      props.source
    )
  )
    problems.push(`${props.file}: 秘密情報の可能性がある値を含む`)
  return problems
}
