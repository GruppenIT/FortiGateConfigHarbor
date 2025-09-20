import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Eye, Trash2, FileX } from "lucide-react";

export default function Quarantine() {
  const { data: quarantineItems, isLoading } = useQuery({
    queryKey: ["/api/quarantine"],
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getReasonBadgeVariant = (reason: string) => {
    if (reason.toLowerCase().includes('serial')) return 'destructive';
    if (reason.toLowerCase().includes('parse')) return 'default';
    if (reason.toLowerCase().includes('format')) return 'secondary';
    return 'outline';
  };

  return (
    <MainLayout title="Quarantine Management">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-6">
            <p className="text-muted-foreground">
              Files that could not be processed are quarantined here for review and manual handling.
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span>Quarantined Files</span>
                </CardTitle>
                <Badge variant="outline" data-testid="badge-quarantine-count">
                  {quarantineItems?.length || 0} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <Skeleton className="h-4 w-4" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-1/3 mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : quarantineItems && quarantineItems.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          File
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Quarantined
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {quarantineItems.map((item: any) => (
                        <tr key={item.id} className="hover:bg-accent/50 transition-colors">
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <FileX className="h-4 w-4 text-muted-foreground mr-3" />
                              <div>
                                <p className="text-sm font-medium text-foreground" data-testid={`text-quarantine-filename-${item.id}`}>
                                  {item.path.split('/').pop()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.fileHash?.substring(0, 8)}...
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <Badge variant={getReasonBadgeVariant(item.reason)} data-testid={`badge-quarantine-reason-${item.id}`}>
                              {item.reason}
                            </Badge>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-quarantine-size-${item.id}`}>
                            Unknown
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-quarantine-date-${item.id}`}>
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" data-testid={`button-review-${item.id}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              <Button variant="outline" size="sm" data-testid={`button-delete-${item.id}`}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No quarantined files</h3>
                  <p className="text-muted-foreground">
                    Files that cannot be processed will appear here for manual review.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quarantine Statistics */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Quarantined</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-total-quarantined">
                      {quarantineItems?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileX className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Serial Missing</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-serial-missing">
                      {quarantineItems?.filter((item: any) => item.reason.toLowerCase().includes('serial')).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Parse Errors</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-parse-errors">
                      {quarantineItems?.filter((item: any) => item.reason.toLowerCase().includes('parse')).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileX className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Format Issues</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-format-issues">
                      {quarantineItems?.filter((item: any) => item.reason.toLowerCase().includes('format')).length || 0}
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
