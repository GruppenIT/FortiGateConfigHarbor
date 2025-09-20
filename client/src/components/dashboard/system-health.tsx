import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function SystemHealth() {
  const [countdown, setCountdown] = useState(165); // 2:45 in seconds

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev > 0) {
          return prev - 1;
        } else {
          return 300; // Reset to 5 minutes
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} minutes`;
  };

  const progress = ((300 - countdown) / 300) * 100;

  const healthItems = [
    {
      name: "Ingestion Service",
      status: "Running",
      color: "bg-green-500"
    },
    {
      name: "Database", 
      status: "Connected",
      color: "bg-green-500"
    },
    {
      name: "File System",
      status: "78% Used", 
      color: "bg-green-500"
    },
    {
      name: "Compliance Engine",
      status: "Active",
      color: "bg-green-500"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          
          {healthItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-2 h-2 ${item.color} rounded-full mr-3`}></div>
                <span className="text-sm text-foreground" data-testid={`text-health-service-${index}`}>{item.name}</span>
              </div>
              <span className="text-xs text-muted-foreground" data-testid={`text-health-status-${index}`}>{item.status}</span>
            </div>
          ))}
          
          {/* Next Scheduled Scan */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Next Scan</span>
              <span className="text-xs text-muted-foreground" data-testid="text-next-scan">
                {formatTime(countdown)}
              </span>
            </div>
            <div className="mt-2">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
