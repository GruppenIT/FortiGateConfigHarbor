import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Plus, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export function ActivityFeed() {
  const { data: recentActivity, isLoading } = useQuery({
    queryKey: ["/api/audit", "recent"],
    queryFn: async () => {
      const response = await fetch("/api/audit?limit=5");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const getActivityIcon = (action: string) => {
    if (action.includes('create') || action.includes('register')) return Plus;
    if (action.includes('update') || action.includes('modify')) return CheckCircle;
    if (action.includes('compliance') || action.includes('violation')) return AlertTriangle;
    return CheckCircle;
  };

  const getActivityColor = (action: string) => {
    if (action.includes('create') || action.includes('register')) return "text-blue-500";
    if (action.includes('update') || action.includes('modify')) return "text-green-500";
    if (action.includes('compliance') || action.includes('violation')) return "text-yellow-500";
    return "text-gray-500";
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return "agora mesmo";
    if (diffMinutes < 60) return `${diffMinutes}m atrás`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade Recente dos Dispositivos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : !recentActivity || recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              <p>Nenhuma atividade recente</p>
              <p className="text-sm">As atividades aparecerão aqui conforme o sistema for usado</p>
            </div>
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {(recentActivity || []).map((activity: any, index: number) => {
                const Icon = getActivityIcon(activity.action);
                const iconColor = getActivityColor(activity.action);
                
                return (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {index !== recentActivity.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-border" aria-hidden="true"></span>
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full bg-background flex items-center justify-center ring-8 ring-background`}>
                            <Icon className={`text-xs h-4 w-4 ${iconColor}`} />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-foreground" data-testid={`text-activity-action-${activity.id}`}>
                              {activity.action}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-activity-target-${activity.id}`}>
                              {activity.target || 'Sistema'}
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-muted-foreground" data-testid={`text-activity-timestamp-${activity.id}`}>
                            {formatTimestamp(activity.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
