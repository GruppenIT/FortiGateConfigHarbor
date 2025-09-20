import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Menu, FolderSync, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDark, setIsDark] = useState(false);

  const triggerIngestionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ingestion/trigger");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Ingestion triggered",
        description: `Processing files...`,
      });
    },
    onError: (error) => {
      toast({
        title: "Ingestion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="ml-2 text-lg font-semibold text-foreground" data-testid="text-page-title">
            {title}
          </h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* System Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground" data-testid="text-system-status">System Healthy</span>
          </div>
          
          {/* Manual Ingestion Trigger */}
          {user?.role === 'admin' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => triggerIngestionMutation.mutate()}
              disabled={triggerIngestionMutation.isPending}
              data-testid="button-trigger-ingestion"
            >
              <FolderSync className={`mr-2 h-4 w-4 ${triggerIngestionMutation.isPending ? 'animate-spin' : ''}`} />
              {triggerIngestionMutation.isPending ? "Processing..." : "Trigger Ingestion"}
            </Button>
          )}
          
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-8 w-8 p-0"
            data-testid="button-theme-toggle"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
