import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Shield, 
  Users, 
  Network, 
  Loader2, 
  Monitor, 
  Server, 
  Activity, 
  Calendar, 
  HardDrive 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Device {
  serial: string;
  hostname: string;
  model: string;
  // Campos do inventário externo
  modelDesc?: string;
  localizacaoDesc?: string;
  statusId?: number;
  statusDesc?: string;
  inventoryLastSync?: string;
  // Campos originais
  vdomEnabled?: boolean;
  primaryVdom?: string;
  tenantId?: string;
  firstSeen?: string;
  lastSeen?: string;
}

interface FirewallPolicy {
  seq: number;
  action: string;
  srcAddr: string[];
  dstAddr: string[];
  service: string[];
  srcIntf: string[];
  dstIntf: string[];
}

interface SystemInterface {
  name: string;
  ipCidr: string;
  mode: string;
  zone: string;
  status: string;
}

interface SystemAdmin {
  username: string;
  profile: string;
  trustedHosts: string[];
  twoFactor: boolean;
}

interface DeviceVersion {
  id: string;
  deviceSerial: string;
  fortiosVersion: string;
  build: string;
  capturedAt: string;
  fileHash: string;
  archivePath: string;
}

interface ComplianceResult {
  ruleId: string;
  status: string;
  measuredAt: string;
  evidence?: any;
}

export default function ConfigurationDetails() {
  const { serial } = useParams<{ serial: string }>();

  // Get device info
  const { data: device, isLoading: deviceLoading } = useQuery<Device>({
    queryKey: [`/api/devices/${serial}`],
    enabled: !!serial,
  });

  // Get device versions
  const { data: versions = [], isLoading: versionsLoading } = useQuery<DeviceVersion[]>({
    queryKey: ['/api/devices', serial, 'versions'],
    enabled: !!serial,
  });

  // Get compliance results
  const { data: complianceResults = [], isLoading: complianceLoading } = useQuery<ComplianceResult[]>({
    queryKey: ['/api/devices', serial, 'compliance'],
    enabled: !!serial && versions && versions.length > 0,
  });

  // Get configurations for selected device - only if versions exist
  const { data: firewallPolicies = [], isLoading: policiesLoading } = useQuery<FirewallPolicy[]>({
    queryKey: ['/api/devices', serial, 'firewall-policies'],
    enabled: !!serial && versions && versions.length > 0,
  });

  const { data: systemInterfaces = [], isLoading: interfacesLoading } = useQuery<SystemInterface[]>({
    queryKey: ['/api/devices', serial, 'system-interfaces'],
    enabled: !!serial && versions && versions.length > 0,
  });

  const { data: systemAdmins = [], isLoading: adminsLoading } = useQuery<SystemAdmin[]>({
    queryKey: ['/api/devices', serial, 'system-admins'],
    enabled: !!serial && versions && versions.length > 0,
  });

  if (deviceLoading) {
    return (
      <MainLayout title="Carregando...">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-8 w-64 mb-6" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!device || !serial) {
    return (
      <MainLayout title="Dispositivo não encontrado">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card>
              <CardContent className="text-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Dispositivo não encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  O dispositivo solicitado não existe ou não pôde ser carregado.
                </p>
                <Link href="/configurations">
                  <Button variant="outline" data-testid="button-back-to-configurations">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar para Configurações
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`${device.hostname || device.serial} - Configurações`}>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/configurations">
                <Button variant="outline" size="sm" data-testid="button-back-to-configurations">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para Configurações
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-device-hostname">
                  {device.hostname || "Dispositivo Desconhecido"}
                </h1>
                <p className="text-muted-foreground" data-testid="text-device-serial">
                  {device.serial}
                </p>
              </div>
            </div>
            <Badge variant="secondary" data-testid="badge-device-status">
              {device.statusDesc || "Ativo"}
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
                <div>
                  <p className="text-sm text-muted-foreground">Número de Série</p>
                  <p className="font-medium" data-testid="text-device-info-serial">{device.serial}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nome do Host</p>
                  <p className="font-medium" data-testid="text-device-info-hostname">{device.hostname || "Desconhecido"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modelo</p>
                  <p className="font-medium" data-testid="text-device-info-model">
                    {device.modelDesc || device.model || "Desconhecido"}
                  </p>
                </div>
                {device.localizacaoDesc && (
                  <div>
                    <p className="text-sm text-muted-foreground">Localização</p>
                    <p className="font-medium" data-testid="text-device-info-location">{device.localizacaoDesc}</p>
                  </div>
                )}
                {device.statusDesc && (
                  <div>
                    <p className="text-sm text-muted-foreground">Status do Inventário</p>
                    <p className="font-medium" data-testid="text-device-info-inventory-status">{device.statusDesc}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">VDOM</p>
                  <p className="font-medium" data-testid="text-device-info-vdom">
                    {device.vdomEnabled ? "Habilitado" : "Desabilitado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">VDOM Primário</p>
                  <p className="font-medium" data-testid="text-device-info-primary-vdom">
                    {device.primaryVdom || "root"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inquilino</p>
                  <p className="font-medium" data-testid="text-device-info-tenant">
                    {device.tenantId || "Não Atribuído"}
                  </p>
                </div>
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
                <div>
                  <p className="text-sm text-muted-foreground">Primeira Vez Visto</p>
                  <p className="font-medium" data-testid="text-device-first-seen">
                    {device.firstSeen ? new Date(device.firstSeen).toLocaleString('pt-BR') : "Desconhecido"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Última Vez Visto</p>
                  <p className="font-medium" data-testid="text-device-last-seen">
                    {device.lastSeen ? new Date(device.lastSeen).toLocaleString('pt-BR') : "Desconhecido"}
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
                      complianceResults.every((result) => result.status === 'pass') ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">Conforme</Badge>
                      ) : (
                        <Badge variant="destructive">Não Conforme</Badge>
                      )
                    ) : (
                      <Badge variant="outline">Não Avaliado</Badge>
                    )}
                  </div>
                </div>
                {device.inventoryLastSync && (
                  <div>
                    <p className="text-sm text-muted-foreground">Última Sincronização do Inventário</p>
                    <p className="font-medium" data-testid="text-device-inventory-sync">
                      {new Date(device.inventoryLastSync).toLocaleString('pt-BR')}
                    </p>
                  </div>
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
                  {complianceResults.map((result, index) => (
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
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Histórico de Configuração</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {versions.map((version, index) => (
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

          {/* Message for devices without configuration */}
          {!versionsLoading && (!versions || versions.length === 0) && (
            <Card className="mb-8">
              <CardContent className="text-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-config-title">
                  Nenhuma configuração foi recebida
                </h3>
                <p className="text-muted-foreground mb-4" data-testid="text-no-config-description">
                  Este equipamento foi identificado no inventário, mas ainda não possui configurações FortiOS parseadas.
                  <br />
                  As configurações aparecerrão aqui assim que forem enviadas para o sistema.
                </p>
                <div className="bg-muted/30 p-4 rounded-lg mt-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Dados do Inventário:</strong>
                    <br />
                    Modelo: {device?.modelDesc || device?.model || "Não informado"}
                    {device?.localizacaoDesc && (
                      <>
                        <br />
                        Localização: {device.localizacaoDesc}
                      </>
                    )}
                    {device?.statusDesc && (
                      <>
                        <br />
                        Status: {device.statusDesc}
                      </>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuration Tabs - Only show if there are configurations */}
          {!versionsLoading && versions && versions.length > 0 && (
            <Tabs defaultValue="policies" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 lg:w-1/2">
              <TabsTrigger value="policies" data-testid="tab-policies">
                <Shield className="h-4 w-4 mr-2" />
                Políticas ({firewallPolicies.length})
              </TabsTrigger>
              <TabsTrigger value="interfaces" data-testid="tab-interfaces">
                <Network className="h-4 w-4 mr-2" />
                Interfaces ({systemInterfaces.length})
              </TabsTrigger>
              <TabsTrigger value="admins" data-testid="tab-admins">
                <Users className="h-4 w-4 mr-2" />
                Administradores ({systemAdmins.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="policies">
              <Card>
                <CardHeader>
                  <CardTitle>Políticas de Firewall</CardTitle>
                </CardHeader>
                <CardContent>
                  {policiesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2">Carregando políticas...</span>
                    </div>
                  ) : firewallPolicies.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma política encontrada</h3>
                      <p className="text-muted-foreground">
                        Este dispositivo não possui políticas de firewall configuradas.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Seq</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Serviços</TableHead>
                          <TableHead>Interface Origem</TableHead>
                          <TableHead>Interface Destino</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {firewallPolicies.map((policy, index) => (
                          <TableRow key={index} data-testid={`row-policy-${policy.seq}`}>
                            <TableCell className="font-mono">{policy.seq}</TableCell>
                            <TableCell>
                              <Badge variant={policy.action === 'accept' ? 'default' : 'destructive'}>
                                {policy.action}
                              </Badge>
                            </TableCell>
                            <TableCell>{policy.srcAddr?.join(', ') || 'N/A'}</TableCell>
                            <TableCell>{policy.dstAddr?.join(', ') || 'N/A'}</TableCell>
                            <TableCell>{policy.service?.join(', ') || 'N/A'}</TableCell>
                            <TableCell>{policy.srcIntf?.join(', ') || 'N/A'}</TableCell>
                            <TableCell>{policy.dstIntf?.join(', ') || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="interfaces">
              <Card>
                <CardHeader>
                  <CardTitle>Interfaces do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  {interfacesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2">Carregando interfaces...</span>
                    </div>
                  ) : systemInterfaces.length === 0 ? (
                    <div className="text-center py-12">
                      <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma interface encontrada</h3>
                      <p className="text-muted-foreground">
                        Este dispositivo não possui interfaces configuradas.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>IP/CIDR</TableHead>
                          <TableHead>Modo</TableHead>
                          <TableHead>Zona</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemInterfaces.map((iface, index) => (
                          <TableRow key={index} data-testid={`row-interface-${iface.name}`}>
                            <TableCell className="font-mono">{iface.name}</TableCell>
                            <TableCell>{iface.ipCidr || 'N/A'}</TableCell>
                            <TableCell>{iface.mode || 'N/A'}</TableCell>
                            <TableCell>{iface.zone || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant={iface.status === 'up' ? 'default' : 'secondary'}>
                                {iface.status || 'unknown'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admins">
              <Card>
                <CardHeader>
                  <CardTitle>Administradores do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  {adminsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="ml-2">Carregando administradores...</span>
                    </div>
                  ) : systemAdmins.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Nenhum administrador encontrado</h3>
                      <p className="text-muted-foreground">
                        Este dispositivo não possui administradores configurados.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome de Usuário</TableHead>
                          <TableHead>Perfil</TableHead>
                          <TableHead>Hosts Confiáveis</TableHead>
                          <TableHead>2FA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemAdmins.map((admin, index) => (
                          <TableRow key={index} data-testid={`row-admin-${admin.username}`}>
                            <TableCell className="font-mono">{admin.username}</TableCell>
                            <TableCell>{admin.profile || 'N/A'}</TableCell>
                            <TableCell>
                              {admin.trustedHosts?.length > 0 
                                ? admin.trustedHosts.join(', ')
                                : 'Qualquer IP'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant={admin.twoFactor ? 'default' : 'secondary'}>
                                {admin.twoFactor ? 'Ativado' : 'Desativado'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          )}

        </div>
      </div>
    </MainLayout>
  );
}