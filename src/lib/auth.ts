import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { getDatabase } from "@/db";
import * as databaseSchema from "@/db/schema";
import { portfolio, userProfile } from "@/db/schema";

function createAuthentication() {
  const authenticationSecret = process.env.BETTER_AUTH_SECRET;
  const authenticationUrl = process.env.BETTER_AUTH_URL;

  if (!authenticationSecret || !authenticationUrl) {
    throw new Error(
      "BETTER_AUTH_SECRET e BETTER_AUTH_URL precisam estar configuradas.",
    );
  }

  return betterAuth({
    appName: "Investidor Novo",
    baseURL: authenticationUrl,
    secret: authenticationSecret,
    database: drizzleAdapter(getDatabase(), {
      provider: "pg",
      schema: databaseSchema,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            const database = getDatabase();
            await database.batch([
              database
                .insert(userProfile)
                .values({ userId: createdUser.id })
                .onConflictDoNothing(),
              database
                .insert(portfolio)
                .values({ userId: createdUser.id })
                .onConflictDoNothing(),
            ]);
          },
        },
      },
    },
    plugins: [nextCookies()],
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
  });

}

type Authentication = ReturnType<typeof createAuthentication>;

let authenticationInstance: Authentication | undefined;

export function getAuthentication(): Authentication {
  if (!authenticationInstance) {
    authenticationInstance = createAuthentication();
  }

  return authenticationInstance;
}
