import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Play, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Ingestion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lastIngestionResult, setLastIngestionResult] = useState<any>(null);

  const triggerIngestionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ingestion/trigger");
      return await res.json();
    },
    onSuccess: (data) => {
      setLastIngestionResult(data);
      toast({
        title: "Ingestion completed",
        description: `Processed ${data.processed} files, quarantined ${data.quarantined}, found ${data.duplicates} duplicates`,
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

  return (
    <MainLayout title="Ingestão de Arquivos">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* System Status */}
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Serviço de Ingestão</p>
                    <p className="text-lg font-semibold text-foreground" data-testid="text-service-status">Executando</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Download className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Arquivos Hoje</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-files-today">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Clock className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Próxima Verificação</p>
                    <p className="text-lg font-semibold text-foreground" data-testid="text-next-scan">2:45 minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Arquivos Pendentes</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-pending-files">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Configurações</TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                
                {/* Manual Ingestion */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Play className="h-5 w-5" />
                      <span>Ingestão Manual</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Executar uma verificação manual do diretório /data para processar novos arquivos de configuração.
                    </p>
                    
                    {user?.role === 'admin' && (
                      <Button
                        onClick={() => triggerIngestionMutation.mutate()}
                        disabled={triggerIngestionMutation.isPending}
                        className="w-full"
                        data-testid="button-trigger-ingestion"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {triggerIngestionMutation.isPending ? "Processando..." : "Executar Ingestão"}
                      </Button>
                    )}

                    {lastIngestionResult && (
                      <div className="mt-4 p-4 bg-accent rounded-lg">
                        <h4 className="text-sm font-medium mb-2">Último Resultado de Ingestão</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>{lastIngestionResult.processed} processados</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span>{lastIngestionResult.quarantined} em quarentena</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <span>{lastIngestionResult.duplicates} duplicados</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Schedule Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Clock className="h-5 w-5" />
                      <span>Scheduled Ingestion</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant="default" data-testid="badge-schedule-status">Active</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Frequency</span>
                      <span className="text-sm font-medium">Every 5 minutes</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Run</span>
                      <span className="text-sm font-medium" data-testid="text-last-run">2 minutes ago</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Next scan in</span>
                        <span className="font-medium">2:45</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Ingestion Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Data Directory</h4>
                        <p className="text-sm text-muted-foreground">/data</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Archive Directory</h4>
                        <p className="text-sm text-muted-foreground">/archive</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Quarantine Directory</h4>
                        <p className="text-sm text-muted-foreground">/archive/_quarantine</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-2">Scan Interval</h4>
                        <p className="text-sm text-muted-foreground">5 minutes</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">File Processing Rules</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Ignore files with .part extension</li>
                        <li>• Ignore hidden files (starting with .)</li>
                        <li>• Skip files without valid FortiGate serial numbers</li>
                        <li>• Detect and skip duplicate files using SHA256 hash</li>
                        <li>• Quarantine files that cannot be parsed</li>
                      </ul>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>Ingestion Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No logs available</h3>
                    <p className="text-muted-foreground">
                      Ingestion logs will appear here once files are processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

        </div>
      </div>
    </MainLayout>
  );
}
