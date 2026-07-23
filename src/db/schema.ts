import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const assetTypeEnum = pgEnum("asset_type", ["STOCK", "FII"]);
export const riskProfileEnum = pgEnum("risk_profile", [
  "CONSERVATIVE",
  "MODERATE",
  "AGGRESSIVE",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "COMPRA",
  "VENDA",
  "DIVIDENDO",
  "JCP",
  "RENDIMENTO_FII",
  "AMORTIZACAO",
]);
export const plannerEntryTypeEnum = pgEnum("planner_entry_type", [
  "RECEITA",
  "DESPESA_MENSAL",
  "DESPESA_ANUAL",
  "INVESTIMENTO_PLANEJADO",
]);
export const ingestionStatusEnum = pgEnum("ingestion_status", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_index").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("account_user_id_index").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_index").on(table.identifier)],
);

export const userProfile = pgTable("user_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  riskProfile: riskProfileEnum("risk_profile").default("MODERATE").notNull(),
  monthlyContributionPercentage: integer("monthly_contribution_percentage")
    .default(20)
    .notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const asset = pgTable(
  "asset",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticker: text("ticker").notNull(),
    type: assetTypeEnum("type").notNull(),
    subType: text("sub_type"),
    name: text("name").notNull(),
    sector: text("sector"),
    segment: text("segment"),
    cnpj: text("cnpj"),
    isin: text("isin"),
    logoUrl: text("logo_url"),
    b3Code: text("b3_code"),
    cvmCode: text("cvm_code"),
    active: boolean("active").default(true).notNull(),
    source: text("source").notNull(),
    sourceDate: timestamp("source_date", { withTimezone: true }).notNull(),
    referencePeriod: text("reference_period"),
    fundamentalsRefreshedAt: timestamp("fundamentals_refreshed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("asset_ticker_type_unique").on(table.ticker, table.type),
    index("asset_type_sector_index").on(table.type, table.sector),
    index("asset_isin_index").on(table.isin),
    index("asset_type_fundamentals_index").on(
      table.type,
      table.fundamentalsRefreshedAt,
    ),
  ],
);

export const assetQuote = pgTable(
  "asset_quote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    dailyVolumeCents: bigint("daily_volume_cents", { mode: "number" }),
    previousCloseCents: bigint("previous_close_cents", { mode: "number" }),
    marketCapCents: bigint("market_cap_cents", { mode: "number" }),
    changePercent: doublePrecision("change_percent"),
    marketDate: date("market_date").notNull(),
    source: text("source").notNull(),
    sourceDate: timestamp("source_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("asset_quote_market_date_unique").on(table.assetId, table.marketDate),
    index("asset_quote_asset_date_index").on(table.assetId, table.marketDate),
  ],
);

export const stockMetric = pgTable(
  "stock_metric",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    dividendYield: doublePrecision("dividend_yield"),
    payout: doublePrecision("payout"),
    roe: doublePrecision("roe"),
    roic: doublePrecision("roic"),
    netDebtToEbitda: doublePrecision("net_debt_to_ebitda"),
    netMargin: doublePrecision("net_margin"),
    profitGrowthFiveYears: doublePrecision("profit_growth_five_years"),
    profitGrowthLabel: text("profit_growth_label"),
    dividendHistoryScore: doublePrecision("dividend_history_score"),
    dividendHistoryLabel: text("dividend_history_label"),
    averageDailyLiquidityCents: bigint("average_daily_liquidity_cents", {
      mode: "number",
    }),
    liquidityLabel: text("liquidity_label"),
    source: text("source").notNull(),
    sourceDate: timestamp("source_date", { withTimezone: true }).notNull(),
    referencePeriod: text("reference_period").notNull(),
    calculationVersion: text("calculation_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stock_metric_asset_period_version_unique").on(
      table.assetId,
      table.referencePeriod,
      table.calculationVersion,
    ),
  ],
);

export const fiiMetric = pgTable(
  "fii_metric",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    priceToBook: doublePrecision("price_to_book"),
    dividendYieldTwelveMonths: doublePrecision("dividend_yield_twelve_months"),
    incomeRegularityScore: doublePrecision("income_regularity_score"),
    averageDailyLiquidityCents: bigint("average_daily_liquidity_cents", {
      mode: "number",
    }),
    riskScore: doublePrecision("risk_score"),
    riskLabel: text("risk_label"),
    vacancyRate: doublePrecision("vacancy_rate"),
    ageYears: doublePrecision("age_years"),
    lastDividendCents: bigint("last_dividend_cents", { mode: "number" }),
    source: text("source").notNull(),
    sourceDate: timestamp("source_date", { withTimezone: true }).notNull(),
    referencePeriod: text("reference_period").notNull(),
    calculationVersion: text("calculation_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("fii_metric_asset_period_version_unique").on(
      table.assetId,
      table.referencePeriod,
      table.calculationVersion,
    ),
  ],
);

export const assetDividend = pgTable(
  "asset_dividend",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    paymentDate: date("payment_date"),
    lastDatePrior: date("last_date_prior"),
    rate: doublePrecision("rate").notNull(),
    label: text("label").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("asset_dividend_unique").on(
      table.assetId,
      table.paymentDate,
      table.label,
      table.rate,
    ),
    index("asset_dividend_asset_date_index").on(table.assetId, table.paymentDate),
  ],
);

export const assetFundamentalSnapshot = pgTable(
  "asset_fundamental_snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("asset_fundamental_snapshot_asset_unique").on(table.assetId),
  ],
);

export const favorite = pgTable(
  "favorite",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.assetId] }),
    index("favorite_user_index").on(table.userId),
  ],
);

export const portfolio = pgTable("portfolio", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").default("Carteira principal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const portfolioTransaction = pgTable(
  "portfolio_transaction",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolio.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => asset.id, { onDelete: "restrict" }),
    ticker: text("ticker").notNull(),
    type: transactionTypeEnum("type").notNull(),
    operationDate: date("operation_date").notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).default("0").notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).default(0).notNull(),
    feesCents: bigint("fees_cents", { mode: "number" }).default(0).notNull(),
    taxesCents: bigint("taxes_cents", { mode: "number" }).default(0).notNull(),
    valueCents: bigint("value_cents", { mode: "number" }).default(0).notNull(),
    broker: text("broker"),
    notes: text("notes"),
    importFingerprint: text("import_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("portfolio_transaction_portfolio_date_index").on(
      table.portfolioId,
      table.operationDate,
    ),
    uniqueIndex("portfolio_transaction_import_fingerprint_unique").on(
      table.portfolioId,
      table.importFingerprint,
    ),
  ],
);

export const portfolioSnapshot = pgTable(
  "portfolio_snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolio.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    investedCents: bigint("invested_cents", { mode: "number" }).notNull(),
    marketValueCents: bigint("market_value_cents", { mode: "number" }).notNull(),
    incomeCents: bigint("income_cents", { mode: "number" }).default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("portfolio_snapshot_date_unique").on(
      table.portfolioId,
      table.snapshotDate,
    ),
  ],
);

export const monthlyFinancialPlan = pgTable(
  "monthly_financial_plan",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceMonth: date("reference_month").notNull(),
    contributionPercentage: integer("contribution_percentage").default(20).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("monthly_plan_user_month_unique").on(
      table.userId,
      table.referenceMonth,
    ),
  ],
);

export const plannerEntry = pgTable(
  "planner_entry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => monthlyFinancialPlan.id, { onDelete: "cascade" }),
    type: plannerEntryTypeEnum("type").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    dueDate: date("due_date"),
    recurring: boolean("recurring").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("planner_entry_plan_type_index").on(table.planId, table.type)],
);

export const importRun = pgTable(
  "import_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolio.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    checksum: text("checksum").notNull(),
    rowCount: integer("row_count").notNull(),
    importedCount: integer("imported_count").default(0).notNull(),
    duplicateCount: integer("duplicate_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    report: jsonb("report").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("import_run_user_checksum_unique").on(table.userId, table.checksum),
  ],
);

export const ingestionRun = pgTable(
  "ingestion_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobName: text("job_name").notNull(),
    source: text("source").notNull(),
    referencePeriod: text("reference_period").notNull(),
    checksum: text("checksum"),
    status: ingestionStatusEnum("status").default("RUNNING").notNull(),
    processedRecords: integer("processed_records").default(0).notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("ingestion_run_job_source_period_checksum_unique").on(
      table.jobName,
      table.source,
      table.referencePeriod,
      table.checksum,
    ),
    index("ingestion_run_started_at_index").on(table.startedAt),
  ],
);

export type UserProfileRecord = typeof userProfile.$inferSelect;
export type AssetRecord = typeof asset.$inferSelect;
export type AssetQuoteRecord = typeof assetQuote.$inferSelect;
export type AssetDividendRecord = typeof assetDividend.$inferSelect;
export type PortfolioTransactionRecord = typeof portfolioTransaction.$inferSelect;
export type PlannerEntryRecord = typeof plannerEntry.$inferSelect;
