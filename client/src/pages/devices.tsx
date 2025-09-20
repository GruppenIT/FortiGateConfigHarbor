import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Server, Eye } from "lucide-react";
import { Link } from "wouter";

export default function Devices() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: devices, isLoading } = useQuery({
    queryKey: ["/api/devices"],
  });

  const filteredDevices = devices?.filter((device: any) =>
    device.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.model?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <MainLayout title="Gestão de Dispositivos">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Search and Filters */}
          <div className="mb-6 flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar dispositivos por hostname, serial ou modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-device-search"
              />
            </div>
          </div>

          {/* Devices Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Exibindo {filteredDevices.length} de {devices?.length || 0} dispositivos
              </div>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDevices.map((device: any) => (
                  <Card key={device.serial} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <Server className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-lg" data-testid={`text-device-hostname-${device.serial}`}>
                              {device.hostname || "Desconhecido"}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground" data-testid={`text-device-serial-${device.serial}`}>
                              {device.serial}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" data-testid={`badge-device-status-${device.serial}`}>
                          Ativo
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Modelo</p>
                          <p className="font-medium" data-testid={`text-device-model-${device.serial}`}>
                            {device.model || "Desconhecido"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Último Acesso</p>
                          <p className="font-medium" data-testid={`text-device-last-seen-${device.serial}`}>
                            {device.lastSeen ? new Date(device.lastSeen).toLocaleDateString('pt-BR') : "Nunca"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">VDOM</p>
                          <p className="font-medium">
                            {device.vdomEnabled ? "Habilitado" : "Desabilitado"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Inquilino</p>
                          <p className="font-medium">
                            {device.tenantId || "Não Atribuído"}
                          </p>
                        </div>
                      </div>
                      
                      {device.tags && device.tags.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Etiquetas</p>
                          <div className="flex flex-wrap gap-1">
                            {device.tags.map((tag: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <Link href={`/devices/${device.serial}`}>
                          <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-device-${device.serial}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredDevices.length === 0 && searchTerm && (
                <div className="text-center py-12">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum dispositivo encontrado</h3>
                  <p className="text-muted-foreground">
                    Nenhum dispositivo corresponde aos seus critérios de busca. Tente ajustar os termos de pesquisa.
                  </p>
                </div>
              )}

              {filteredDevices.length === 0 && !searchTerm && devices?.length === 0 && (
                <div className="text-center py-12">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum dispositivo registrado</h3>
                  <p className="text-muted-foreground">
                    Os dispositivos aparecerão aqui assim que os arquivos de configuração forem ingeridos e processados.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
