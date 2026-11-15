import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// 保存形式: scrypt$<salt>$<hash>
export async function hpPasswordHash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password,salt,32);
    return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
};