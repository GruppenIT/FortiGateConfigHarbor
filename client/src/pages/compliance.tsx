import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, AlertTriangle, Play, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Compliance() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: rules, isLoading } = useQuery({
    queryKey: ["/api/compliance/rules"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/compliance/stats"],
  });

  const runComplianceCheckMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compliance/check");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verificação de conformidade concluída",
        description: `Verificadas ${data.rulesChecked} regras, encontradas ${data.violations} violações`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Verificação de conformidade falhou",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getSeverityVariant = (severity: string) => {
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

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <MainLayout title="Gestão de Conformidade">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header Actions */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-muted-foreground">
              Monitore e aplique políticas de conformidade em toda sua infraestrutura FortiGate.
            </p>
            <div className="flex space-x-3">
              {user?.role === 'admin' && (
                <>
                  <Button
                    onClick={() => runComplianceCheckMutation.mutate()}
                    disabled={runComplianceCheckMutation.isPending}
                    data-testid="button-run-compliance-check"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {runComplianceCheckMutation.isPending ? "Executando..." : "Executar Verificação"}
                  </Button>
                  <Button variant="outline" data-testid="button-add-rule">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Regra
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Compliance Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Regras de Conformidade</CardTitle>
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
                    </div>
                  ))}
                </div>
              ) : rules && rules.length > 0 ? (
                <div className="space-y-4">
                  {rules.map((rule: any) => (
                    <div key={rule.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-shrink-0">
                        {getSeverityIcon(rule.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <h4 className="text-sm font-medium text-foreground" data-testid={`text-rule-name-${rule.id}`}>
                            {rule.name}
                          </h4>
                          <Badge variant={getSeverityVariant(rule.severity)} data-testid={`badge-rule-severity-${rule.id}`}>
                            {rule.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-rule-description-${rule.id}`}>
                          {rule.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge variant={rule.enabled ? "default" : "secondary"} data-testid={`badge-rule-status-${rule.id}`}>
                          {rule.enabled ? "Habilitada" : "Desabilitada"}
                        </Badge>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge variant="outline" data-testid={`badge-rule-compliance-${rule.id}`}>
                          Conforme
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma regra de conformidade configurada</h3>
                  <p className="text-muted-foreground mb-4">
                    Comece criando sua primeira regra de conformidade para monitorar suas configurações FortiGate.
                  </p>
                  {user?.role === 'admin' && (
                    <Button data-testid="button-create-first-rule">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeira Regra
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compliance Statistics */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Dispositivos Conformes</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-compliant-devices">
                      {statsLoading ? <Skeleton className="h-8 w-8" /> : stats?.compliantDevices || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Violações</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-violations">
                      {statsLoading ? <Skeleton className="h-8 w-8" /> : stats?.violations || 0}
                    </p>
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
                    <p className="text-sm font-medium text-muted-foreground">Avisos</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-warnings">
                      {statsLoading ? <Skeleton className="h-8 w-8" /> : stats?.warnings || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Play className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Última Verificação</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-last-check">
                      {statsLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : stats?.lastCheck ? (
                        new Date(stats.lastCheck).toLocaleString('pt-BR')
                      ) : (
                        "Nunca"
                      )}
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
