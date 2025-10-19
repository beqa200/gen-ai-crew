-- Ensure realtime is properly configured for tasks table
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

-- Verify the table is in the realtime publication (this will fail gracefully if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication, ignore error
  END;
END $$;