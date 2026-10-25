# ダンジョンズ & ダンジョンズ！

4人の仲間（前衛2・後衛2）を編成し、「進む」「戻る」でダンジョン突破を目指すローグライトの基盤。

```sh
bun install
portless run
```

[開発画面](https://dnd.localhost)

街・探索・戦闘・結果、宿泊、求人、武器の鑑定と購入、装備、討伐依頼、会話、成長、途中保存を小さな仮データで接続しています。戦闘バランスとコンテンツは調整前です。

- [ゲーム仕様](.docs/game-spec.md)
- [開発エージェントのルール](AGENTS.md)
- [製品方針と仕様](.docs/index.md)
- [エンジン再利用の判断](.docs/decisions/001-reuse-open-wiz.md)
- [DI・モック・開発方法](.docs/development.md)
- [暫定ルール](.docs/decisions/002-foundation-rules.md)

エンジンは `src/lib/wiz`。React・DOM・保存先から独立し、`WizDefinition` で構成、`Wiz` で操作します。React側はContextから受け取り、外部ストアとして購読します。

```sh
vp test run
bun run typecheck
vp build
```
