import { Sparkles } from "lucide-react";

interface LogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
}

const Logo = ({ className = "", iconSize = 24, textSize = "text-2xl" }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
        <div className="relative p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
          <Sparkles className={`w-${iconSize/4} h-${iconSize/4}`} style={{ width: iconSize, height: iconSize }} strokeWidth={2.5} />
        </div>
      </div>
      <span className={`${textSize} font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent`}>
        FoundryAI
      </span>
    </div>
  );
};

export default Logo;
