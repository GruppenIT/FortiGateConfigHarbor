import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Search, Download, User, Settings, Shield } from "lucide-react";
import { useState } from "react";

export default function AuditLog() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["/api/audit"],
  });

  const getActionIcon = (action: string) => {
    if (action.includes('login') || action.includes('logout')) return <User className="h-4 w-4" />;
    if (action.includes('compliance')) return <Shield className="h-4 w-4" />;
    if (action.includes('ingestion')) return <Download className="h-4 w-4" />;
    return <Settings className="h-4 w-4" />;
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('create') || action.includes('register')) return 'default';
    if (action.includes('delete') || action.includes('remove')) return 'destructive';
    if (action.includes('update') || action.includes('modify')) return 'secondary';
    return 'outline';
  };

  const filteredLogs = auditLogs?.filter((log: any) =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <MainLayout title="Audit Log">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header Actions */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search audit logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 max-w-md"
                  data-testid="input-audit-search"
                />
              </div>
            </div>
            <Button variant="outline" data-testid="button-export-logs">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Audit Log Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardList className="h-5 w-5" />
                <span>System Audit Trail</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <Skeleton className="h-4 w-4" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-1/3 mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Target
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredLogs.map((log: any, index: number) => (
                        <tr key={log.id || index} className="hover:bg-accent/50 transition-colors">
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-audit-timestamp-${log.id || index}`}>
                            {new Date(log.when).toLocaleString()}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center mr-2">
                                <User className="h-3 w-3 text-primary-foreground" />
                              </div>
                              <span className="text-sm font-medium text-foreground" data-testid={`text-audit-user-${log.id || index}`}>
                                {log.userId || 'System'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <Badge variant={getActionBadgeVariant(log.action)} data-testid={`badge-audit-action-${log.id || index}`}>
                              <span className="mr-1">{getActionIcon(log.action)}</span>
                              {log.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Badge>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-foreground" data-testid={`text-audit-target-${log.id || index}`}>
                            {log.target || '-'}
                          </td>
                          <td className="px-3 py-4 text-sm text-muted-foreground" data-testid={`text-audit-details-${log.id || index}`}>
                            {log.detailsJson ? 
                              Object.keys(log.detailsJson).map(key => `${key}: ${log.detailsJson[key]}`).join(', ').substring(0, 50) + '...'
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No audit logs found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? "No audit logs match your search criteria." : "System activities will be logged here."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Statistics */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClipboardList className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-total-events">
                      {auditLogs?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <User className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">User Actions</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-user-actions">
                      {auditLogs?.filter((log: any) => log.action.includes('login') || log.action.includes('logout')).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Settings className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Config Changes</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-config-changes">
                      {auditLogs?.filter((log: any) => log.action.includes('create') || log.action.includes('update') || log.action.includes('delete')).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Shield className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Security Events</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-security-events">
                      {auditLogs?.filter((log: any) => log.action.includes('compliance') || log.action.includes('security')).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
