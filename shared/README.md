# 共通の入力チェック hpValidate：仕様補足と使い方

`hpValidate` は項目別のルールを受け取り、全項目の誤りを `result.errors` に書き込む同期関数です。DB接続・認証・現在時刻の取得は行いません。

この文書は「詳細設計.md」の入力チェック（共通43）に対する、合意済みの仕様補足です。詳細設計の7種類に加え、呼び出し元の要件を共通側で検査するため、`pattern`・`month`・`boolean` を追加しています。

セキュリティレビュー後の合意により、`pattern` は任意のRegExpから名前指定に変更し、引数エラー `0xC043_0003` を追加しました。詳細設計.mdは変更せず、合意済みの拡張と実装上の取り決めをこの文書に記録します。設計書との差分は末尾にまとめています。

## 利用例

```typescript
import { HP_OK, hpValidate } from "@hp-point/shared";
import type { HPRuleSet, HPValidateResult } from "@hp-point/shared";

const rules: HPRuleSet = {
  totpCode: [
    { kind: "required" },
    { kind: "minLength", min: 6 },
    { kind: "maxLength", max: 6 },
    { kind: "pattern", pattern: "totp" },
  ],
};
const result: HPValidateResult = { errors: [] };
const code = hpValidate({ totpCode: "012345" }, rules, result);
if (code !== HP_OK) {
  // result.errorsのfieldとruleを使って表示する。
}
```

`HPRule` は `kind` の値に応じて必要な項目が変わる型です。例えば `minLength` では `min`、`pattern` では `pattern` が必要です。Cのタグ付き共用体に似ています。

## ルールと挙動

| kind | 設定 | 検査内容 |
|---|---|---|
| required | なし | undefined・null・空文字ではない |
| minLength | min | 文字列の文字数がmin以上 |
| maxLength | max | 文字列の文字数がmax以下 |
| email | なし | 空白を含まない `名前@ドメイン.末尾` の基本形式 |
| date | なし | YYYY-MM-DDの実在する日付（西暦0001〜9999年） |
| intRange | min, max | 数値型の安全な整数で、min以上max以下 |
| oneOf | values: string[] | 指定した文字列のいずれかと完全一致 |
| pattern | pattern: HPValidationPattern | 下記の名前で指定した形式の文字列 |
| month | なし | YYYY-MMの有効な年月（西暦0001〜9999年） |
| boolean | なし | trueまたはfalse |

- 空値は `undefined`・`null`・`""`。任意項目が空ならほかのルールを省略します。必須項目が空なら、満たさないすべてのルールを報告します。
- 空白の削除・小文字化・数値への変換はしません。`0`・`false`・空白だけの文字列は空値ではありません。
- 文字数はUnicodeコードポイント単位です。単体の絵文字は1文字ですが、結合文字や複数文字で構成された絵文字は複数として数えます。
- 入力とルールは変更しません。`result.errors` は毎回初期化し、項目順・ルール順に結果を格納します。ルールにない項目は検査しません。
- ルール定義は入力より先にすべて検査します。文字数の下限・上限は0以上の安全な整数、整数範囲は安全な整数のmin・maxとし、`min <= max` を満たすように指定します。`oneOf.values` は1個以上の文字列が必要です。
- 安全な整数は `Number.MIN_SAFE_INTEGER` 以上 `Number.MAX_SAFE_INTEGER` 以下です。値とルールの上下限に `Number.isSafeInteger` を使います。
- `pattern` にRegExpや正規表現の文字列を渡すと、実行せずルール定義エラーにします。新しい形式が必要な場合は、共通側で検査処理・型・テスト・この仕様補足を更新します。
- `email` は基本的な形式チェックであり、メールの到達確認やRFCの全構文の検査は行いません。
- TOTPの正しさ、対象月が未来でないこと、入力値のDB上の存在などは呼び出し元が検査します。

| patternの名前 | 検査内容 |
|---|---|
| totp | ASCII数字6文字。先頭の0も保持する |
| uuid | 8-4-4-4-12桁の16進数とハイフンからなる36文字。大文字・小文字を許可する。バージョンの限定や存在確認はしない |
| hex64 | 16進数64文字。大文字・小文字を許可する |
| imageKey | `incoming/` で始まる一時キーの最低限の構造検査。空・空白だけの名前、空の区切り、単独の `.`・`..`、バックスラッシュ、制御文字を拒否する |

`totp`・`uuid`・`hex64` は名前指定だけで長さと形式を検査します。一時画像キーの構造は `{ kind: "pattern", pattern: "imageKey" }` で検査できます。

`imageKey` は一時キー `tempKey` 向けの最低限の検査です。`incoming/` の後が空・空白だけの値、`incoming//photo.jpg` のような空の区切り、`incoming/../secret` のような単独の `.`・`..` の区間、バックスラッシュ、改行（U+2028・U+2029を含む）、制御文字（U+0000〜001F・U+007F〜009F）を拒否します。不正な入力を削除・正規化して修復することはありません。

`incoming/user123/photo.jpg` などの通常の階層は許可し、UUID・拡張子・最大長はここでは固定しません。生成形式は画像担当の仕様確定後に確認します。URLエンコードの扱いも未確定で、この検査ではデコードしません。`%2e%2e` などを後段でデコードする場合の安全性、所有者・有効期限・存在確認は保証しません。呼び出し元・画像保管側で別途確認が必要です。本保存後の `imageKey` にも同じ形式を要求するものではありません。

メールは文字列検索で検査し、名前指定のパターンは固定長検査・固定の正規表現・一時キーの構造検査だけを行います。長さ違反があっても全ルールのエラー収集は維持します。文字数は配列化せず、必要な長さまで数えます。HTTPリクエスト全体のサイズ制限は、呼び出すAPI側で設定してください。

## 引数の契約

```typescript
function hpValidate(input: object, rules: HPRuleSet, result: HPValidateResult): HPErrorCode
```

- `input` は通常のinterfaceで定義した値をそのまま渡せます。実行時には、通常のデータオブジェクト、またはプロトタイプがnullのデータオブジェクトだけを受け付けます。
- 入力全体のnull・undefined・配列・Date・Map・クラスのインスタンス・getter/setterを持つオブジェクトは引数エラーです。項目の値がnull・undefinedの場合は、上記の空値ルールに従います。
- `rules` と各ルールもデータオブジェクトが必要です。Date・Map・getter/setter付きの定義はルール定義エラーにします。
- `rules` は呼び出し元のコードで定義してください。HTTP入力に含まれるルールをそのまま採用しないでください。
- `result` には、書き換え可能な自身のデータプロパティ `errors` が必要です。`{ errors: [] }` を用意してください。未指定・null・凍結済みなどの出力先は引数エラーです。
- 判定順序は、出力先の検査と初期化、全ルールの定義検査、入力全体の検査、各項目の検査です。出力先が有効なら、引数・ルール定義のエラー時に `errors` は空になります。出力先自体が不正なら書き換えません。
- getterを実行せず検査します。メタデータ取得などで発生する例外も引数・ルール定義エラーへ変換します。呼び出し元が任意の処理を実行するProxyを渡す使い方は想定していません。

## 戻り値

| 定数 | 値 | 内容 |
|---|---|---|
| HP_OK | 0x0000_0000 | 誤りなし |
| HP_ERR_VALIDATE_RULE | 0xC043_0001 | ルール定義の誤り。errorsは空 |
| HP_ERR_VALIDATE_INPUT | 0xC043_0002 | 入力値の誤り。errorsに1件以上 |
| HP_ERR_VALIDATE_ARGUMENT | 0xC043_0003 | 入力全体または出力先の形が不正 |

呼び出し元は入力値エラーを自分のモジュールのコードへ読み替えます。ルール定義エラーと引数エラーは区別します。入力全体の引数エラーは各APIの引数不正応答へ対応させ、出力先の不正は呼び出し側の実装を修正してください。

## 確認コマンド

リポジトリのルートで実行します。追加ライブラリは不要です。

```bash
npm run typecheck
npm test -w @hp-point/shared
```

ルートの型チェックにはsharedも含まれます。テストには既存のTypeScriptコンパイラとNode.js標準のテスト機能を使い、生成ファイルは `.test-build/` に出力します。

CIでもsharedのテストを実行します。長いメールと危険なRegExpの回帰テストは、同期処理の停止に備えて時間制限付きの別プロセスで実行します。

## 詳細設計.mdとの相違点

共通43の記載と、合意済みの実装の違いを整理します。設計書本体は編集しません。

1. 実装では入力の型を `Record<string, unknown>` から `object` に広げ、実行時にデータオブジェクトを検査します。
2. `HPValidationPattern` と名前指定の `pattern`、`month`、`boolean` をHPRuleに追加しています。
3. 戻り値に `HP_ERR_VALIDATE_ARGUMENT = 0xC043_0003` を追加しています。引数の契約と判定順序は上記のとおりです。
4. 空値、文字数、安全な整数、実在日、結果の初期化、各ルール引数の制約は上記のとおりです。
5. TOTPの照合や現在日との比較、HTTPサイズ制限などは呼び出し元が担当します。
