// 札の傾き・持ち上げ・カーソルの追従を滑らかに変えるため、数値のカスタムプロパティとして登録する
if (typeof CSS !== "undefined" && "registerProperty" in CSS)
  for (const name of ["--up", "--hov", "--mx", "--my"])
    try {
      CSS.registerProperty({
        name,
        syntax: "<number>",
        inherits: true,
        initialValue: "0",
      })
    } catch {
      // 二度目の登録（HMR など）は無視する
    }

export {}
