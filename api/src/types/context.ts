import type { HPContext } from "@hp-point/shared";
import type { Prisma } from "../generated/prisma/client";

// shared の HPContext は db が unknown なので、api の中では Prisma の型に差し替えて使う
export type HPApiContext = Omit<HPContext, "db"> & {
  db: Prisma.TransactionClient;
};