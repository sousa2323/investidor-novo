import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as databaseSchema from "@/db/schema";

let databaseInstance: NeonHttpDatabase<typeof databaseSchema> | undefined;

export function getDatabase(): NeonHttpDatabase<typeof databaseSchema> {
  if (databaseInstance) {
    return databaseInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL não configurada. Defina a conexão do Neon em .env.local.",
    );
  }

  const sqlClient = neon(databaseUrl);
  databaseInstance = drizzle(sqlClient, { schema: databaseSchema });

  return databaseInstance;
}
