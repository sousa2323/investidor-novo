CREATE TABLE "asset_dividend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"payment_date" date,
	"last_date_prior" date,
	"rate" double precision NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_fundamental_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "sub_type" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "isin" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "fundamentals_refreshed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_quote" ADD COLUMN "previous_close_cents" bigint;--> statement-breakpoint
ALTER TABLE "asset_quote" ADD COLUMN "market_cap_cents" bigint;--> statement-breakpoint
ALTER TABLE "asset_quote" ADD COLUMN "change_percent" double precision;--> statement-breakpoint
ALTER TABLE "stock_metric" ADD COLUMN "dividend_history_label" text;--> statement-breakpoint
ALTER TABLE "stock_metric" ADD COLUMN "liquidity_label" text;--> statement-breakpoint
ALTER TABLE "asset_dividend" ADD CONSTRAINT "asset_dividend_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_fundamental_snapshot" ADD CONSTRAINT "asset_fundamental_snapshot_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_dividend_unique" ON "asset_dividend" USING btree ("asset_id","payment_date","label","rate");--> statement-breakpoint
CREATE INDEX "asset_dividend_asset_date_index" ON "asset_dividend" USING btree ("asset_id","payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_fundamental_snapshot_asset_unique" ON "asset_fundamental_snapshot" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_isin_index" ON "asset" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "asset_type_fundamentals_index" ON "asset" USING btree ("type","fundamentals_refreshed_at");