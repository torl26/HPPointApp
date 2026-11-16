import  { randomBytes } from "node:crypto";
import {
    HP_OK, HP_ERR_EVENTQR_ARG, HP_ERR_EVENTQR_TARGET, HP_ERR_EVENTQR_DB,
    type HPAccountType, type HPErrorCode, type HPEventQrResult
} from "@hp-point/shared";
import type { HPApiContext } from "@/types/context";
import  { hpPasswordHash } from "@/lib/password";

const TERMINAL: HPAccountType = "terminal";

export async function hpEventQRIssue(
    ctx:     HPApiContext,         // 実行コンテキスト：DB接続・操作者 (IN)
    eventId: number,            // 対象イベント (IN)
    result:  HPEventQrResult    // 発行結果 (OUT)
): Promise<HPErrorCode>{
    if(!ctx.db || !Number.isInteger(eventId) || eventId <= 0){
        return HP_ERR_EVENTQR_ARG;
    }
    try{
        // 1. t_event を読み、存在しない・中止なら 0xC024_0002
        const event = await ctx.db.event.findUnique({
            where: { eventId },
            select: { eventId: true, status: true },
        });
        if(!event || event.status === "中止"){
            return HP_ERR_EVENTQR_TARGET;
        };
        
        // 2. そのイベントの古い受付端末アカウントを無効にする
        await ctx.db.account.updateMany({
            where: { accountType: TERMINAL, eventId, status: "有効"},
            data: { status: "無効"},
        });

        // 3. ログインIDと初期パスワードを乱数で作り、t_account に追加（ハッシュで保存）
        const loginId = `ev${eventId}-${randomBytes(4).toString("hex")}`;
        const initialPassword = randomBytes(9).toString("base64url");
        await ctx.db.account.create({
            data: {
                loginId,
                passwordHash: await hpPasswordHash(initialPassword),
                accountType: TERMINAL,
                eventId,
            },
        });

        // 4. ログイン画面のパス（ログインID入り・パスワードなし）を t_event.event_qr に保存
        const qrPath = `/terminal/login?loginId=${encodeURIComponent(loginId)}`;
        await ctx.db.event.update({
            where: { eventId },
            data: { eventQr: qrPath },
        });

        // 5. result に入れて成功を返す
        result.loginId = loginId;
        result.initialPassword = initialPassword;
        result.qrText = `${process.env.CLIENT_BASE_URL ?? ""}${qrPath}`;
        return HP_OK;
    }catch {
        return HP_ERR_EVENTQR_DB; // ロールバックは呼び出し元（hpEventManageBody）
    }

}
