-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Departments policies (users can access departments of their projects)
CREATE POLICY "Users can view departments of their projects"
ON public.departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = departments.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create departments for their projects"
ON public.departments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = departments.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Tasks policies (users can access tasks of departments in their projects)
CREATE POLICY "Users can view tasks of their departments"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.departments
    JOIN public.projects ON projects.id = departments.project_id
    WHERE departments.id = tasks.department_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tasks for their departments"
ON public.tasks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.departments
    JOIN public.projects ON projects.id = departments.project_id
    WHERE departments.id = tasks.department_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tasks in their departments"
ON public.tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.departments
    JOIN public.projects ON projects.id = departments.project_id
    WHERE departments.id = tasks.department_id
    AND projects.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_departments_project_id ON public.departments(project_id);
CREATE INDEX idx_tasks_department_id ON public.tasks(department_id);