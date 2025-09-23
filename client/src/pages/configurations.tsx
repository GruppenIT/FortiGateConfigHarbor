import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Database, TestTube, Save, Loader2, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface EllevoConfig {
  server: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

export default function Configurations() {
  const { toast } = useToast();
  const [config, setConfig] = useState<EllevoConfig>({
    server: "",
    port: "1433",
    database: "",
    username: "",
    password: ""
  });

  // Carregar configuração atual
  const { data: currentConfig, isLoading } = useQuery<EllevoConfig>({
    queryKey: ['/api/ellevo-config'],
  });

  // Salvar configuração
  const saveConfigMutation = useMutation({
    mutationFn: async (config: EllevoConfig) => {
      const response = await fetch("/api/ellevo-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Erro ao salvar configuração");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "Parâmetros do Sistema Ellevo foram salvos com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ellevo-config'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a configuração.",
      });
    }
  });

  // Testar sincronização
  const testSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ellevo-sync/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Erro ao testar conexão");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Teste concluído",
        description: `Conexão ${data.success ? 'bem-sucedida' : 'falhou'}. ${data.message || ''}`,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível testar a conexão.",
      });
    }
  });

  // Forçar sincronização
  const forceSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ellevo-sync/force", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Erro ao forçar sincronização");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Sincronização concluída" : "Erro na sincronização",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
      // Invalidar cache dos equipamentos para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível executar a sincronização.",
      });
    }
  });

  // Inicializar formulário com dados carregados
  useEffect(() => {
    if (currentConfig && config.server === "") {
      setConfig(currentConfig);
    }
  }, [currentConfig, config.server]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate(config);
  };

  const handleTestSync = () => {
    testSyncMutation.mutate();
  };

  const handleForceSync = () => {
    forceSyncMutation.mutate();
  };

  if (isLoading) {
    return (
      <MainLayout title="Configurações">
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Configurações">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground flex items-center">
              <Settings className="h-6 w-6 mr-3" />
              Configurações do Sistema
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure os parâmetros de integração com o Sistema Ellevo.
            </p>
          </div>

          {/* Configuração Sistema Ellevo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Integração Sistema Ellevo</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Servidor e Porta */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="server">Servidor IP/Host</Label>
                    <Input
                      id="server"
                      type="text"
                      placeholder="192.168.100.18"
                      value={config.server}
                      onChange={(e) => setConfig({...config, server: e.target.value})}
                      data-testid="input-ellevo-server"
                    />
                  </div>
                  <div>
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="1433"
                      value={config.port}
                      onChange={(e) => setConfig({...config, port: e.target.value})}
                      data-testid="input-ellevo-port"
                    />
                  </div>
                </div>

                {/* Banco de Dados */}
                <div>
                  <Label htmlFor="database">Banco de Dados</Label>
                  <Input
                    id="database"
                    type="text"
                    placeholder="PlataformaEllevo"
                    value={config.database}
                    onChange={(e) => setConfig({...config, database: e.target.value})}
                    data-testid="input-ellevo-database"
                  />
                </div>

                {/* Usuário e Senha */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="username">Usuário</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="usuário de conexão"
                      value={config.username}
                      onChange={(e) => setConfig({...config, username: e.target.value})}
                      data-testid="input-ellevo-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="senha de conexão"
                      value={config.password}
                      onChange={(e) => setConfig({...config, password: e.target.value})}
                      data-testid="input-ellevo-password"
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-4 pt-4">
                  <Button 
                    type="submit" 
                    disabled={saveConfigMutation.isPending}
                    data-testid="button-save-config"
                  >
                    {saveConfigMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Configuração
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleTestSync}
                    disabled={testSyncMutation.isPending || !config.server || !config.username}
                    data-testid="button-test-sync"
                  >
                    {testSyncMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Testar Sync
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="secondary"
                    onClick={handleForceSync}
                    disabled={forceSyncMutation.isPending || !config.server || !config.username}
                    data-testid="button-force-sync"
                  >
                    {forceSyncMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Forçar Sincronização
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </MainLayout>
  );
}