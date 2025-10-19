import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Loader2, CheckCircle2, ListTodo, BarChart3, Eye } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { TaskDialog } from "@/components/TaskDialog";

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface Department {
  id: string;
  name: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  department_id: string;
  image_url: string | null;
  created_at: string;
}

interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

const Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userMessage, setUserMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [tasksGenerated, setTasksGenerated] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDependencies, setTaskDependencies] = useState<TaskDependency[]>([]);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
    loadDepartments();
    loadTasks();
    loadTaskDependencies();
  }, [id]);

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setDepartments(data);
        setTasksGenerated(true);
      }
    } catch (error) {
      console.error("Error loading departments:", error);
    }
  };

  const loadTasks = async () => {
    try {
      const { data: deptData } = await supabase
        .from("departments")
        .select("id")
        .eq("project_id", id);

      if (!deptData || deptData.length === 0) return;

      const departmentIds = deptData.map(d => d.id);

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .in("department_id", departmentIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  };

  const loadTaskDependencies = async () => {
    try {
      const { data: deptData } = await supabase
        .from("departments")
        .select("id")
        .eq("project_id", id);

      if (!deptData || deptData.length === 0) return;

      const departmentIds = deptData.map(d => d.id);

      const { data: taskData } = await supabase
        .from("tasks")
        .select("id")
        .in("department_id", departmentIds);

      if (!taskData || taskData.length === 0) return;

      const taskIds = taskData.map(t => t.id);

      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .in("task_id", taskIds);

      if (error) throw error;
      setTaskDependencies(data || []);
    } catch (error) {
      console.error("Error loading task dependencies:", error);
    }
  };

  const handleGenerateTasks = async () => {
    if (!userMessage.trim()) {
      toast.error("Please describe your startup idea");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tasks', {
        body: {
          projectId: id,
          userMessage: userMessage.trim()
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(data.message || "Tasks generated successfully!");
      setTasksGenerated(true);
      await loadDepartments();
      await loadTasks();
      await loadTaskDependencies();
    } catch (error: any) {
      console.error("Error generating tasks:", error);
      toast.error(error.message || "Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-600 text-white hover:bg-green-700";
      case "in_progress":
        return "bg-blue-600 text-white hover:bg-blue-700";
      default:
        return "bg-gray-600 text-white hover:bg-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace("_", " ").toUpperCase();
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const getTasksForDepartment = (deptId: string) => {
    const deptTasks = tasks.filter(t => t.department_id === deptId);
    
    // Sort tasks by dependencies (topological sort)
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    
    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (temp.has(taskId)) return; // cycle detected, skip
      
      temp.add(taskId);
      
      // Visit dependencies first
      const deps = taskDependencies.filter(d => d.task_id === taskId);
      deps.forEach(dep => {
        const depTask = deptTasks.find(t => t.id === dep.depends_on_task_id);
        if (depTask) visit(depTask.id);
      });
      
      temp.delete(taskId);
      visited.add(taskId);
      
      const task = deptTasks.find(t => t.id === taskId);
      if (task) sorted.push(task);
    };
    
    // Start with tasks that have no dependencies
    deptTasks.forEach(task => {
      if (!visited.has(task.id)) {
        visit(task.id);
      }
    });
    
    return sorted;
  };

  const getDepartmentStats = (deptId: string) => {
    const deptTasks = getTasksForDepartment(deptId);
    const total = deptTasks.length;
    const completed = deptTasks.filter(t => t.status === "completed").length;
    const inProgress = deptTasks.filter(t => t.status === "in_progress").length;
    const pending = deptTasks.filter(t => t.status === "pending").length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, inProgress, pending, progress };
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleTaskUpdate = async () => {
    await loadTasks();
    await loadTaskDependencies();
  };

  const handleQuickStatusChange = async (taskId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if trying to change status with incomplete blockers
    if (newStatus === "completed" || newStatus === "in_progress") {
      const blockerTaskIds = taskDependencies
        .filter(dep => dep.task_id === taskId)
        .map(dep => dep.depends_on_task_id);
      
      const blockerTasks = tasks.filter(t => blockerTaskIds.includes(t.id));
      const hasIncompleteBlockers = blockerTasks.some(t => t.status !== "completed");
      
      if (hasIncompleteBlockers) {
        toast.error("Cannot start or complete task with incomplete dependencies");
        return;
      }
    }
    
    setUpdatingTaskId(taskId);
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Status updated");
      await loadTasks();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="min-h-screen gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo iconSize={24} textSize="text-xl" />
          </div>
          <div className="text-right">
            <h1 className="font-semibold">{project.name}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!tasksGenerated ? (
          <div className="max-w-3xl mx-auto">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>AI Project Assistant</CardTitle>
                <CardDescription>
                  Describe your startup idea and I'll generate a complete action plan with departments and tasks.
                  Don't worry about providing every detail - I'll fill in the gaps with creative suggestions!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Describe your startup idea here... For example: 'A fitness app that helps users track workouts' or 'An e-commerce platform for handmade crafts'"
                  className="min-h-[200px] resize-none"
                  disabled={generating}
                />
                <Button
                  onClick={handleGenerateTasks}
                  disabled={generating || !userMessage.trim()}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating your action plan...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Generate Action Plan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ListTodo className="w-4 h-4" />
                    Total Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalTasks}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-600" />
                    In Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingTasks}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Overall Progress</CardTitle>
                  <span className="text-sm font-medium">{Math.round(progress)}%</span>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Departments & Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={departments[0]?.id} className="w-full">
                  <TabsList className="w-full justify-start flex-wrap h-auto">
                    {departments.map((dept) => {
                      const stats = getDepartmentStats(dept.id);
                      return (
                        <TabsTrigger key={dept.id} value={dept.id} className="flex items-center gap-2">
                          {dept.name}
                          <Badge variant="secondary" className="ml-1">
                            {stats.total}
                          </Badge>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {departments.map((dept) => {
                    const deptTasks = getTasksForDepartment(dept.id);
                    const stats = getDepartmentStats(dept.id);
                    
                    return (
                      <TabsContent key={dept.id} value={dept.id} className="space-y-4 mt-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold">{dept.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {stats.completed} of {stats.total} completed • {Math.round(stats.progress)}%
                            </p>
                          </div>
                          <Progress value={stats.progress} className="w-48 h-2" />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="flex items-center gap-2 p-3 rounded-lg border">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <div>
                              <p className="text-sm text-muted-foreground">Completed</p>
                              <p className="text-xl font-bold text-green-600">{stats.completed}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-3 rounded-lg border">
                            <Loader2 className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="text-sm text-muted-foreground">In Progress</p>
                              <p className="text-xl font-bold text-blue-600">{stats.inProgress}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-3 rounded-lg border">
                            <ListTodo className="w-4 h-4" />
                            <div>
                              <p className="text-sm text-muted-foreground">Pending</p>
                              <p className="text-xl font-bold">{stats.pending}</p>
                            </div>
                          </div>
                        </div>

                        {deptTasks.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground border rounded-lg">
                            No tasks in this department
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="max-w-md">Description</TableHead>
                                <TableHead className="text-right">Quick Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {deptTasks.map((task) => (
                                <TableRow 
                                  key={task.id} 
                                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => handleTaskClick(task)}
                                >
                                  <TableCell className="font-medium">{task.title}</TableCell>
                                  <TableCell>
                                    <Badge className={getStatusColor(task.status)}>
                                      {getStatusLabel(task.status)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-md truncate">{task.description}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                      {task.status !== "completed" && task.status !== "in_progress" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => handleQuickStatusChange(task.id, "in_progress", e)}
                                          disabled={updatingTaskId === task.id}
                                          className="h-8 px-2"
                                        >
                                          <Loader2 className="w-3 h-3 mr-1" />
                                          Start
                                        </Button>
                                      )}
                                      {task.status !== "completed" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => handleQuickStatusChange(task.id, "completed", e)}
                                          disabled={updatingTaskId === task.id}
                                          className="h-8 px-2"
                                        >
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          Complete
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTaskClick(task);
                                        }}
                                        className="h-8 px-2"
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        View
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <TaskDialog
        task={selectedTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onTaskUpdate={handleTaskUpdate}
        departmentName={selectedTask && departments.length > 0 
          ? departments.find(d => d.id === selectedTask.department_id)?.name || "Unknown"
          : undefined
        }
        projectDescription={project.description || undefined}
        projectName={project.name}
        allDepartments={departments}
        allTasks={tasks}
        taskDependencies={taskDependencies}
      />
    </div>
  );
};

export default Project;