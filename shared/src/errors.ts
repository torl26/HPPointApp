import type { HPErrorCode } from "./types";

export const HP_OK: HPErrorCode = 0x0000_0000;

//hpValidate
export const HP_ERR_VALIDATE_RULE: HPErrorCode = 0xC043_0001;
export const HP_ERR_VALIDATE_INPUT: HPErrorCode = 0xC043_0002;
export const HP_ERR_VALIDATE_ARGUMENT: HPErrorCode = 0xC043_0003;

//hpEventQRIssue
export const HP_ERR_EVENTQR_ARG: HPErrorCode = 0xC045_0001; // 引数エラー
export const HP_ERR_EVENTQR_TARGET: HPErrorCode = 0xC045_0002; // 対象外のイベント（存在しない・中止)
export const HP_ERR_EVENTQR_DB: HPErrorCode = 0xC045_0003; //DBエラー
