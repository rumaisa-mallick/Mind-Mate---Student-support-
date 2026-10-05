/**
 * The ONLY module that imports the Prisma client.
 *
 * Everything else in the app goes through `src/server/**` services or the pure
 * `src/domain/**` modules, so switching SQLite → Postgres touches this file
 * (and repositories) only — docs/PLAN.md §3.1, §13.
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

// Reuse the client across hot reloads in dev so we don't exhaust connections.
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
