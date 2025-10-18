import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";

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

const Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [userMessage, setUserMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [tasksGenerated, setTasksGenerated] = useState(false);

  useEffect(() => {
    loadProject();
    loadDepartments();
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
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Action plan generated successfully!</span>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {departments.map((dept) => (
                <Card key={dept.id} className="shadow-elegant hover:shadow-glow transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {dept.name}
                    </CardTitle>
                    <CardDescription>
                      Tasks and actions for this department
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/project/${id}/department/${dept.id}`)}
                    >
                      View Tasks
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Project;