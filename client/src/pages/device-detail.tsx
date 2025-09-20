import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Server, 
  Network, 
  Shield, 
  Activity,
  Calendar,
  HardDrive
} from "lucide-react";
import { Link } from "wouter";

export default function DeviceDetail() {
  const [match, params] = useRoute("/devices/:serial");
  const serial = params?.serial;

  const { data: device, isLoading, error } = useQuery({
    queryKey: ["/api/devices", serial],
    queryFn: async () => {
      if (!serial) {
        throw new Error('Device serial not found');
      }
      const response = await fetch(`/api/devices/${serial}`);
      if (!response.ok) {
        throw new Error('Device not found');
      }
      return response.json();
    },
    enabled: !!serial,
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ["/api/devices", serial, "versions"],
    queryFn: async () => {
      if (!serial) {
        throw new Error('Device serial not found');
      }
      const response = await fetch(`/api/devices/${serial}/versions`);
      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }
      return response.json();
    },
    enabled: !!serial,
  });

  const { data: complianceResults, isLoading: complianceLoading } = useQuery({
    queryKey: ["/api/devices", serial, "compliance"],
    queryFn: async () => {
      if (!serial) {
        throw new Error('Device serial not found');
      }
      const response = await fetch(`/api/devices/${serial}/compliance`);
      if (!response.ok) {
        throw new Error('Failed to fetch compliance results');
      }
      return response.json();
    },
    enabled: !!serial,
  });

  if (error || !serial) {
    return (
      <MainLayout title="Dispositivo Não Encontrado">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Dispositivo não encontrado</h3>
              <p className="text-muted-foreground mb-4">
                O dispositivo com serial {serial || 'desconhecido'} não pôde ser encontrado.
              </p>
              <Link href="/devices">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar aos Dispositivos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Dispositivo: ${device?.hostname || serial}`}>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/devices">
                <Button variant="outline" size="sm" data-testid="button-back-to-devices">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar aos Dispositivos
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-device-hostname">
                  {isLoading ? <Skeleton className="h-8 w-48" /> : device?.hostname || "Dispositivo Desconhecido"}
                </h1>
                <p className="text-muted-foreground" data-testid="text-device-serial">
                  {isLoading ? <Skeleton className="h-4 w-32" /> : serial}
                </p>
              </div>
            </div>
            <Badge variant="secondary" data-testid="badge-device-status">
              Ativo
            </Badge>
          </div>

          {/* Device Information */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="h-5 w-5" />
                  <span>Informações do Dispositivo</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="space-y-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Número de Série</p>
                      <p className="font-medium" data-testid="text-device-info-serial">{device?.serial}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nome do Host</p>
                      <p className="font-medium" data-testid="text-device-info-hostname">{device?.hostname || "Desconhecido"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Modelo</p>
                      <p className="font-medium" data-testid="text-device-info-model">{device?.model || "Desconhecido"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">VDOM</p>
                      <p className="font-medium" data-testid="text-device-info-vdom">
                        {device?.vdomEnabled ? "Habilitado" : "Desabilitado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">VDOM Primário</p>
                      <p className="font-medium" data-testid="text-device-info-primary-vdom">
                        {device?.primaryVdom || "root"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Inquilino</p>
                      <p className="font-medium" data-testid="text-device-info-tenant">
                        {device?.tenantId || "Não Atribuído"}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Atividade</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Primeira Vez Visto</p>
                      <p className="font-medium" data-testid="text-device-first-seen">
                        {device?.firstSeen ? new Date(device.firstSeen).toLocaleString('pt-BR') : "Desconhecido"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Última Vez Visto</p>
                      <p className="font-medium" data-testid="text-device-last-seen">
                        {device?.lastSeen ? new Date(device.lastSeen).toLocaleString('pt-BR') : "Desconhecido"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Versões de Configuração</p>
                      <p className="font-medium" data-testid="text-device-versions-count">
                        {versionsLoading ? <Skeleton className="h-4 w-8" /> : versions?.length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status de Conformidade</p>
                      <div className="flex items-center space-x-2">
                        {complianceLoading ? (
                          <Skeleton className="h-4 w-16" />
                        ) : complianceResults && complianceResults.length > 0 ? (
                          complianceResults.every((result: any) => result.status === 'pass') ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">Conforme</Badge>
                          ) : (
                            <Badge variant="destructive">Não Conforme</Badge>
                          )
                        ) : (
                          <Badge variant="outline">Não Avaliado</Badge>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <HardDrive className="h-5 w-5" />
                  <span>Última Configuração</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {versionsLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ))}
                  </div>
                ) : versions && versions.length > 0 ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Versão FortiOS</p>
                      <p className="font-medium" data-testid="text-device-fortios-version">
                        {versions[0]?.fortiosVersion || "Desconhecido"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Build</p>
                      <p className="font-medium" data-testid="text-device-build">
                        {versions[0]?.build || "Desconhecido"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Capturado</p>
                      <p className="font-medium" data-testid="text-device-captured">
                        {versions[0]?.capturedAt ? new Date(versions[0].capturedAt).toLocaleString('pt-BR') : "Desconhecido"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Hash do Arquivo</p>
                      <p className="font-mono text-xs text-muted-foreground" data-testid="text-device-file-hash">
                        {versions[0]?.fileHash?.substring(0, 16)}...
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Nenhuma versão de configuração disponível</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Compliance Results */}
          {complianceResults && complianceResults.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Resultados de Conformidade</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {complianceResults.map((result: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium" data-testid={`text-compliance-rule-${index}`}>
                          Regra {result.ruleId}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Avaliado: {new Date(result.measuredAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge 
                        variant={result.status === 'pass' ? 'default' : 'destructive'}
                        data-testid={`badge-compliance-status-${index}`}
                      >
                        {result.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuration Versions */}
          {versions && versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Histórico de Configuração</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {versions.map((version: any, index: number) => (
                    <div key={version.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <p className="font-medium" data-testid={`text-version-info-${index}`}>
                            FortiOS {version.fortiosVersion || "Desconhecido"}
                          </p>
                          {index === 0 && <Badge variant="outline">Última</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Build {version.build || "Desconhecido"} • Capturado {new Date(version.capturedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-view-version-${index}`}>
                        Ver Detalhes
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </MainLayout>
  );
}