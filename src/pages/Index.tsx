import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Users, Brain } from "lucide-react";
import Logo from "@/components/Logo";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <Logo />
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button 
              className="gradient-primary hover:opacity-90 transition-opacity"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </Button>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">AI-Powered Project Management</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Forge Your Vision
              <br />
              <span className="bg-clip-text text-transparent gradient-primary">
                With AI Precision
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              FoundryAI creates intelligent departments that plan, manage, and execute your projects like a real team—automatically.
            </p>
            
            <div className="flex gap-4 justify-center">
              <Button 
                size="lg"
                className="gradient-primary hover:opacity-90 transition-opacity shadow-elegant"
                onClick={() => navigate("/auth")}
              >
                Start Building Free
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-2"
              >
                Watch Demo
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6 rounded-lg bg-card/50 backdrop-blur-sm shadow-elegant">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Planning</h3>
              <p className="text-muted-foreground">
                AI analyzes your project and creates structured departments with detailed task breakdowns
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-card/50 backdrop-blur-sm shadow-elegant">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Departments</h3>
              <p className="text-muted-foreground">
                Development, Product, and Marketing teams work together like real specialists
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-card/50 backdrop-blur-sm shadow-elegant">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Micro-Management</h3>
              <p className="text-muted-foreground">
                Every task gets its own AI assistant for detailed execution and updates
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 FoundryAI. Your intelligent project companion.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
