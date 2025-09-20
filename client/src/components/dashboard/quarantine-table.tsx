import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export function QuarantineTable() {
  const { data: quarantineItems, isLoading } = useQuery({
    queryKey: ["/api/quarantine"],
  });

  const displayItems = quarantineItems?.slice(0, 3) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Quarantine Items</CardTitle>
          <Link href="/quarantine">
            <Button variant="ghost" size="sm" data-testid="link-view-all-quarantine">
              View all →
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : displayItems.length > 0 ? (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">File</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quarantined</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayItems.map((item: any, index: number) => (
                  <tr key={item.id || index}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-foreground" data-testid={`text-quarantine-file-${index}`}>
                      {item.path?.split('/').pop() || 'Unknown file'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-quarantine-reason-${index}`}>
                      {item.reason}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-quarantine-size-${index}`}>
                      Unknown
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-quarantine-date-${index}`}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" data-testid={`button-review-quarantine-${index}`}>
                          Review
                        </Button>
                        <Button variant="ghost" size="sm" data-testid={`button-delete-quarantine-${index}`}>
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
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No quarantined files</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
