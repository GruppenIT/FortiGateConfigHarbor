import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Users, Network, Loader2, Monitor } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Device {
  serial: string;
  hostname: string;
  model: string;
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

export default function ConfigurationDetails() {
  const { serial } = useParams<{ serial: string }>();

  // Get device info
  const { data: device, isLoading: deviceLoading } = useQuery<Device>({
    queryKey: [`/api/devices/${serial}`],
    enabled: !!serial,
  });

  // Get configurations for selected device
  const { data: firewallPolicies = [], isLoading: policiesLoading } = useQuery<FirewallPolicy[]>({
    queryKey: ['/api/devices', serial, 'firewall-policies'],
    enabled: !!serial,
  });

  const { data: systemInterfaces = [], isLoading: interfacesLoading } = useQuery<SystemInterface[]>({
    queryKey: ['/api/devices', serial, 'system-interfaces'],
    enabled: !!serial,
  });

  const { data: systemAdmins = [], isLoading: adminsLoading } = useQuery<SystemAdmin[]>({
    queryKey: ['/api/devices', serial, 'system-admins'],
    enabled: !!serial,
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
    <MainLayout title={`Configurações - ${device.hostname || device.serial}`}>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header with back button and device info */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/configurations">
                <Button variant="outline" size="sm" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {device.hostname || device.serial}
                </h1>
                <p className="text-muted-foreground">
                  {device.model} • Serial: {device.serial}
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Tabs */}
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

        </div>
      </div>
    </MainLayout>
  );
}