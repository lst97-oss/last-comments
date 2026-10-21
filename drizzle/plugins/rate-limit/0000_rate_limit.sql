CREATE SCHEMA IF NOT EXISTS comment_rate_limit;
--> statement-breakpoint
CREATE TABLE comment_rate_limit.rate_limit_windows (
  site_key text NOT NULL,
  identity_hash text NOT NULL,
  operation text NOT NULL,
  window_start bigint NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (site_key, identity_hash, operation, window_start)
);
--> statement-breakpoint
CREATE INDEX rate_limit_windows_window_start_idx ON comment_rate_limit.rate_limit_windows (window_start);
