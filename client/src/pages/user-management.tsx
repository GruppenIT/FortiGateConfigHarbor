import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Plus, Search, UserCheck, UserX, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export default function UserManagement() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Mock users data - in real implementation this would come from API
  const users = [
    {
      id: "1",
      username: "admin",
      displayName: "Administrator",
      role: "admin",
      lastLogin: "2024-01-15T10:30:00Z",
      failedAttempts: 0,
      locked: false
    },
    {
      id: "2", 
      username: "auditor1",
      displayName: "Security Auditor",
      role: "auditor",
      lastLogin: "2024-01-14T16:45:00Z",
      failedAttempts: 0,
      locked: false
    }
  ];

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'auditor':
        return 'default';
      case 'readonly':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'auditor':
        return <UserCheck className="h-4 w-4" />;
      case 'readonly':
        return <Users className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout title="Gerenciamento de Usuários">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header Actions */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 max-w-md"
                  data-testid="input-user-search"
                />
              </div>
            </div>
            {user?.role === 'admin' && (
              <Button data-testid="button-add-user">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
            )}
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Usuários do Sistema</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredUsers.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Usuário
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Função
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Último Login
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-accent/50 transition-colors">
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                                <span className="text-xs font-medium text-primary-foreground">
                                  {u.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground" data-testid={`text-user-display-name-${u.id}`}>
                                  {u.displayName}
                                </p>
                                <p className="text-sm text-muted-foreground" data-testid={`text-user-username-${u.id}`}>
                                  {u.username}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <Badge variant={getRoleBadgeVariant(u.role)} data-testid={`badge-user-role-${u.id}`}>
                              <span className="mr-1">{getRoleIcon(u.role)}</span>
                              {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-user-last-login-${u.id}`}>
                            {u.lastLogin ? new Date(u.lastLogin).toLocaleString('pt-BR') : 'Nunca'}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <Badge variant={u.locked ? "destructive" : "default"} data-testid={`badge-user-status-${u.id}`}>
                              {u.locked ? (
                                <>
                                  <UserX className="h-3 w-3 mr-1" />
                                  Bloqueado
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Ativo
                                </>
                              )}
                            </Badge>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            {user?.role === 'admin' && (
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm" data-testid={`button-edit-user-${u.id}`}>
                                  Editar
                                </Button>
                                {u.locked ? (
                                  <Button variant="outline" size="sm" data-testid={`button-unlock-user-${u.id}`}>
                                    Desbloquear
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" data-testid={`button-lock-user-${u.id}`}>
                                    Bloquear
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum usuário encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? "Nenhum usuário corresponde aos critérios de busca." : "Nenhum usuário foi criado ainda."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Statistics */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total de Usuários</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-total-users">
                      {users.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-active-users">
                      {users.filter(u => !u.locked).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Shield className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Administrators</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-admin-users">
                      {users.filter(u => u.role === 'admin').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserX className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Locked Users</p>
                    <p className="text-2xl font-semibold text-foreground" data-testid="text-locked-users">
                      {users.filter(u => u.locked).length}
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
