import { HP_OK, HP_ERR_VALIDATE_RULE, HP_ERR_VALIDATE_INPUT, HP_ERR_VALIDATE_ARGUMENT } from "./errors";
import type { HPErrorCode, HPRule, HPRuleSet, HPValidateResult, HPValidationPattern } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return (
      (prototype === Object.prototype || prototype === null) &&
      Object.values(Object.getOwnPropertyDescriptors(value)).every((property) => "value" in property)
    );
  } catch {
    return false;
  }
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isValidRule(rule: unknown): rule is HPRule {
  if (!isRecord(rule)) {
    return false;
  }

  switch (rule.kind) {
    case "required":
    case "email":
    case "date":
    case "month":
    case "boolean":
      return true;
    case "minLength":
      return isInteger(rule.min) && rule.min >= 0;
    case "maxLength":
      return isInteger(rule.max) && rule.max >= 0;
    case "intRange":
      return isInteger(rule.min) && isInteger(rule.max) && rule.min <= rule.max;
    case "oneOf":
      return (
        Array.isArray(rule.values) &&
        rule.values.length > 0 &&
        Array.from(rule.values).every((value) => typeof value === "string")
      );
    case "pattern":
      return rule.pattern === "totp" || rule.pattern === "uuid" ||
        rule.pattern === "hex64" || rule.pattern === "imageKey";
    default:
      return false;
  }
}

// getterなどを実行せずにルールを検査し、検査済みのデータだけを使う。
function prepareRules(rules: unknown): [string, HPRule[]][] | null {
  try {
    if (!isRecord(rules)) {
      return null;
    }
    const entries: [string, HPRule[]][] = [];
    for (const [field, fieldRules] of Object.entries(rules)) {
      if (!Array.isArray(fieldRules)) {
        return null;
      }
      const copies: HPRule[] = [];
      for (const rule of Array.from(fieldRules)) {
        if (!isRecord(rule)) {
          return null;
        }
        const copy = { ...rule };
        if (copy.kind === "oneOf" && Array.isArray(copy.values)) {
          copy.values = Array.from(copy.values);
        }
        if (!isValidRule(copy)) {
          return null;
        }
        copies.push(copy);
      }
      entries.push([field, copies]);
    }
    return entries;
  } catch {
    return null;
  }
}

function writeErrors(result: unknown, errors: HPValidateResult["errors"]): boolean {
  try {
    if (!isRecord(result)) {
      return false;
    }
    const property = Object.getOwnPropertyDescriptor(result, "errors");
    return property?.writable === true && Reflect.defineProperty(result, "errors", { value: errors });
  } catch {
    return false;
  }
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function isValidYearMonth(year: number, month: number): boolean {
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12;
}

function isDate(value: unknown): boolean {
  if (
    typeof value !== "string" ||
    value.length !== 10 ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!isValidYearMonth(year, month)) {
    return false;
  }

  const isLeapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function isMonth(value: unknown): boolean {
  if (
    typeof value !== "string" ||
    value.length !== 7 ||
    !/^[0-9]{4}-[0-9]{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month] = value.split("-").map(Number);
  return isValidYearMonth(year, month);
}

function hasMinLength(value: unknown, min: number): boolean {
  if (typeof value !== "string") {
    return false;
  }
  if (min === 0) {
    return true;
  }
  let length = 0;
  for (const character of value) {
    void character;
    if (++length >= min) {
      return true;
    }
  }
  return false;
}

function hasMaxLength(value: unknown, max: number): boolean {
  if (typeof value !== "string") {
    return false;
  }
  let length = 0;
  for (const character of value) {
    void character;
    if (++length > max) {
      return false;
    }
  }
  return true;
}

function isEmail(value: unknown): boolean {
  if (typeof value !== "string" || /\s/.test(value)) {
    return false;
  }
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) {
    return false;
  }
  // ドメインの先頭・末尾以外にドットがあるかを、後戻りせず確認する。
  const dot = value.indexOf(".", at + 2);
  return dot > at + 1 && dot < value.length - 1;
}

// 一時キーの構造だけを検査し、生成形式や所有者の確認は別途行う。
function isTemporaryImageKey(value: string): boolean {
  const prefix = "incoming/";
  if (!value.startsWith(prefix) || /[\\\u0000-\u001F\u007F-\u009F\u2028\u2029]/.test(value)) {
    return false;
  }

  const suffix = value.slice(prefix.length);
  if (suffix.trim() === "") {
    return false;
  }

  return suffix.split("/").every(
    (segment) => segment !== "" && segment !== "." && segment !== "..",
  );
}

function matchesPattern(value: unknown, pattern: HPValidationPattern): boolean {
  if (typeof value !== "string") {
    return false;
  }
  // 可変長の繰り返しがない、確認済みの検査だけを提供する。
  switch (pattern) {
    case "totp":
      return value.length === 6 && /^[0-9]{6}$/.test(value);
    case "uuid":
      return value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    case "hex64":
      return value.length === 64 && /^[0-9a-f]{64}$/i.test(value);
    case "imageKey":
      return isTemporaryImageKey(value);
  }
}

function satisfiesRule(value: unknown, rule: HPRule): boolean {
  switch (rule.kind) {
    case "required":
      return !isEmpty(value);
    case "minLength":
      return hasMinLength(value, rule.min);
    case "maxLength":
      return hasMaxLength(value, rule.max);
    case "email":
      return isEmail(value);
    case "date":
      return isDate(value);
    case "intRange":
      return isInteger(value) && value >= rule.min && value <= rule.max;
    case "oneOf":
      return typeof value === "string" && rule.values.includes(value);
    case "pattern":
      return matchesPattern(value, rule.pattern);
    case "month":
      return isMonth(value);
    case "boolean":
      return typeof value === "boolean";
  }
}

export function hpValidate(
  input: object,
  rules: HPRuleSet,
  result: HPValidateResult,
): HPErrorCode {
  if (!writeErrors(result, [])) {
    return HP_ERR_VALIDATE_ARGUMENT;
  }

  const entries = prepareRules(rules);
  if (entries === null) {
    return HP_ERR_VALIDATE_RULE;
  }
  if (!isRecord(input)) {
    return HP_ERR_VALIDATE_ARGUMENT;
  }

  const errors: HPValidateResult["errors"] = [];
  for (const [field, fieldRules] of entries) {
    let value: unknown;
    try {
      value = Object.getOwnPropertyDescriptor(input, field)?.value;
    } catch {
      return HP_ERR_VALIDATE_ARGUMENT;
    }
    if (isEmpty(value) && !fieldRules.some((rule) => rule.kind === "required")) {
      continue;
    }

    for (const rule of fieldRules) {
      if (!satisfiesRule(value, rule)) {
        errors.push({ field, rule: rule.kind });
      }
    }
  }

  if (!writeErrors(result, errors)) {
    return HP_ERR_VALIDATE_ARGUMENT;
  }
  return errors.length === 0 ? HP_OK : HP_ERR_VALIDATE_INPUT;
}
