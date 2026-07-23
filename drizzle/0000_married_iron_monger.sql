CREATE TYPE "public"."asset_type" AS ENUM('STOCK', 'FII');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."planner_entry_type" AS ENUM('RECEITA', 'DESPESA_MENSAL', 'DESPESA_ANUAL', 'INVESTIMENTO_PLANEJADO');--> statement-breakpoint
CREATE TYPE "public"."risk_profile" AS ENUM('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('COMPRA', 'VENDA', 'DIVIDENDO', 'JCP', 'RENDIMENTO_FII', 'AMORTIZACAO');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"name" text NOT NULL,
	"sector" text,
	"segment" text,
	"cnpj" text,
	"b3_code" text,
	"cvm_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"source" text NOT NULL,
	"source_date" timestamp with time zone NOT NULL,
	"reference_period" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"price_cents" bigint NOT NULL,
	"daily_volume_cents" bigint,
	"market_date" date NOT NULL,
	"source" text NOT NULL,
	"source_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite" (
	"user_id" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_user_id_asset_id_pk" PRIMARY KEY("user_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "fii_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"price_to_book" double precision,
	"dividend_yield_twelve_months" double precision,
	"income_regularity_score" double precision,
	"average_daily_liquidity_cents" bigint,
	"risk_score" double precision,
	"risk_label" text,
	"vacancy_rate" double precision,
	"age_years" double precision,
	"source" text NOT NULL,
	"source_date" timestamp with time zone NOT NULL,
	"reference_period" text NOT NULL,
	"calculation_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"checksum" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"report" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"source" text NOT NULL,
	"reference_period" text NOT NULL,
	"checksum" text,
	"status" "ingestion_status" DEFAULT 'RUNNING' NOT NULL,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"details" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "monthly_financial_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"reference_month" date NOT NULL,
	"contribution_percentage" integer DEFAULT 20 NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"type" "planner_entry_type" NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"amount_cents" bigint NOT NULL,
	"due_date" date,
	"recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Carteira principal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"invested_cents" bigint NOT NULL,
	"market_value_cents" bigint NOT NULL,
	"income_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" uuid,
	"ticker" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"operation_date" date NOT NULL,
	"quantity" numeric(20, 8) DEFAULT '0' NOT NULL,
	"unit_price_cents" bigint DEFAULT 0 NOT NULL,
	"fees_cents" bigint DEFAULT 0 NOT NULL,
	"taxes_cents" bigint DEFAULT 0 NOT NULL,
	"value_cents" bigint DEFAULT 0 NOT NULL,
	"broker" text,
	"notes" text,
	"import_fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stock_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"dividend_yield" double precision,
	"payout" double precision,
	"roe" double precision,
	"roic" double precision,
	"net_debt_to_ebitda" double precision,
	"net_margin" double precision,
	"profit_growth_five_years" double precision,
	"profit_growth_label" text,
	"dividend_history_score" double precision,
	"average_daily_liquidity_cents" bigint,
	"source" text NOT NULL,
	"source_date" timestamp with time zone NOT NULL,
	"reference_period" text NOT NULL,
	"calculation_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"risk_profile" "risk_profile" DEFAULT 'MODERATE' NOT NULL,
	"monthly_contribution_percentage" integer DEFAULT 20 NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_quote" ADD CONSTRAINT "asset_quote_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fii_metric" ADD CONSTRAINT "fii_metric_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_run" ADD CONSTRAINT "import_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_run" ADD CONSTRAINT "import_run_portfolio_id_portfolio_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_financial_plan" ADD CONSTRAINT "monthly_financial_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_entry" ADD CONSTRAINT "planner_entry_plan_id_monthly_financial_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."monthly_financial_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshot" ADD CONSTRAINT "portfolio_snapshot_portfolio_id_portfolio_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_transaction" ADD CONSTRAINT "portfolio_transaction_portfolio_id_portfolio_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_transaction" ADD CONSTRAINT "portfolio_transaction_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_metric" ADD CONSTRAINT "stock_metric_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_ticker_type_unique" ON "asset" USING btree ("ticker","type");--> statement-breakpoint
CREATE INDEX "asset_type_sector_index" ON "asset" USING btree ("type","sector");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_quote_market_date_unique" ON "asset_quote" USING btree ("asset_id","market_date");--> statement-breakpoint
CREATE INDEX "asset_quote_asset_date_index" ON "asset_quote" USING btree ("asset_id","market_date");--> statement-breakpoint
CREATE INDEX "favorite_user_index" ON "favorite" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fii_metric_asset_period_version_unique" ON "fii_metric" USING btree ("asset_id","reference_period","calculation_version");--> statement-breakpoint
CREATE UNIQUE INDEX "import_run_user_checksum_unique" ON "import_run" USING btree ("user_id","checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_run_job_source_period_checksum_unique" ON "ingestion_run" USING btree ("job_name","source","reference_period","checksum");--> statement-breakpoint
CREATE INDEX "ingestion_run_started_at_index" ON "ingestion_run" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_plan_user_month_unique" ON "monthly_financial_plan" USING btree ("user_id","reference_month");--> statement-breakpoint
CREATE INDEX "planner_entry_plan_type_index" ON "planner_entry" USING btree ("plan_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshot_date_unique" ON "portfolio_snapshot" USING btree ("portfolio_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "portfolio_transaction_portfolio_date_index" ON "portfolio_transaction" USING btree ("portfolio_id","operation_date");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_transaction_import_fingerprint_unique" ON "portfolio_transaction" USING btree ("portfolio_id","import_fingerprint");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_metric_asset_period_version_unique" ON "stock_metric" USING btree ("asset_id","reference_period","calculation_version");--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "verification" USING btree ("identifier");