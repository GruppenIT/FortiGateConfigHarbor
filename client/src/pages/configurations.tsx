import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Monitor, Eye, Search, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Device {
  serial: string;
  hostname: string;
  model: string;
  version: string;
  lastUpdate: string;
  policiesCount: number;
  interfacesCount: number;
  adminsCount: number;
}

export default function Configurations() {
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Get devices list with details
  const { data: devices = [], isLoading: devicesLoading } = useQuery<Device[]>({
    queryKey: ['/api/devices/summary'],
  });

  // Filter devices based on search term
  const filteredDevices = devices.filter(device => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (device.hostname && device.hostname.toLowerCase().includes(searchLower)) ||
      device.serial.toLowerCase().includes(searchLower) ||
      (device.model && device.model.toLowerCase().includes(searchLower))
    );
  });

  return (
    <MainLayout title="Gerenciamento de Configurações">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-6">
            <p className="text-muted-foreground mb-4">
              Visualize e analise objetos de configuração do FortiGate em sua infraestrutura.
            </p>
            
            {/* Search Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Filtrar Dispositivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por nome, número de série ou modelo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-devices"
                  />
                </div>
                {searchTerm && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Mostrando {filteredDevices.length} de {devices.length} dispositivos
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Devices Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Dispositivos FortiGate ({filteredDevices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Carregando dispositivos...</span>
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="text-center py-12">
                  <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {searchTerm ? 'Nenhum dispositivo encontrado' : 'Nenhum dispositivo disponível'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm 
                      ? 'Tente ajustar os filtros de busca.'
                      : 'Aguarde o processamento de arquivos de configuração.'
                    }
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hostname</TableHead>
                      <TableHead>Número de Série</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Versão</TableHead>
                      <TableHead>Políticas</TableHead>
                      <TableHead>Interfaces</TableHead>
                      <TableHead>Administradores</TableHead>
                      <TableHead>Última Atualização</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDevices.map((device) => (
                      <TableRow key={device.serial} data-testid={`row-device-${device.serial}`}>
                        <TableCell className="font-medium">
                          {device.hostname || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {device.serial}
                        </TableCell>
                        <TableCell>
                          {device.model || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {device.version || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                            {device.policiesCount || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/30">
                            {device.interfacesCount || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30">
                            {device.adminsCount || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {device.lastUpdate ? new Date(device.lastUpdate).toLocaleDateString('pt-BR') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/configurations/${device.serial}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-view-${device.serial}`}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Ver detalhes de {device.hostname || device.serial}</span>
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
}
