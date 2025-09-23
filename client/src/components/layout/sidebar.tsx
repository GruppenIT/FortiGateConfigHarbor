import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { 
  ChartPie, 
  Settings, 
  CheckCircle, 
  Download, 
  AlertTriangle, 
  Users, 
  ClipboardList,
  Shield,
  LogOut,
  Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Painel Geral", href: "/", icon: ChartPie },
  { name: "Equipamentos", href: "/equipments", icon: Monitor },
  { name: "Conformidade", href: "/compliance", icon: CheckCircle },
  { name: "Ingestão de Arquivos", href: "/ingestion", icon: Download },
  { name: "Quarentena", href: "/quarantine", icon: AlertTriangle },
  { name: "Configurações", href: "/configurations", icon: Settings, adminOnly: true },
  { name: "Gestão de Usuários", href: "/users", icon: Users, adminOnly: true },
  { name: "Log de Auditoria", href: "/audit", icon: ClipboardList, minRole: "auditor" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const filteredNavigation = navigation.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    if (item.minRole === 'auditor' && user?.role === 'readonly') return false;
    return true;
  });

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow pt-5 bg-card border-r border-border overflow-y-auto">
        {/* Logo and Title */}
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="text-primary-foreground text-sm h-4 w-4" />
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-semibold text-foreground">ConfigHarbor</h1>
            <p className="text-xs text-muted-foreground">FortiGate Management</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon
                    className={cn(
                      "mr-3 flex-shrink-0 h-4 w-4",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-accent-foreground"
                    )}
                  />
                  {item.name}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="flex-shrink-0 border-t border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-primary-foreground">
                  {user?.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || user?.username?.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
                  {user?.displayName || user?.username}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-user-role">
                  {user?.role?.charAt(0).toUpperCase() + (user?.role?.slice(1) || '')}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="h-8 w-8 p-0"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
