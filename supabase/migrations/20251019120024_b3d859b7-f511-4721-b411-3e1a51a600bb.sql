-- Add deployed_url column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN deployed_url TEXT;