import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";

interface Department {
  id: string;
  name: string;
  project_id: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  image_url: string | null;
  created_at: string;
}

const Department = () => {
  const { projectId, departmentId } = useParams();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<Department | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDepartment();
    loadTasks();
  }, [departmentId]);

  const loadDepartment = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", departmentId)
        .single();

      if (error) throw error;
      setDepartment(data);
    } catch (error) {
      console.error("Error loading department:", error);
      toast.error("Failed to load department");
      navigate(`/project/${projectId}`);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("department_id", departmentId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!department) {
    return null;
  }

  return (
    <div className="min-h-screen gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo iconSize={24} textSize="text-xl" />
          </div>
          <div className="text-right">
            <h1 className="font-semibold">{department.name}</h1>
            <p className="text-sm text-muted-foreground">{tasks.length} tasks</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {tasks.length === 0 ? (
          <Card className="shadow-elegant">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No tasks found for this department.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <Card key={task.id} className="shadow-elegant hover:shadow-glow transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {task.image_url && (
                    <img
                      src={task.image_url}
                      alt={task.title}
                      className="w-full h-48 object-cover rounded-md"
                    />
                  )}
                  <CardDescription className="text-sm leading-relaxed">
                    {task.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Department;
