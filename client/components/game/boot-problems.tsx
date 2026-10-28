/** 起動・保存操作を続けられない理由を表示する。 */
type Props = {
  problems: readonly string[]
  storage?: boolean
}

export function BootProblems(props: Props) {
  const storage = props.storage === undefined ? false : props.storage

  return (
    <div
      className="game"
      style={{
        display: "block",
        overflow: "auto",
        padding: "6vh 6vw",
        color: "#eeebe3",
      }}
    >
      <h1 style={{ fontSize: "calc(var(--u)*5)", marginBottom: "1em" }}>
        {storage ? "保存を消せませんでした" : "コンテンツに誤りがあります"}
      </h1>
      <p style={{ fontWeight: 700, marginBottom: "1em", opacity: 0.8 }}>
        {storage
          ? "ページを再読み込みして、保存の状態を確認してください。"
          : "content を直したら、ページを再読み込みしてください。"}
      </p>
      <ul
        style={{
          display: "grid",
          gap: ".4em",
          fontWeight: 700,
          fontSize: "calc(var(--u)*2.4)",
        }}
      >
        {props.problems.map((problem) => (
          <li key={problem}>・{problem}</li>
        ))}
      </ul>
      {storage ? (
        <button type="button" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      ) : null}
    </div>
  )
}
