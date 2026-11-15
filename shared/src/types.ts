// 戻り値：0xTTMM_NNNN（TT=種別、MM=モジュール番号、NNNN=連番）
export type HPErrorCode = number;

export type HPAccountType =
  | "citizen"
  | "shop"
  | "organizer"
  | "staff"
  | "terminal";

// unknownは暫定。確認確定したら具体的な型に置き換える
export type HPDb = unknown;

// 操作者：hpAuth（セッション確認）が設定する。
export interface HPOperator {
  accountId: number;
  accountType: HPAccountType;
  userId?: number; // 市民のとき（t_user）
  staffId?: number; // 市職員・主催者のとき（t_staff）
  shopId?: number; // 加盟店のとき（t_shop）
  eventId?: number; // 受付端末のとき（対象イベント）
}

// 実行コンテキスト：全モジュールの第1引数。
export interface HPContext {
  db: HPDb | null; // hpDbConnect が設定する。
  // Cookie のセッションID、または市民アプリのアクセストークン（t_session のID）。
  sessionId: string | null;
  client: "web" | "app" | null; // API の入口で設定する。バッチは null。
  operator: HPOperator | null; // 認証前・バッチ起動のときは null。
  now: Date; // 処理日時。1回の呼び出しの間は固定する。
  isBatch: boolean; // 定時バッチから起動されたか。
}
