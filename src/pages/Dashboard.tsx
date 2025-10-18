import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Plus, UserCircle, FolderKanban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import Logo from "@/components/Logo";

interface Profile {
  full_name: string | null;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error loading profile:", error);
      }
      
      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || "there";

  return (
    <div className="min-h-screen gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Logo iconSize={24} textSize="text-xl" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/profile")}>
              <UserCircle className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {displayName}!</h2>
          <p className="text-muted-foreground">
            Ready to forge your next project?
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-elegant hover:shadow-glow transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" />
                <CardTitle>Getting Started</CardTitle>
              </div>
              <CardDescription>
                Learn how to make the most of FoundryAI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Create your first project</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Set up AI departments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Generate and manage tasks</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Collaborate with AI assistants</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card 
            className="border-dashed border-2 hover:border-primary transition-colors cursor-pointer shadow-elegant hover:shadow-glow"
            onClick={() => toast.info("Project creation coming soon!")}
          >
            <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold mb-1">Create New Project</h3>
                <p className="text-sm text-muted-foreground">
                  Start a new AI-powered project
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
