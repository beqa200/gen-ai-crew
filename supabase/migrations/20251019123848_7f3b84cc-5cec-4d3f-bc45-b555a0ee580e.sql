-- Add columns to store project-level deployment info
ALTER TABLE public.projects 
ADD COLUMN deployed_url text,
ADD COLUMN project_code text,
ADD COLUMN vercel_project_id text;