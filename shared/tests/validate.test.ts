import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  HP_OK,
  HP_ERR_VALIDATE_RULE,
  HP_ERR_VALIDATE_INPUT,
  HP_ERR_VALIDATE_ARGUMENT,
  hpValidate,
} from "../src";
import type { HPRule, HPRuleSet, HPValidateResult } from "../src";

function validateValue(value: unknown, rules: HPRule[]) {
  const result: HPValidateResult = { errors: [] };
  const code = hpValidate({ value }, { value: rules }, result);
  return { code, result };
}

test("全10種類のルールを公開窓口から利用できる", () => {
  const result: HPValidateResult = { errors: [] };
  const code = hpValidate(
    {
      name: "😀あ",
      email: "member@example.jp",
      birthDate: "2024-02-29",
      age: 20,
      accountType: "citizen",
      totpCode: "012345",
      month: "2026-11",
      notifyEnabled: false,
    },
    {
      name: [{ kind: "required" }, { kind: "minLength", min: 2 }, { kind: "maxLength", max: 2 }],
      email: [{ kind: "email" }],
      birthDate: [{ kind: "date" }],
      age: [{ kind: "intRange", min: 0, max: 120 }],
      accountType: [{ kind: "oneOf", values: ["citizen", "staff"] }],
      totpCode: [{ kind: "pattern", pattern: "totp" }],
      month: [{ kind: "month" }],
      notifyEnabled: [{ kind: "boolean" }],
    },
    result,
  );
  assert.equal(code, HP_OK);
  assert.deepEqual(result.errors, []);
});

test("必須項目ではundefined・null・空文字をエラーにする", () => {
  for (const value of [undefined, null, ""]) {
    const { code, result } = validateValue(value, [{ kind: "required" }]);
    assert.equal(code, HP_ERR_VALIDATE_INPUT);
    assert.deepEqual(result.errors, [{ field: "value", rule: "required" }]);
  }
});

test("任意項目の空値はすべての入力検査を省略する", () => {
  const rules: HPRule[] = [
    { kind: "minLength", min: 1 },
    { kind: "maxLength", max: 2 },
    { kind: "email" },
    { kind: "date" },
    { kind: "intRange", min: 1, max: 2 },
    { kind: "oneOf", values: ["citizen"] },
    { kind: "pattern", pattern: "totp" },
    { kind: "month" },
    { kind: "boolean" },
  ];
  for (const value of [undefined, null, ""]) {
    const { code, result } = validateValue(value, rules);
    assert.equal(code, HP_OK);
    assert.deepEqual(result.errors, []);
  }
});

test("0・false・空白だけの文字列を空値と扱わない", () => {
  for (const value of [0, false, "  "]) {
    assert.equal(validateValue(value, [{ kind: "required" }]).code, HP_OK);
  }
  assert.equal(validateValue(0, [{ kind: "intRange", min: 1, max: 2 }]).code, HP_ERR_VALIDATE_INPUT);
  assert.equal(validateValue(false, [{ kind: "oneOf", values: ["false"] }]).code, HP_ERR_VALIDATE_INPUT);
  assert.equal(validateValue("  ", [{ kind: "maxLength", max: 1 }]).code, HP_ERR_VALIDATE_INPUT);
});

test("文字数はコードポイント単位で数え、境界値を含む", () => {
  for (const value of ["a", "あ", "😀"]) {
    assert.equal(validateValue(value, [
      { kind: "minLength", min: 1 }, { kind: "maxLength", max: 1 },
    ]).code, HP_OK);
  }
  assert.equal(validateValue("😀a", [{ kind: "maxLength", max: 1 }]).code, HP_ERR_VALIDATE_INPUT);
  assert.equal(validateValue("a", [{ kind: "minLength", min: 2 }]).code, HP_ERR_VALIDATE_INPUT);
});

test("メールは基本形式を検査し、前後の空白を削除しない", () => {
  for (const value of ["member@example.jp", "member+tag@example.co.jp"]) {
    assert.equal(validateValue(value, [{ kind: "email" }]).code, HP_OK, value);
  }
  for (const value of ["member", "member@localhost", "@example.jp", "member@@example.jp", " member@example.jp", "member@example.jp\n"]) {
    assert.equal(validateValue(value, [{ kind: "email" }]).code, HP_ERR_VALIDATE_INPUT, value);
  }
});

test("日付は実在日とうるう年を検査する", () => {
  for (const value of ["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "2026-11-15", "9999-12-31"]) {
    assert.equal(validateValue(value, [{ kind: "date" }]).code, HP_OK, value);
  }
  for (const value of ["0000-01-01", "1900-02-29", "2026-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-01-00", "2026-01-32", "2026-1-01", "2026-11-15T00:00:00Z", "2026-11-15\n"]) {
    assert.equal(validateValue(value, [{ kind: "date" }]).code, HP_ERR_VALIDATE_INPUT, value);
  }
});

test("年月はYYYY-MM形式と月の範囲を検査する", () => {
  for (const value of ["0001-01", "2026-11", "9999-12"]) {
    assert.equal(validateValue(value, [{ kind: "month" }]).code, HP_OK, value);
  }
  for (const value of ["0000-01", "2026-00", "2026-13", "2026-1", "2026-11-15", "2026-11\n"]) {
    assert.equal(validateValue(value, [{ kind: "month" }]).code, HP_ERR_VALIDATE_INPUT, value);
  }
});

test("整数範囲は両端を含み、文字列・小数・NaN・無限大を拒否する", () => {
  const rules: HPRule[] = [{ kind: "intRange", min: -1, max: 1 }];
  for (const value of [-1, 0, 1]) {
    assert.equal(validateValue(value, rules).code, HP_OK);
  }
  for (const value of [-2, 2, 0.5, "1", true, NaN, Infinity, -Infinity]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT, String(value));
  }
});

test("整数値とルールの上下限を安全な整数に制限する", () => {
  const rules: HPRule[] = [{
    kind: "intRange", min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER,
  }];
  for (const value of [Number.MIN_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER]) {
    assert.equal(validateValue(value, rules).code, HP_OK);
  }
  const rounded = JSON.parse('{"value":9007199254740993}').value;
  for (const value of [rounded, Number.MIN_SAFE_INTEGER - 1, 1e100]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT);
  }
  for (const rule of [
    { kind: "intRange", min: 0, max: 1e100 },
    { kind: "intRange", min: Number.MIN_SAFE_INTEGER - 1, max: 0 },
    { kind: "minLength", min: Number.MAX_SAFE_INTEGER + 1 },
    { kind: "maxLength", max: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.equal(validateValue(1, [rule as HPRule]).code, HP_ERR_VALIDATE_RULE);
  }
});

test("長さ違反後の長いメール検査でも処理が停止しない", () => {
  // 回帰で同期処理が止まっても、テスト全体を巻き込まないよう別プロセスで実行する。
  const script = `
    const assert = require('node:assert/strict');
    const { hpValidate, HP_ERR_VALIDATE_INPUT } = require(process.argv[1]);
    const result = { errors: [] };
    const code = hpValidate(
      { value: 'a@' + 'a.'.repeat(50000) + '\\n' },
      { value: [{ kind: 'maxLength', max: 255 }, { kind: 'email' }] },
      result,
    );
    assert.equal(code, HP_ERR_VALIDATE_INPUT);
    assert.deepEqual(result.errors.map(error => error.rule), ['maxLength', 'email']);
  `;
  const child = spawnSync(process.execPath, ["-e", script, require.resolve("../src")], {
    encoding: "utf8", timeout: 5000, windowsHide: true,
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr);
});

test("結合文字・複合絵文字はコードポイント単位で検査する", () => {
  assert.equal(validateValue("e\u0301", [{ kind: "maxLength", max: 1 }]).code, HP_ERR_VALIDATE_INPUT);
  assert.equal(validateValue("👨‍👩‍👧‍👦", [
    { kind: "minLength", min: 7 }, { kind: "maxLength", max: 7 },
  ]).code, HP_OK);
  for (const value of ["\n", "\t", "\u3000"]) {
    assert.equal(validateValue(value, [{ kind: "required" }, { kind: "minLength", min: 1 }]).code, HP_OK);
  }
});

test("oneOfは文字列を完全一致で比較する", () => {
  const rules: HPRule[] = [{ kind: "oneOf", values: ["citizen", "staff"] }];
  assert.equal(validateValue("citizen", rules).code, HP_OK);
  for (const value of ["Citizen", " citizen", "shop", 1, false]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT);
  }
});

test("booleanはtrueとfalseを受け付け、変換しない", () => {
  const rules: HPRule[] = [{ kind: "required" }, { kind: "boolean" }];
  for (const value of [true, false]) {
    assert.equal(validateValue(value, rules).code, HP_OK);
  }
  for (const value of ["true", "false", 0, 1, null, undefined, ""]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT);
  }
});

test("文字列用ルールは数値やオブジェクトを文字列へ変換しない", () => {
  const rules: HPRule[] = [
    { kind: "minLength", min: 0 }, { kind: "maxLength", max: 100 },
    { kind: "email" }, { kind: "date" }, { kind: "month" },
    { kind: "pattern", pattern: "totp" },
  ];
  for (const value of [123, true, [], {}]) {
    const { code, result } = validateValue(value, rules);
    assert.equal(code, HP_ERR_VALIDATE_INPUT);
    assert.equal(result.errors.length, rules.length);
  }
});

test("TOTPの先頭のゼロを保持し、数字以外や余分な文字を拒否する", () => {
  const rules: HPRule[] = [
    { kind: "required" },
    { kind: "minLength", min: 6 },
    { kind: "maxLength", max: 6 },
    { kind: "pattern", pattern: "totp" },
  ];
  assert.equal(validateValue("012345", rules).code, HP_OK);
  for (const value of ["12345", "1234567", "abcdef", "１２３４５６", "012345\n", "012345 ", 123456]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT, String(value));
  }
});

test("patternでUUID・16進数・接頭辞を検査できる", () => {
  const uuid: HPRule[] = [
    { kind: "minLength", min: 36 }, { kind: "maxLength", max: 36 },
    { kind: "pattern", pattern: "uuid" },
  ];
  assert.equal(validateValue("550e8400-e29b-41d4-a716-446655440000", uuid).code, HP_OK);
  assert.equal(validateValue("z50e8400-e29b-41d4-a716-446655440000", uuid).code, HP_ERR_VALIDATE_INPUT);
  const hex: HPRule[] = [
    { kind: "minLength", min: 64 }, { kind: "maxLength", max: 64 },
    { kind: "pattern", pattern: "hex64" },
  ];
  assert.equal(validateValue("a".repeat(64), hex).code, HP_OK);
  assert.equal(validateValue("z".repeat(64), hex).code, HP_ERR_VALIDATE_INPUT);
  const prefix: HPRule[] = [{ kind: "pattern", pattern: "imageKey" }];
  assert.equal(validateValue("incoming/photo.jpg", prefix).code, HP_OK);
  assert.equal(validateValue("other/photo.jpg", prefix).code, HP_ERR_VALIDATE_INPUT);
});

test("一時画像キーは通常の階層や未確定の生成形式を制限しない", () => {
  const rules: HPRule[] = [{ kind: "pattern", pattern: "imageKey" }];
  for (const value of [
    "incoming/a",
    "incoming/photo.jpg",
    "incoming/user123/photo.jpg",
    "incoming/user123/2026-11/upload_01",
    "incoming/.hidden",
    "incoming/a..b.HEIC",
    "incoming/" + "a".repeat(500),
  ]) {
    assert.equal(validateValue(value, rules).code, HP_OK, value);
  }
});

test("一時画像キーは接頭辞だけ・空白だけの名前を拒否する", () => {
  const rules: HPRule[] = [{ kind: "pattern", pattern: "imageKey" }];
  for (const value of ["incoming/", "incoming/   ", "incoming/\u3000"]) {
    const { code, result } = validateValue(value, rules);
    assert.equal(code, HP_ERR_VALIDATE_INPUT, JSON.stringify(value));
    assert.deepEqual(result.errors, [{ field: "value", rule: "pattern" }]);
  }
});

test("一時画像キーは単独のドット・二重ドットの区間を拒否する", () => {
  const rules: HPRule[] = [{ kind: "pattern", pattern: "imageKey" }];
  for (const value of [
    "incoming/.",
    "incoming/..",
    "incoming/./photo.jpg",
    "incoming/../secret",
    "incoming/user123/../photo.jpg",
    "incoming/sub/../../secret",
    "incoming/user123/.",
    "incoming/user123/..",
  ]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT, value);
  }
});

test("一時画像キーは空の区切りを拒否する", () => {
  const rules: HPRule[] = [{ kind: "pattern", pattern: "imageKey" }];
  for (const value of [
    "incoming//photo.jpg",
    "incoming///photo.jpg",
    "incoming/user123//photo.jpg",
    "incoming/photo/",
    "incoming/user123/photo.jpg/",
  ]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT, value);
  }
});

test("一時画像キーはバックスラッシュと制御文字を拒否する", () => {
  const rules: HPRule[] = [{ kind: "pattern", pattern: "imageKey" }];
  for (const value of [
    "incoming/..\\secret",
    "incoming/user123\\photo.jpg",
    "incoming/photo.jpg\n",
    "incoming/photo\r\n.jpg",
    "incoming/photo\u2028.jpg",
    "incoming/photo\u2029.jpg",
  ]) {
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT, JSON.stringify(value));
  }
  for (let code = 0; code <= 0x9f; code++) {
    if (code > 0x1f && code < 0x7f) {
      continue;
    }
    const value = "incoming/photo" + String.fromCharCode(code) + ".jpg";
    assert.equal(validateValue(value, rules).code, HP_ERR_VALIDATE_INPUT, JSON.stringify(value));
  }
});

test("一時画像キーは修復せず元の入力に対してエラーを返す", () => {
  const input = Object.freeze({ tempKey: "incoming/../secret" });
  const result: HPValidateResult = { errors: [] };
  assert.equal(hpValidate(input, {
    tempKey: [{ kind: "required" }, { kind: "pattern", pattern: "imageKey" }],
  }, result), HP_ERR_VALIDATE_INPUT);
  assert.deepEqual(result.errors, [{ field: "tempKey", rule: "pattern" }]);
  assert.equal(input.tempKey, "incoming/../secret");
});

test("名前指定のパターンは繰り返し実行しても結果が変わらない", () => {
  const rule: HPRule = { kind: "pattern", pattern: "totp" };
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal(validateValue("012345", [rule]).code, HP_OK);
    assert.equal(validateValue("abcdef", [rule]).code, HP_ERR_VALIDATE_INPUT);
  }
});

test("同一項目の複数エラーも、別項目のエラーも順に収集する", () => {
  const result: HPValidateResult = { errors: [] };
  assert.equal(hpValidate(
    { name: "ab", email: "invalid", birthDate: "2026-02-29" },
    {
      name: [{ kind: "minLength", min: 3 }, { kind: "maxLength", max: 1 }],
      email: [{ kind: "email" }],
      birthDate: [{ kind: "date" }],
    },
    result,
  ), HP_ERR_VALIDATE_INPUT);
  assert.deepEqual(result.errors, [
    { field: "name", rule: "minLength" },
    { field: "name", rule: "maxLength" },
    { field: "email", rule: "email" },
    { field: "birthDate", rule: "date" },
  ]);
});

test("空の必須項目でも、満たさないルールをすべて収集する", () => {
  const { result } = validateValue("", [
    { kind: "required" }, { kind: "minLength", min: 8 }, { kind: "email" },
  ]);
  assert.deepEqual(result.errors.map((error) => error.rule), ["required", "minLength", "email"]);
});

test("結果を再利用しても前回のエラーを残さない", () => {
  const result: HPValidateResult = { errors: [] };
  const rules: HPRuleSet = { value: [{ kind: "required" }] };
  assert.equal(hpValidate({}, rules, result), HP_ERR_VALIDATE_INPUT);
  assert.equal(hpValidate({ value: "ok" }, rules, result), HP_OK);
  assert.deepEqual(result.errors, []);
});

test("入力とルールを変更せず、未定義の項目は検査しない", () => {
  const input = Object.freeze({ value: "  ok  ", extra: 123 });
  const rules: HPRuleSet = { value: [{ kind: "minLength", min: 6 }] };
  Object.freeze(rules.value[0]);
  Object.freeze(rules.value);
  Object.freeze(rules);
  const result: HPValidateResult = { errors: [] };
  assert.equal(hpValidate(input, rules, result), HP_OK);
  assert.deepEqual(input, { value: "  ok  ", extra: 123 });
});

test("空のルールは成功し、継承された入力項目を必須値とみなさない", () => {
  const result: HPValidateResult = { errors: [] };
  const requiredRule: HPRule = { kind: "required" };
  assert.equal(hpValidate({}, {}, result), HP_OK);
  assert.equal(hpValidate({}, { toString: [requiredRule] }, result), HP_ERR_VALIDATE_INPUT);
  assert.deepEqual(result.errors, [{ field: "toString", rule: "required" }]);
});

test("不正なルールは入力検査より先に検出し、結果を初期化する", () => {
  const invalidRules: unknown[] = [
    null, [], 1, new Date(), new Map(),
    { value: null }, { value: {} }, { value: [null] }, { value: [{}] },
    { value: [{ kind: "unknown" }] },
    { value: [{ kind: "minLength" }] },
    { value: [{ kind: "minLength", min: -1 }] },
    { value: [{ kind: "minLength", min: 1.5 }] },
    { value: [{ kind: "maxLength", max: "10" }] },
    { value: [{ kind: "maxLength", max: NaN }] },
    { value: [{ kind: "intRange", min: 10, max: 1 }] },
    { value: [{ kind: "intRange", min: 0, max: Infinity }] },
    { value: [{ kind: "intRange", min: 0.5, max: 1 }] },
    { value: [{ kind: "oneOf", values: [] }] },
    { value: [{ kind: "oneOf", values: [1] }] },
    { value: [{ kind: "oneOf", values: Array(1) }] },
    { value: [{ kind: "pattern", pattern: "[0-9]" }] },
    { value: [{ kind: "pattern", pattern: /^[0-9]{6}$/ }] },
    { value: [{ kind: "pattern", pattern: /^(a+)+$/ }] },
    { value: Array(1) },
    { first: [{ kind: "required" }], value: [{ kind: "unknown" }] },
  ];
  for (const rules of invalidRules) {
    const result: HPValidateResult = { errors: [{ field: "old", rule: "required" }] };
    // 実行時に不正なルールが渡された場合を意図的に再現する。
    assert.equal(hpValidate({}, rules as HPRuleSet, result), HP_ERR_VALIDATE_RULE);
    assert.deepEqual(result.errors, []);
  }
});

test("interfaceで定義した入力をそのまま渡せる", () => {
  interface HPUserInput {
    name?: string;
    email?: string;
  }
  const input: HPUserInput = { name: "市民", email: "member@example.jp" };
  const result: HPValidateResult = { errors: [] };
  assert.equal(hpValidate(input, {
    name: [{ kind: "required" }], email: [{ kind: "email" }],
  }, result), HP_OK);
});

test("入力全体のnull・配列・クラスなどを引数エラーにする", () => {
  const inputs: unknown[] = [
    undefined, null, "value", 123, true, [], new Date(), new Map(),
    Object.create({ value: "inherited" }),
  ];
  const ruleSets: HPRuleSet[] = [{}, { value: [{ kind: "required" }] }];
  for (const input of inputs) {
    for (const rules of ruleSets) {
      const result: HPValidateResult = { errors: [{ field: "old", rule: "required" }] };
      assert.equal(hpValidate(input as object, rules, result), HP_ERR_VALIDATE_ARGUMENT);
      assert.deepEqual(result.errors, []);
    }
  }
});

test("不正な出力先を例外にせず、引数エラーにする", () => {
  const results: unknown[] = [
    undefined, null, [], new Date(), {},
    Object.freeze({ errors: [] }), Object.preventExtensions({}),
  ];
  for (const result of results) {
    assert.equal(hpValidate({}, {}, result as HPValidateResult), HP_ERR_VALIDATE_ARGUMENT);
  }
  const sealed = Object.seal({ errors: [] });
  assert.equal(hpValidate({}, {}, sealed), HP_OK);
});

test("getterを呼び出さずに入力・ルール・出力の不正を検出する", () => {
  let getterCalls = 0;
  const accessor = {
    enumerable: true,
    get() { getterCalls++; throw new Error("getter must not run"); },
  };
  const input = Object.defineProperty({}, "value", accessor);
  const rules = Object.defineProperty({}, "value", accessor);
  const rule = Object.defineProperty({}, "kind", accessor);
  const result: HPValidateResult = { errors: [] };
  assert.equal(hpValidate(input, {}, result), HP_ERR_VALIDATE_ARGUMENT);
  assert.equal(hpValidate({}, rules as HPRuleSet, result), HP_ERR_VALIDATE_RULE);
  assert.equal(hpValidate({}, { value: [rule as HPRule] }, result), HP_ERR_VALIDATE_RULE);
  const output = Object.defineProperty({}, "errors", accessor);
  assert.equal(hpValidate({}, {}, output as HPValidateResult), HP_ERR_VALIDATE_ARGUMENT);
  assert.equal(getterCalls, 0);
});

test("失効したProxyのメタデータ検査も例外を外へ出さない", () => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  const result: HPValidateResult = { errors: [] };
  assert.equal(hpValidate(proxy, {}, result), HP_ERR_VALIDATE_ARGUMENT);
  assert.equal(hpValidate({}, proxy as HPRuleSet, result), HP_ERR_VALIDATE_RULE);
  assert.equal(hpValidate({}, {}, proxy as HPValidateResult), HP_ERR_VALIDATE_ARGUMENT);
});

test("プロトタイプのないデータオブジェクトも利用できる", () => {
  const input = Object.assign(Object.create(null), { value: "012345" });
  const rules = Object.assign(Object.create(null), {
    value: [{ kind: "required" }, { kind: "pattern", pattern: "totp" }],
  });
  const result = Object.assign(Object.create(null), { errors: [] });
  assert.equal(hpValidate(input, rules, result), HP_OK);
});

test("危険な正規表現は長さ制限にかかわらず実行せず拒否する", () => {
  const script = `
    const assert = require('node:assert/strict');
    const { hpValidate, HP_ERR_VALIDATE_RULE } = require(process.argv[1]);
    const result = { errors: [] };
    assert.equal(hpValidate(
      { value: 'a'.repeat(30) + '!' },
      { value: [{ kind: 'maxLength', max: 6 }, { kind: 'pattern', pattern: /^(a+)+$/ }] },
      result,
    ), HP_ERR_VALIDATE_RULE);
    assert.deepEqual(result.errors, []);
  `;
  const child = spawnSync(process.execPath, ["-e", script, require.resolve("../src")], {
    encoding: "utf8", timeout: 5000, windowsHide: true,
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr);
});

test("名前指定だけで各形式の余分な文字や改行を拒否する", () => {
  const cases: { pattern: "totp" | "uuid" | "hex64"; value: string }[] = [
    { pattern: "totp", value: "012345" },
    { pattern: "uuid", value: "550E8400-E29B-41D4-A716-446655440000" },
    { pattern: "hex64", value: "A".repeat(64) },
  ];
  for (const { pattern, value } of cases) {
    const rules: HPRule[] = [{ kind: "pattern", pattern }];
    assert.equal(validateValue(value, rules).code, HP_OK);
    for (const invalid of [value + "\n", " " + value, value.slice(1), "x".repeat(100000)]) {
      assert.equal(validateValue(invalid, rules).code, HP_ERR_VALIDATE_INPUT);
    }
  }
});

test("エラーコードは公開定数として一意に定義されている", () => {
  assert.deepEqual([HP_OK, HP_ERR_VALIDATE_RULE, HP_ERR_VALIDATE_INPUT, HP_ERR_VALIDATE_ARGUMENT], [
    0, 0xC043_0001, 0xC043_0002, 0xC043_0003,
  ]);
});
