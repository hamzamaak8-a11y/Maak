-- Phase 2: enable Postgres Changes for the existing public.messages table.
-- Keep this migration idempotent because some environments may already have the table
-- enabled through the Supabase dashboard or an earlier deployment.
DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION 'public.messages table must exist before enabling Realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;
