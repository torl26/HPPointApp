export type HPErrorCode = number;

export const HP_OK = 0x0000_0000;

//hpEventQRIssue
export const HP_ERR_EVENTQR_ARG = 0xC045_0001; // 引数エラー
export const HP_ERR_EVENTQR_TARGET = 0xC045_0002; // 対象外のイベント（存在しない・中止)
export const HP_ERR_EVENTQR_DB = 0xC045_0003; //DBエラー