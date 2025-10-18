-- Create table for task AI chat messages
CREATE TABLE public.task_ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_ai_messages ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_task_ai_messages_task_id ON public.task_ai_messages(task_id);

-- Users can view messages for their tasks
CREATE POLICY "Users can view AI messages for their tasks"
ON public.task_ai_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks
    JOIN departments ON departments.id = tasks.department_id
    JOIN projects ON projects.id = departments.project_id
    WHERE tasks.id = task_ai_messages.task_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can create messages for their tasks
CREATE POLICY "Users can create AI messages for their tasks"
ON public.task_ai_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks
    JOIN departments ON departments.id = tasks.department_id
    JOIN projects ON projects.id = departments.project_id
    WHERE tasks.id = task_ai_messages.task_id
    AND projects.user_id = auth.uid()
  )
);