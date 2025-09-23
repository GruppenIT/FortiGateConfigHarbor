import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Monitor, Eye, Search, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Device {
  serial: string;
  hostname: string;
  model: string;
  // Campos do inventário externo
  modelDesc?: string;
  localizacaoDesc?: string;
  statusDesc?: string;
  // Campos da versão
  version: string;
  lastUpdate: string;
  policiesCount: number;
  interfacesCount: number;
  adminsCount: number;
  // Campos de conformidade
  complianceStatus?: 'compliant' | 'non_compliant' | 'unknown';
  violationsCount?: number;
}

interface DeviceResponse {
  devices: Device[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function Equipments() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<string>("hostname");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [complianceFilter, setComplianceFilter] = useState<string>("");
  const pageSize = 50;
  const [location] = useLocation();

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Read URL parameters to set filters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('filter');
    // Always update the filter state based on URL parameter
    if (filter === 'non_compliant') {
      setComplianceFilter('non_compliant');
    } else if (filter === 'compliant') {
      setComplianceFilter('compliant');
    } else if (filter === 'unknown') {
      setComplianceFilter('unknown');
    } else {
      setComplianceFilter(''); // Clear filter when no valid parameter
    }
  }, [location]);

  // Get devices list with pagination, sorting and search
  const { data: deviceResponse, isLoading: devicesLoading } = useQuery<DeviceResponse>({
    queryKey: ['/api/devices/summary', currentPage, pageSize, debouncedSearchTerm, sortBy, sortOrder, complianceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchTerm,
        sortBy,
        sortOrder
      });
      
      if (complianceFilter) {
        params.set('complianceFilter', complianceFilter);
      }
      
      const response = await fetch(`/api/devices/summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch devices');
      return response.json();
    }
  });

  const devices = deviceResponse?.devices || [];
  const pagination = deviceResponse?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0
  };

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle pagination
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setCurrentPage(page);
    }
  };

  // Helper component for sortable column headers
  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => {
    const isActive = sortBy === column;
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 select-none"
        onClick={() => handleSort(column)}
        data-testid={`header-${column}`}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col">
            <ChevronUp 
              className={`h-3 w-3 ${isActive && sortOrder === 'asc' ? 'text-primary' : 'text-muted-foreground/40'}`} 
            />
            <ChevronDown 
              className={`h-3 w-3 -mt-1 ${isActive && sortOrder === 'desc' ? 'text-primary' : 'text-muted-foreground/40'}`} 
            />
          </div>
        </div>
      </TableHead>
    );
  };

  return (
    <MainLayout title="Gerenciamento de Equipamentos">
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
                    placeholder="Buscar por nome, número de série, modelo ou localização..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-devices"
                  />
                </div>
                {searchTerm && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {pagination.total} resultado(s) encontrado(s) para "{searchTerm}"
                  </p>
                )}
                {!searchTerm && pagination.total > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Total: {pagination.total} dispositivos
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
                Dispositivos FortiGate ({pagination.total})
                {pagination.totalPages > 1 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    - Página {pagination.page} de {pagination.totalPages}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Carregando dispositivos...</span>
                </div>
              ) : devices.length === 0 ? (
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
                      <SortableHeader column="hostname">Hostname</SortableHeader>
                      <SortableHeader column="serial">Número de Série</SortableHeader>
                      <SortableHeader column="model">Modelo</SortableHeader>
                      <SortableHeader column="localizacaoDesc">Localização</SortableHeader>
                      <TableHead>Versão</TableHead>
                      <TableHead data-testid="header-compliance">Conformidade</TableHead>
                      <TableHead>Políticas</TableHead>
                      <TableHead>Interfaces</TableHead>
                      <TableHead>Administradores</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.serial} data-testid={`row-device-${device.serial}`}>
                        <TableCell className="font-medium">
                          {device.hostname || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {device.serial}
                        </TableCell>
                        <TableCell>
                          {device.modelDesc || device.model || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {device.localizacaoDesc || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {device.version || 'N/A'}
                        </TableCell>
                        <TableCell data-testid={`compliance-status-${device.serial}`}>
                          {device.complianceStatus === 'compliant' && (
                            <div className="flex items-center gap-1" data-testid={`status-compliant-${device.serial}`}>
                              <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <span className="text-sm text-green-600 dark:text-green-400">Conforme</span>
                            </div>
                          )}
                          {device.complianceStatus === 'non_compliant' && (
                            <div className="flex items-center gap-1" data-testid={`status-non-compliant-${device.serial}`}>
                              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                              <span className="text-sm text-red-600 dark:text-red-400">
                                {device.violationsCount || 0} {(device.violationsCount || 0) !== 1 ? 'violações' : 'violação'}
                              </span>
                            </div>
                          )}
                          {device.complianceStatus === 'unknown' && (
                            <div className="flex items-center gap-1" data-testid={`status-unknown-${device.serial}`}>
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              <span className="text-sm text-yellow-600 dark:text-yellow-400">Pendente</span>
                            </div>
                          )}
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
                        <TableCell>
                          <Link href={`/equipments/${device.serial}`}>
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

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} até {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} dispositivos
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(1)}
                      disabled={pagination.page === 1}
                      data-testid="button-first-page"
                    >
                      Primeira
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === pagination.page ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            data-testid={`button-page-${pageNum}`}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      data-testid="button-next-page"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(pagination.totalPages)}
                      disabled={pagination.page === pagination.totalPages}
                      data-testid="button-last-page"
                    >
                      Última
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
}
