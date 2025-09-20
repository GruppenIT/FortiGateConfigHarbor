import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Plus, AlertTriangle } from "lucide-react";

export function ActivityFeed() {
  // Mock recent activity data - in real implementation this would come from API
  const recentActivity = [
    {
      id: "1",
      type: "update",
      device: "FG-3000D-001",
      details: "FortiOS v7.4.1 → v7.4.2",
      timestamp: "2m ago",
      icon: CheckCircle,
      iconColor: "text-green-500"
    },
    {
      id: "2", 
      type: "new",
      device: "FG-100F-ABC123",
      details: "Branch Office",
      timestamp: "15m ago",
      icon: Plus,
      iconColor: "text-blue-500"
    },
    {
      id: "3",
      type: "violation",
      device: "FG-2000E-DEF456",
      details: "Admin without 2FA",
      timestamp: "1h ago",
      icon: AlertTriangle,
      iconColor: "text-yellow-500"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Device Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flow-root">
          <ul className="-mb-8">
            {recentActivity.map((activity, index) => (
              <li key={activity.id}>
                <div className="relative pb-8">
                  {index !== recentActivity.length - 1 && (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-border" aria-hidden="true"></span>
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full bg-background flex items-center justify-center ring-8 ring-background`}>
                        <activity.icon className={`text-xs h-4 w-4 ${activity.iconColor}`} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                      <div>
                        <p className="text-sm text-foreground" data-testid={`text-activity-description-${activity.id}`}>
                          {activity.type === 'update' && 'Configuration updated for '}
                          {activity.type === 'new' && 'New device discovered'}
                          {activity.type === 'violation' && 'Compliance violation detected'}
                          {activity.type === 'update' && (
                            <span className="font-medium">{activity.device}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-activity-details-${activity.id}`}>
                          {activity.type === 'new' ? `${activity.device} (${activity.details})` : 
                           activity.type === 'violation' ? `${activity.device}: ${activity.details}` :
                           activity.details}
                        </p>
                      </div>
                      <div className="text-right text-sm whitespace-nowrap text-muted-foreground" data-testid={`text-activity-timestamp-${activity.id}`}>
                        {activity.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
