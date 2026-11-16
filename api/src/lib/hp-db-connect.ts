import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import {
  HP_OK,
  HP_ERR_DB_ARG,
  HP_ERR_DB_CONNECT,
  HP_ERR_DB_TRANSACTION,
  HP_ERR_DB_TIMEOUT,
  type HPErrorCode,
  type HPContext,
} from "@hp-point/shared";

// --------------------------------------------------
// 定数定義（マジックナンバーの排除）
// --------------------------------------------------
// タイムアウト時間（ミリ秒）
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_TRANSACTION_TIMEOUT_MS = 15000;

// --------------------------------------------------
// 内部型定義
// --------------------------------------------------
type TransactionControl = {
  readonly resolve: () => void;
  readonly reject: (reason?: unknown) => void;
  readonly promise: Promise<void>;
};

type DbConnectionState = {
  refCount: number;
  hasTransaction: boolean;
  txControl: TransactionControl | null;
  txClient: Prisma.TransactionClient | null;
};

// --------------------------------------------------
// 状態管理
// --------------------------------------------------
// 接続オブジェクトごとに参照カウントとトランザクション状態を安全に保持するため WeakMap を使用する
const connectionStateMap = new WeakMap<object, DbConnectionState>();

// Next.js (App Router) の HMR やリクエスト間でコネクションプールを再利用するためのグローバルキャッシュ
type GlobalWithPrisma = typeof globalThis & {
  hpPrismaClient?: PrismaClient;
};

/**
 * 共有の PrismaClient インスタンスを取得する。
 * 接続先情報は環境変数 DATABASE_URL から読み込み、コード内には直接保持しない。
 */
const getSharedPrismaClient = (): PrismaClient => {
  const globalRef = globalThis as GlobalWithPrisma; // HMR環境下で同一インスタンスを共有するための型キャスト
  if (globalRef.hpPrismaClient) {
    return globalRef.hpPrismaClient;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: DEFAULT_CONNECT_TIMEOUT_MS,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalRef.hpPrismaClient = client;
  }

  return client;
};

/**
 * トランザクション内外で透過的にクエリを委譲する Proxy を生成する。
 * 各業務モジュールが ctx.db.account.findUnique(...) などの Prisma メソッドをそのまま利用できるようにする。
 */
const createDbProxy = (
  state: DbConnectionState,
  baseClient: PrismaClient
): object => {
  return new Proxy(baseClient, {
    get(target, prop, receiver) {
      // トランザクション中であれば txClient に、未開始であれば baseClient に委譲する
      const activeClient = state.txClient ?? target;
      const value = Reflect.get(activeClient, prop, receiver);
      if (typeof value === "function") {
        return value.bind(activeClient);
      }
      return value;
    },
  });
};

/**
 * エラーオブジェクトからタイムアウト起因であるかを判定する。
 */
const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("p2024") ||
      message.includes("p2028")
    );
  }
  return false;
};

// --------------------------------------------------
// 公開モジュール関数（共通 41）
// --------------------------------------------------

/**
 * DBへ接続し、コンテキストに接続インスタンスを設定する。
 * 既に接続済みの場合は新しく接続せず参照カウントを1増やす。
 *
 * @param ctx 実行コンテキスト (IN/OUT)
 * @returns 処理結果コード (0x0000_0000: 成功, 0xC041_0001: 引数エラー, 0xC041_0002: 接続失敗, 0xC041_0004: タイムアウト)
 */
export async function hpDbConnect(ctx: HPContext): Promise<HPErrorCode> {
  // 引数検証
  if (!ctx) {
    return HP_ERR_DB_ARG;
  }

  // 既に接続済みの場合は多重接続せず参照カウントを加算して使い回す
  if (ctx.db !== null && typeof ctx.db === "object") {
    const existingState = connectionStateMap.get(ctx.db);
    if (existingState) {
      existingState.refCount += 1;
      return HP_OK;
    }
  }

  try {
    const client = getSharedPrismaClient();

    // 接続の疎通確認を兼ねて単純クエリを実行する
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout")),
          DEFAULT_CONNECT_TIMEOUT_MS
        )
      ),
    ]);

    const state: DbConnectionState = {
      refCount: 1,
      hasTransaction: false,
      txControl: null,
      txClient: null,
    };

    const proxyInstance = createDbProxy(state, client);
    connectionStateMap.set(proxyInstance, state);

    // 設計書の仕様に従い ctx.db に接続オブジェクトを格納
    ctx.db = proxyInstance as unknown; // shared型定義 (HPDb = unknown) に合わせるための安全なキャスト

    return HP_OK;
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      return HP_ERR_DB_TIMEOUT;
    }
    return HP_ERR_DB_CONNECT;
  }
}

/**
 * トランザクションを開始する。
 *
 * @param ctx 実行コンテキスト (IN)
 * @returns 処理結果コード (0x0000_0000: 成功, 0xC041_0001: 引数エラー, 0xC041_0003: トランザクション操作エラー)
 */
export async function hpDbBegin(ctx: HPContext): Promise<HPErrorCode> {
  if (!ctx || ctx.db === null || typeof ctx.db !== "object") {
    return HP_ERR_DB_ARG;
  }

  const state = connectionStateMap.get(ctx.db);
  if (!state || state.hasTransaction) {
    // 未接続または二重のトランザクション開始は操作エラー
    return HP_ERR_DB_TRANSACTION;
  }

  try {
    const client = getSharedPrismaClient();

    let txResolve!: () => void;
    let txReject!: (reason?: unknown) => void;
    const txPromise = new Promise<void>((resolve, reject) => {
      txResolve = resolve;
      txReject = reject;
    });

    let clientReadyResolve!: (tx: Prisma.TransactionClient) => void;
    const clientReadyPromise = new Promise<Prisma.TransactionClient>(
      (resolve) => {
        clientReadyResolve = resolve;
      }
    );

    // Prisma の対話型トランザクションを開始し、commit/rollback が呼ばれるまで保持する
    const transactionExecution = client.$transaction(
      async (tx) => {
        clientReadyResolve(tx);
        await txPromise;
      },
      {
        timeout: DEFAULT_TRANSACTION_TIMEOUT_MS,
        maxWait: DEFAULT_CONNECT_TIMEOUT_MS,
      }
    );

    // トランザクションクライアントの準備完了を待機
    const activeTxClient = await Promise.race([
      clientReadyPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Transaction begin timeout")),
          DEFAULT_CONNECT_TIMEOUT_MS
        )
      ),
    ]);

    state.hasTransaction = true;
    state.txClient = activeTxClient;
    state.txControl = {
      resolve: txResolve,
      reject: txReject,
      promise: transactionExecution,
    };

    return HP_OK;
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      return HP_ERR_DB_TIMEOUT;
    }
    return HP_ERR_DB_TRANSACTION;
  }
}

/**
 * トランザクションをコミット（確定）する。
 *
 * @param ctx 実行コンテキスト (IN)
 * @returns 処理結果コード (0x0000_0000: 成功, 0xC041_0001: 引数エラー, 0xC041_0003: トランザクション操作エラー)
 */
export async function hpDbCommit(ctx: HPContext): Promise<HPErrorCode> {
  if (!ctx || ctx.db === null || typeof ctx.db !== "object") {
    return HP_ERR_DB_ARG;
  }

  const state = connectionStateMap.get(ctx.db);
  if (!state || !state.hasTransaction || !state.txControl) {
    // トランザクションが開始されていない状態での確定は操作エラー
    return HP_ERR_DB_TRANSACTION;
  }

  try {
    state.txControl.resolve();
    await state.txControl.promise;
    return HP_OK;
  } catch {
    return HP_ERR_DB_TRANSACTION;
  } finally {
    state.hasTransaction = false;
    state.txClient = null;
    state.txControl = null;
  }
}

/**
 * トランザクションをロールバック（取り消し）する。
 *
 * @param ctx 実行コンテキスト (IN)
 * @returns 処理結果コード (0x0000_0000: 成功, 0xC041_0001: 引数エラー, 0xC041_0003: トランザクション操作エラー)
 */
export async function hpDbRollback(ctx: HPContext): Promise<HPErrorCode> {
  if (!ctx || ctx.db === null || typeof ctx.db !== "object") {
    return HP_ERR_DB_ARG;
  }

  const state = connectionStateMap.get(ctx.db);
  if (!state || !state.hasTransaction || !state.txControl) {
    // トランザクションが開始されていない状態でのロールバックは操作エラー
    return HP_ERR_DB_TRANSACTION;
  }

  try {
    state.txControl.reject(new Error("hpDbRollback requested"));
    await state.txControl.promise.catch(() => {
      // ロールバックによる例外は正常なフローとして受ける
    });
    return HP_OK;
  } catch {
    return HP_ERR_DB_TRANSACTION;
  } finally {
    state.hasTransaction = false;
    state.txClient = null;
    state.txControl = null;
  }
}

/**
 * DB接続を解放する。
 * 参照カウントを1減らし、0になった場合のみ未確定トランザクションをロールバックして切断する。
 * 未接続の状態で呼ばれてもエラーにしない。
 *
 * @param ctx 実行コンテキスト (IN/OUT)
 * @returns 処理結果コード (0x0000_0000: 成功, 0xC041_0001: 引数エラー)
 */
export async function hpDbClose(ctx: HPContext): Promise<HPErrorCode> {
  // 未指定は引数エラー
  if (!ctx) {
    return HP_ERR_DB_ARG;
  }

  // 設計書制約: 未接続のまま呼ばれてもエラーにせず成功を返す（Dispose から常に呼べるようにするため）
  if (ctx.db === null || typeof ctx.db !== "object") {
    return HP_OK;
  }

  const state = connectionStateMap.get(ctx.db);
  if (!state) {
    ctx.db = null;
    return HP_OK;
  }

  state.refCount -= 1;

  // 呼び出し元のモジュールがまだ接続を使用している場合は切断しない
  if (state.refCount > 0) {
    return HP_OK;
  }

  // 参照カウントが 0 に達したため完全クローズ
  try {
    if (state.hasTransaction && state.txControl) {
      // 未確定トランザクションは安全のため自動ロールバック
      state.txControl.reject(new Error("Auto-rollback on hpDbClose"));
      await state.txControl.promise.catch(() => {});
    }
  } finally {
    connectionStateMap.delete(ctx.db);
    ctx.db = null;
  }

  return HP_OK;
}
