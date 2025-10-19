-- Create task_dependencies table to track task blocking relationships
CREATE TABLE public.task_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

-- Enable RLS
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- Users can view dependencies for their tasks
CREATE POLICY "Users can view task dependencies"
ON public.task_dependencies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks
    JOIN departments ON departments.id = tasks.department_id
    JOIN projects ON projects.id = departments.project_id
    WHERE tasks.id = task_dependencies.task_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can create dependencies for their tasks
CREATE POLICY "Users can create task dependencies"
ON public.task_dependencies
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks
    JOIN departments ON departments.id = tasks.department_id
    JOIN projects ON projects.id = departments.project_id
    WHERE tasks.id = task_dependencies.task_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete dependencies for their tasks
CREATE POLICY "Users can delete task dependencies"
ON public.task_dependencies
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM tasks
    JOIN departments ON departments.id = tasks.department_id
    JOIN projects ON projects.id = departments.project_id
    WHERE tasks.id = task_dependencies.task_id
    AND projects.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_task_dependencies_task_id ON public.task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on ON public.task_dependencies(depends_on_task_id);