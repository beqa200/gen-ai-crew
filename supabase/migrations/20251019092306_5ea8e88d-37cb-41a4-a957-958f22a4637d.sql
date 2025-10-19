-- Create project AI messages table
CREATE TABLE public.project_ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_ai_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view AI messages for their projects"
ON public.project_ai_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_ai_messages.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create AI messages for their projects"
ON public.project_ai_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_ai_messages.project_id
    AND projects.user_id = auth.uid()
  )
);