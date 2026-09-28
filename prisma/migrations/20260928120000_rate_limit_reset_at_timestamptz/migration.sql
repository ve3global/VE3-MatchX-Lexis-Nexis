-- reset_at was TIMESTAMP (no time zone): now() was written into it in the
-- DB session's TimeZone, but Prisma reads a plain TIMESTAMP back as UTC, so
-- on any non-UTC session resetTime (and the RateLimit-Reset header) was off
-- by the zone offset. TIMESTAMPTZ stores an absolute instant instead.
--
-- Existing values were written in the session zone, so they're
-- reinterpreted in that same zone. Rows only live for about a second, so
-- this is a no-op in practice either way.
-- AlterTable
ALTER TABLE "rate_limit_counters"
  ALTER COLUMN "reset_at" TYPE TIMESTAMPTZ(3)
  USING "reset_at" AT TIME ZONE current_setting('TimeZone');
