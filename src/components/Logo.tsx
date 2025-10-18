import { Hexagon, Sparkles } from "lucide-react";

interface LogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
}

const Logo = ({ className = "", iconSize = 24, textSize = "text-2xl" }: LogoProps) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative">
        {/* Outer glow effect */}
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-lg animate-pulse" />
        
        {/* Logo container */}
        <div className="relative flex items-center justify-center w-10 h-10" style={{ width: iconSize + 16, height: iconSize + 16 }}>
          {/* Background hexagon */}
          <Hexagon 
            className="absolute text-primary fill-primary/10" 
            style={{ width: iconSize + 8, height: iconSize + 8 }} 
            strokeWidth={2}
          />
          
          {/* Inner sparkle */}
          <Sparkles 
            className="relative text-primary" 
            style={{ width: iconSize * 0.6, height: iconSize * 0.6 }} 
            strokeWidth={2.5}
            fill="currentColor"
          />
        </div>
      </div>
      
      <div className="flex flex-col leading-none">
        <span className={`${textSize} font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-[gradient_3s_linear_infinite]`}>
          FoundryAI
        </span>
      </div>
    </div>
  );
};

export default Logo;
