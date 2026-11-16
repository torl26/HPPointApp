import type { HPErrorCode } from "./types";

export const HP_OK: HPErrorCode = 0x0000_0000;

//hpDbConnect（共通 41）
export const HP_ERR_DB_ARG: HPErrorCode = 0xC041_0001; // 引数エラー（ctx が未指定）
export const HP_ERR_DB_CONNECT: HPErrorCode = 0xC041_0002; // 接続失敗
export const HP_ERR_DB_TRANSACTION: HPErrorCode = 0xC041_0003; // トランザクション操作エラー（二重の開始、開始前の確定など）
export const HP_ERR_DB_TIMEOUT: HPErrorCode = 0xC041_0004; // タイムアウト

//hpValidate
export const HP_ERR_VALIDATE_RULE: HPErrorCode = 0xC043_0001;
export const HP_ERR_VALIDATE_INPUT: HPErrorCode = 0xC043_0002;
export const HP_ERR_VALIDATE_ARGUMENT: HPErrorCode = 0xC043_0003;

//hpEventQRIssue
export const HP_ERR_EVENTQR_ARG: HPErrorCode = 0xC045_0001; // 引数エラー
export const HP_ERR_EVENTQR_TARGET: HPErrorCode = 0xC045_0002; // 対象外のイベント（存在しない・中止)
export const HP_ERR_EVENTQR_DB: HPErrorCode = 0xC045_0003; //DBエラー
