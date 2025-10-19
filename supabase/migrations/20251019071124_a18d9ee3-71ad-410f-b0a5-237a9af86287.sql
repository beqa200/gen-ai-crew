-- Add DELETE policies for tasks and departments

-- Allow users to delete tasks in their departments
CREATE POLICY "Users can delete tasks in their departments"
ON public.tasks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM departments
    JOIN projects ON projects.id = departments.project_id
    WHERE departments.id = tasks.department_id
    AND projects.user_id = auth.uid()
  )
);

-- Allow users to delete departments in their projects
CREATE POLICY "Users can delete their departments"
ON public.departments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = departments.project_id
    AND projects.user_id = auth.uid()
  )
);