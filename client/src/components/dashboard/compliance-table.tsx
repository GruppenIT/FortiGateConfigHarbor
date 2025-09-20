import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function ComplianceTable() {
  const { data: rules, isLoading } = useQuery({
    queryKey: ["/api/compliance/rules"],
  });

  const { data: devices } = useQuery({
    queryKey: ["/api/devices"],
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeVariant = (statusType: string) => {
    switch (statusType) {
      case 'pass':
        return 'default';
      case 'fail':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Rules Status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rule</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Devices</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {complianceStatus.map((rule, index) => (
                  <tr key={index}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-foreground" data-testid={`text-compliance-rule-${index}`}>
                      {rule.name}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <Badge variant={getSeverityBadgeVariant(rule.severity)} data-testid={`badge-compliance-severity-${index}`}>
                        {rule.severity}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-compliance-devices-${index}`}>
                      {rule.deviceCount}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(rule.statusType)} data-testid={`badge-compliance-status-${index}`}>
                        {rule.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
