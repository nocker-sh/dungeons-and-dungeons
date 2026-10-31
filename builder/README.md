# builder：ブラウザなしで遊び、測り、調整する

`vp exec bun builder/quick-quests.ts 20` は街なか・街の外の単発依頼14件の実際の開始・戦闘・自動精算を20シードで測る。Lv3/7/11、解放0/1/2層、資金1000Gから店装備を購入した条件。自然な資金獲得の測定とは区別する。対話CLIは `fight-quest q-farm-vegetables` で開始できる。

一周と `fun` の育成指標は、出撃中の仲間から主人公を除いて計算する。主人公はレベルで成長しないため、固定のLv1や旧保存のレベルを混ぜない。控えも含めない。一周のJSONには従来の全員平均（`level` / `finalLevel`）と育成対象の平均（`companionLevel` / `finalCompanionLevel`）を両方残す。`fun` の出撃記録も `levelBefore` と `companionLevelBefore` を併記する。自動プレイの再挑戦間隔は従来どおり全員平均を使い、育成レポートの集計対象とは分ける。目標の22〜40は変更しない。

## 仲間・編成の比較

`vp exec bun builder/roster-matrix.ts 20` で10編成を5層のボスと2種類の複数敵に対して比較する。役割を替えた対照編成も残すため、苦手な編成の失敗を隠さない。

比較の群れには現役の火カリクス・毒コルンバを使う。不採用のクビコキ・沼クビコキは比較に含めない。第5引数に上書きファイルを渡せる：`vp exec bun builder/roster-matrix.ts 8 1 stress /tmp/candidate.sets`。変更前後は同じ敵・装備・育成・シードで比較する。

第6引数 `endgame` は10編成の最深層ボスだけを再測定する：`vp exec bun builder/roster-matrix.ts 8 1 stress "" endgame`。最深層だけを調整した場合に使い、他の場面の測定条件と結果は保持する。

全仲間の比較にも開始シードと上書きを渡せる：`vp exec bun builder/roster.ts 8 1 /tmp/candidate.sets`。第5引数 `endgame` は最深層ボス・Lv26・強化30段だけを測る（例：`vp exec bun builder/roster.ts 4 41 /tmp/candidate.sets endgame`）。全仲間を3つの役割編成へ入れ、ダメージ役は前衛・後衛の両方を残す。ヒール・タンクを欠いた対照編成も同じシードで測る。

探索試行で決めた編成は、`[{"slug":"alda","party":["hero","alda","sion"]}]` のJSONへ固定して `vp exec bun builder/roster-confirm.ts /tmp/selected.json 8 61` で別シードに再確認できる。結果を見て編成を選び直さず、Lv26・最深層・30段で測る。資金と素材を付与した比較で、自然な育成・獲得コストとは区別する。

第6引数は通常武器の個体の比較条件（N・R・SR）。`vp exec bun builder/roster-confirm.ts /tmp/selected.json 8 91 "" SR` は、同じ武器・ワザ・シードで上振れをレア度の範囲の中央へ揃え、レア度による攻撃力と使用回数だけを比べる。固定武器の個体は変えない。実際の鑑定抽選・費用・入手頻度の検証ではなく、Nの苦戦を消さず別条件として残す。

各結果の `outcomes` は、試行ごとのシード・勝敗・行動数・ターン数・戦闘中の最低HP割合を含む。敗戦後の `hp` はゲームの復帰処理後の値なので、戦闘中の危険度には `lowestHp` を使う。同じ条件とシードで苦手な戦闘を再現できる。

第3引数は開始シード。`vp exec bun builder/roster-matrix.ts 20 21` なら、調整に使った1〜20とは異なる21〜40で比較できる。第4引数 `ready` は同じ装備条件で4レベル追加育成する対照条件。`vp exec bun builder/roster-matrix.ts 12 41 ready` で、準備が足りない戦闘と、育成しても苦手な戦闘を分けて確認する。既定の `stress` の失敗を置き換えず、両方の結果を残す。

Lv6/10/14/18/22のボスと、Lv12の鉄橋の群れ、Lv16の毒に強い群れを使う。到達した層の店で装備を買い、ユニークの固定武器は実際に素材を購入して鍛え直す（各層で+0/8/16/24/30）。これは装備の成長後を比較する条件で、同額の投資や実際の獲得時間を揃えた比較ではない。低投資の条件は下記の `roster.ts` を併用する。

`vp exec bun builder/roster.ts 20` で仲間と構成を比べる。レア度は強さではなく個性なので、同じ役割の仲間が「一番合う構成」で同じくらい勝てるか、役割がそろった構成とタンクやヒールを欠いた構成で差があるか（構成の価値）を見る。仲間はその役割の枠に入れた3つの構成（基準・毒・守り）で試し、主人公と2人なので、ダメージ役はタンクの代わりに前衛へ入れる並びと、ヒールの代わりに後衛へ入れる並びの両方を試す。場面は序盤のボス（0層・Lv6）、中盤のボス（2層・Lv12）、中盤の群れ（2層の敵3体・Lv8）。ふつうの仲間の武器は強化の上限まで上げ、ユニークは鍛え直しで同じ段に上げる。資金を付与した戦闘用の比較なので、入手難度や探索全体の収支の検証とは分ける。自動方策は最適プレイを保証しない。

Lv6では大人ジェムホッグ、Lv12ではミミウォール2体と戦う。育成・装備購入の条件を揃え、勝率、残りHP、被害、回復量をJSON行で出力する。個別キャラは役割に応じた基準編成へ入れ替える。資金を付与した戦闘用の比較なので、入手難度や探索全体の収支の検証とは分ける。自動方策は最適プレイを保証しない。

ゲームのエンジン（`lib/wiz`）と作品データ（`content`）だけを使い、React もブラウザも使わずにゲームを動かす。AI がCLIで一手ずつ遊んだり、自動プレイを何百回も回して勝率を測ったり、数値を振って比べたりするための道具。

```sh
vp run cli            # 使い方
vp run cli check      # バランスの目標を測る（外れがあれば終了コード1）
```

`report` / `check` は各目標の測定開始と合否を標準エラーへ出す。`--json` の標準出力には最終結果のJSONだけを出すので、`> result.json 2> progress.log` で結果と進捗を別々に保存できる。途中のPASSだけでは全体の成功にならず、終了コードと最終結果を確認する。

1戦が2,000手でも決着しなければ、測定未完了のエラーにする。探索全体も2,000手で街へ戻らなければ未完了にする。打ち切った試行を敗北・全滅・帰還として勝率や探索結果へ混ぜない。

`report` / `check` は回数を合否が決まるところまでに抑える。率や平均の95%の幅が目標の内側か外側に収まったら、`--runs` に届く前に打ち切る（`lib/sequential.ts`）。測った値は `node_modules/.cache/builder/results.json` に残し、作品データ・エンジン・builder のソースと上書き・回数・種が同じなら使い回す（「前回の結果」と出る）。測り直すときは `--no-cache`。一周の測定（`campaign-*`）は打ち切らず、毎回すべて回す。

## 仕組み

- `lib/session.ts`：一回のプレイ。乱数（`lib/random.ts`）とIDは種から決まり、同じ種・同じ操作なら同じ結果になる。`dump()` で続きを保存できる。はじめからは主人公を作る場面なので、作るところまでは自動で進める（名前と外見は既定）。
- `content.ts`：作品データを複製し、`--set` の上書きを当てる。JSON のファイルは書き換えない（書き戻すのは `apply` だけ）。
- `cli.ts`：コマンドの入口。`cli/main.ts` がコマンドの登録と実行、`cli/options.ts` が引数、`cli/output.ts` が共通の表示を扱う。戦闘・探索・測定・調整・一歩ずつ遊ぶ処理は `cli/` 内の目的別モジュールへ置く。
- `lib/policy/`：自動プレイの方針。公開APIは `index.ts` にまとめ、戦闘（`battle.ts`）、探索（`expedition.ts`）、編成（`party.ts`）、街の一日（`town.ts`）、回復（`healing.ts`）、装備・鑑定（`equipment.ts`）に分ける。遊び始めは `startParty`（募集から払える安い順に3人そろえ、召喚石を使い切って悪魔と合体する）。出撃には3人と、主人公のワザになる悪魔が要る。戦闘は `smart`（回復・蘇生・溜め・守り・縛り・一番効く攻撃）、`attack`（攻撃のワザだけ）、`random`。武器は「その仲間が持ったときの攻撃力」、防具は耐久で買い替える。探索は撤退の目安つき。街では召喚・依頼・宿・回復薬・ガラクタの鑑定・装備の買い替え・強化・防具の修理・ユニークの固有の武器の鍛え直し（余ったレア度 N の武器だけを素材にする）を行う。
- `lib/simulation/`：戦闘、探索、測定用の準備、試行の集計、一周の計測。利用する処理の定義元を直接importする。乱数・状態・手数上限はそれぞれの実行に閉じる。
- `targets.ts`：バランスの目標。`report` / `check` と `builder.test.ts`（`vp test run`）が測る。

規則はエンジンのものをそのまま使う。方針は操作を選ぶだけで、状態を直接いじらない（例外：`--level` の準備と `play` の再開だけが保存を通して状態を作る）。

## AI が遊ぶ（ai）

AI がゲームを遊ぶ入口。1回の操作はおよそ0.25秒で返る。保存は既定で `/tmp/dnd/save.json`（`DND_SAVE` で変えられる）に残り、次の呼び出しで続きから遊べる。

```sh
vp run cli ai --new "recruit n-mayu" "summon" "depart layer0"
vp run cli ai "advance n1" "skill helmsplit foe-1"     # 続きから
vp run cli ai "look shop armory" "look gear"           # 画面の細部を読む
vp run cli ai --scene battle-layer2                    # /previews の場面から始める
vp run cli ai --script /tmp/moves.txt                  # 台本（1行1操作、JSON文字列外の # 以降はコメント）
vp run cli ai --json "auto"                            # 出来事と画面の材料（Query の結果）を JSON で
```

- 毎回の出力の最後に、いまの状態（パーティ・持ち物・路線・分かれ目の行き先・祭壇の選択肢・戦闘・今できる操作）が出る。
- `look` で画面の細部を読む：`shops`・`shop <店>`（値段・買えるか・持つと強くなる仲間）・`recruits`・`quests`・`rooms`・`smithy`・`gear`（持つと強くなる仲間）・`member <仲間>`・`skill <ワザ>`・`foe <敵>`。
- ブラウザと同じ保存を使える：開発サーバー（`https://dungeon.localhost/?save=tmp`）で開くと、保存を localStorage ではなく同じ `/tmp/dnd/save.json` に読み書きする。AI が CLI で作った場面をブラウザで開き直せば、そのまま見た目を確かめられる。ブラウザで遊んだ続きを CLI で再現することもできる。本番のビルドには入らない（`scripts/dev-save.ts`）。

## 一手ずつ遊ぶ（play）

```sh
vp run cli play --new --save /tmp/run.json "depart layer0" "advance n1"
vp run cli play --save /tmp/run.json "skill whirl" "foe" "auto-battle"
vp run cli play --save /tmp/run.json "ack" "auto-run"
```

- 出力の最後に状態（パーティ・持ち物・路線・戦闘・今できる操作）が出る。id は slug で出る。
- 操作は短い書き方か JSON。slug はそのまま書ける：`depart layer0` `advance n2` `skill shears foe-2` `brawl foe-1`（使える手が尽きたときの「殴る」）`item potion ada` `guard` `foe`（敵の手番）`ack` `retreat` `rest normal` `buy <shop> <good>` `summon` `demon lock` `upgrade <gearId>` `reforge <gearId> <素材のgearId>`（ユニークの固有の武器を鍛え直す）`repair [仲間]` `craft craft-axe` `dismiss`（全滅の結果を閉じる）`ending`（踏破の場面を見終える）など。
- 自動：`auto`（一手）、`auto-battle`（戦闘の終わりまで）、`auto-run`（街へ戻るまで）、`auto-day`（街の準備→出撃→帰還）。
- 祭壇では `discover blessing <祝福slug> <仲間slug>` または `discover book`。鍛冶屋では `inscribe <gearId> <枠番号2か3> <スキルslug>` で書を1冊使って変更する。武器3枠と祝福1枠に加え、キャラ固有・悪魔スキルは別メニューに残す。自動プレイも祝福を選び、戦闘で使う。
- JSON操作でも品物・ワザ・仲間などの参照にはslugを使える。操作名（`command`）、名前、装備の個体ID（`gear` / `material`）、路線の行き先は入力どおりに扱う。例：`{"type":"act","command":"brawl","target":"foe-1"}`。
- `--level N` で出撃の3人を宿と同じ規則で育ててから始める。測る前に `startParty` が働くので、どの測定も「3人そろえて合体した状態」から始まる。

## 測る

```sh
vp run cli inspect                                   # 数値の一覧（slug つき）
vp run cli battle kamokutsu,kamokutsu --runs 500               # 勝率・残りHP・誰が削ったか・使った手
vp run cli battle haribote-adult --boss --level 6         # 育てた状態でボス戦
vp run cli curve haribote-adult --boss --runs 100         # レベルごとの勝率
vp run cli dungeon layer0 --push                     # 撤退せずに潜ったときの突破率・全滅率
vp run cli dungeon layer0 --retreat 0.4              # 撤退の目安を変える
vp run cli depth layer1 --level 14 --weapons --potions 14  # 深さごとの稼ぎ
vp run cli campaign --runs 50 --layers 2             # 街と探索をくり返して何回目で突破するか
vp run cli battle haribote-adult --boss --style attack    # 方針を変えて比べる（スキルの価値）
```

`--json` で機械向けの出力。`--seed` で種を変えて、偶然でないかを確かめる。`--level N` で育てた状態、`--weapons` で店の武器に持ち替えた状態を測る。素の武器は必要な能力を満たすので、レベルだけ上げても攻撃力は伸びない（攻撃力は武器から決まる）。

`--runs`・`--budget`・`--level`・`--expeditions`・`--layers` は1以上の整数、`--potions`・`--reached` は0以上の整数を指定する。撤退・ボス戦のHP割合は0〜1、`--depths` は0以上の数値（小数も可）。`--seed`・`--seeds` は整数で、0や負数も使える。不正な数値や一覧の空欄は、測定・保存を始める前にエラーにする。種や深さの一部だけを黙って除外しない。

自動プレイの街準備は、鑑定した防具も購入前に装備候補へ入れる。耐久・能力補正・強化段を店の買い替えと同じ目安で比較し、未装備で適合する品だけを使う。別の仲間から装備を奪わない。この目安は自動方策で、各編成に最適な防具の評価ではない。

武器の持ち替えもゲームの装備候補Queryから選ぶ。未鑑定品の内部性能は比較に使わず、鑑定済みで未装備の候補だけを並び順に割り当てる。

街の準備後、前衛の最大HPと防具の最大耐久の合計が後衛の半分未満なら、その2人の前後を入れ替える。僅差や一時的な負傷では配置を変えない。これは自動プレイの方策で、ゲーム本体のプレイヤー編成は自動変更しない。

`campaign` は突破までの出撃回数に加えて、1出撃あたりの鑑定の回数・稼ぎ・防具の修理代、はじめて R 以上を引いた出撃回数、1戦あたりのラウンド（道中・ボス。戦闘のテンポ）も出す。

`depth` は「どこまで潜るか」を変えて測る（`--depths` は引き返す地点の x）。持ち帰った光るガラクタ（必ず R 以上の武器になる）の数も出す。深いほど1地点あたりの稼ぎが増えていれば、進む判断が得になっている。全滅率も並ぶので、危なさと稼ぎを一緒に見る。深く潜るには薬が要るので `--potions N` を付ける。

## 面白さを測る（fun・playlog）

```sh
vp run cli fun --runs 8 --expeditions 45     # 面白さの数字を目安と並べる
vp run cli playlog --seed 1 --expeditions 45 # 一周を自動で遊び、出撃ごとの出来事を読む
vp run cli fun --sets /tmp/try.txt           # 調整案の面白さを比べる
```

- `fun` は街と探索をくり返す一周を何周か遊び、手ざわりを数える（`lib/fun.ts`）。○×は `FUN_GOALS` の目安に入っているか。目安は仮で、ユーザーの確定仕様ではない。
  - テンポ：道中1戦で自分が選ぶ手の数、ボス戦のラウンド。
  - 当たり：1出撃あたりの R・SR と敵が落とした武器（多すぎると当たりの価値が薄れるので上限もある）。
  - 成長：出撃の前に攻撃力が上がった割合、1出撃あたりのレベルの伸び。
  - 緊張：ピンチを切り抜けた戦闘（HPの合計が半分を切ってから勝った）、楽勝の戦闘、全滅した出撃、最初の3出撃での全滅。
  - 判断：1出撃あたり分かれ目で行き先を選んだ回数。長さ：踏破までの出撃回数。
- `fun --json` の `longestRoadFights` は終点ボス以外の長い戦闘を上位10件記録する。種・出撃番号・層・地点・敵・中ボス判定・手数・ラウンド・勝敗から再現できる。`roads` は通常戦と中ボスの平均手数も別々に出す。分岐で生成された地点はゲーム本体のCatalogで判定する。
- 通常表示と `fun --json` の `roads` に、層別の道中戦闘数・手数平均／中央値／最大・楽勝割合を出す。既存の道中指標と同じく終点ボス戦を除く（中ボスは含む）。平均は全戦闘から算出し、戦闘がない層は `null`／「未測定」とする。
- 通常表示と `fun --json` の `completion` に踏破数／測定数・出撃上限・未踏破の種を出す。踏破までの出撃回数は踏破した周だけの集計なので、未踏破数と合わせて読む。
- `fun --json` の `runs` には種ごとの踏破出撃数（未踏破なら `null`）と、層ごとの出撃数・初突破の出撃番号を出す。全体の中央値だけでなく、どの層で足止めされたか、早く抜けたかを比較できる。
- 各 `runs` の `progression` は出撃番号、層、出撃前の平均レベル、街の準備前後の攻撃力合計、鑑定レア度、探索結果、到達地点数、獲得経験値、初突破を記録する。レベルは出撃前の値なので、探索で得た経験値による成長は次の出撃と比較する。調整で踏破が早まった理由を、層の突破と育成・装備更新の両方から確認できる。
- `playlog` は一周の出撃ごとに、層・平均レベル・攻撃力の伸び・鑑定の当たり・地点数・戦闘とピンチ・分岐・拾った武器・光るガラクタ・結果を1行で出す。数字では見えない「同じ層で足止めされる」「全滅が続く」「終盤に強くならない」を読む。
- `play` で手で遊ぶときは、分かれ目の行き先（ラベル・危険度・次の分かれ目までの見通し）と祭壇の選択肢が画面と同じ言葉で出る。

## 調整する

1. 仮の値を `--set` で当てて測る。JSON はまだ触らない。
   ```sh
   vp run cli report --set foes.haribote-adult.hp=1100 --set balance.expBase=25
   vp run cli sweep --param foes.kamokutsu.atk --values 60,65,70 --metric battle:kamokutsu,kamokutsu
   vp run cli sweep --param foes.haribote-adult.hp --values 800,1000 --metric curve:haribote-adult --boss
   ```
2. 上書きはファイルにまとめられる（JSON文字列外の `#` 以降はコメント。`"技#1"` など文字列内の `#` は保持する）：`--sets /tmp/try.txt`
3. 目標に入ったら書き戻す：`vp run cli apply --sets /tmp/try.txt` → `vp fmt` → `vp run cli check`

上書きの書き方：

| 書き方                                          | 意味                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `foes.kamokutsu.atk=65`                         | 一覧（party, skills, goods, foes, layers, demons, rooms, shops, recruits, quests, smithy.recipes）の slug の項目 |
| `foes.*.hp*=1.2`                                | 全員を1.2倍（整数は四捨五入）                                                                                    |
| `party.alda.stats.str+=2` / `-=`                | 足す・引く                                                                                                       |
| `balance.expBase=25`                            | 一覧でないもの（settings.json）は先頭から                                                                        |
| `layers.layer0.foes=["@kamokutsu","@hiyokobu"]` | 参照は `@slug` で id に直す                                                                                      |
| `foes.haribote-adult.resist={"bind":0.7}`       | 値は JSON                                                                                                        |

調整できる規則の数値は `content/data/settings.json` の `balance`（経験値 `expBase`・`expPower`・成長・成長の型 `growthCurve`・疲れ・被害の式・回復・武器の倍率・強化で増える使用回数 `weapon.usesPerPlus`・武器の個体 `weapon.rarity`・毒・守り・防御・防具の耐久と修理代・ユニークの鍛え直し `unique`・売値 `sell`・深さの手当て `depth`）と `weaponSkills`（武器種ごとのランダムなワザの候補）、仲間ごとの `growth`、武器の `power`・`need`・`skills`、防具の `durability`、ワザの `uses`、敵の `resist`・`skills`・`skillRate`。

## 自動で合わせる（tune）

目標から外れているとき、決めた範囲の中で数値を動かして範囲へ入れる。JSON は書き換えない。

```sh
vp run cli tune builder/tunings/layer0.ts
vp run cli tune builder/tunings/layer0.ts --targets fresh-boss,midboss-fresh --seeds 1,7 --runs 20 --budget 40
vp run cli apply --sets node_modules/.cache/builder/tune-layer0.txt   # 良ければ書き戻す
```

- 結果は目標ごとの前後の値と、動かした数値の一覧。上書きは `node_modules/.cache/builder/tune-<spec>.txt` に出るので、確かめてから `apply` する。`--apply` を付けると全部合格したときだけ続けて書き戻す。`--json` で機械向け。進み具合は標準エラーへ出る。
- options：`--seeds 1,7,23`（この全部で合格させる）`--budget N`（測定の上限。既定60）`--runs N`（既定30）`--targets id,id`（spec の一部だけ）`--out <file>` `--set`（調整の前から当てる上書き）。
- すでに全部範囲の中なら「何も動かさない」で終わる。届かなければ終了コード1。

指定（spec）は TS か JSON。`path` は `--set` と同じ書き方で、複数書くと一緒に動く。`mode: "scale"` は今の値に倍率をかける（`*=`）。

```ts
const layer0: TuningSpec = {
  id: "layer0",
  targets: ["fresh-boss", "boss-level"], // targets.ts の id
  knobs: [
    { path: "foes.haribote-adult.hp", min: 700, max: 2400, step: 25 },
    { path: "balance.expBase", min: 12, max: 40, step: 1, keep: 2 }, // keep が大きいほど動かさない
    {
      path: ["goods.sword.price", "goods.axe.price"],
      mode: "scale",
      min: 0.6,
      max: 2,
      step: 0.05,
    },
  ],
}
```

探索は `lib/tune.ts`、つまみの正規化・目標の判定・指定の検証は `lib/tuning/` が持つ。`TuningEvaluator` は測定の予算・キャッシュ・複数の種の評価だけを受け持ち、探索の進め方は決めない。

探し方：

1. 目標の範囲からの外れ具合を足して点数にする。種ごとに測って、いちばん悪い種の点数を使う。
2. つまみを1刻みだけ動かして効き方を測る（差分）。刻みで測定値が変わらなければ大きく動かして確かめ、それでも変わらなければ「効かない」として以後は測らない。
3. いちばん効くつまみを同じ向きへ倍々に伸ばし、行き過ぎたら間を試す（単調なら一気に届く）。
4. 全ての種で測り直し、良くなったときだけ採用する。だめならその向きは諦めて次のつまみへ。
5. 全部範囲に入るか、測定の上限に達するまでくり返す。同じ（上書き, 種）は測り直さない。

外れの量が同じなら、動かす数を少なく・幅を小さくする方を選ぶ。そのため合格は範囲のきわに寄りやすい。余裕がほしいときは `--runs` と `--seeds` を増やすか、目標の範囲を狭める。

1回の測定の重さは目標で決まる（`--runs 20` のとき）。`boss-level` は約47秒、`campaign-*` は約82秒、戦闘だけの目標は1〜3秒。`--runs` を下げても `boss-level` と `campaign-*` は20回で下限に当たる（`targets.ts` の `small()`）。速く回すときは `--targets` で軽い目標だけにして、仕上げに全部で測る。

## 目標を変える

`targets.ts` の `TARGETS`。目標はユーザーの意図（`.docs/game-spec.md`）から決める。今の目標は「最初は0層を突破できず、街と探索をくり返して育てると突破できる」。`tune` の指定は `builder/tunings/` に置く。

## 踏破後の再挑戦

`vp exec bun builder/post-clear.ts 5` で初期状態から最大60出撃まで通常の街・探索を回し、踏破後の保存から各層を再戦する。レベル・資産を付与しない。各層は同じ踏破後の保存から分岐し、他の再戦の育成・報酬を持ち込まない。最深層は初回の再戦後に、街の育成・修理・補給と通常の撤退判断を使って最大8回まで再挑戦する。JSON行の `status: ready` が全員生還の依頼達成。`aliveAfterReturn` は全滅時の復帰を含むため、達成判定には使わない。自動方策の測定で、最適プレイや人の体感を保証しない。
