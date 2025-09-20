import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ 
    username: "", 
    password: "", 
    displayName: "",
    role: "readonly" as const
  });

  // Redirect if already logged in - must be after all hooks
  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerForm);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">ConfigHarbor</CardTitle>
            <p className="text-sm text-muted-foreground">Gestão de Configuração FortiGate</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">Entrar</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Registrar</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Usuário</Label>
                    <Input
                      id="login-username"
                      data-testid="input-login-username"
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      placeholder="Digite seu usuário"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      data-testid="input-login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      placeholder="Digite sua senha"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Usuário</Label>
                    <Input
                      id="register-username"
                      data-testid="input-register-username"
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      placeholder="Escolha um usuário"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-display-name">Nome Completo</Label>
                    <Input
                      id="register-display-name"
                      data-testid="input-register-display-name"
                      type="text"
                      value={registerForm.displayName}
                      onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })}
                      placeholder="Digite seu nome completo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-role">Função</Label>
                    <Select value={registerForm.role} onValueChange={(value: any) => setRegisterForm({ ...registerForm, role: value })}>
                      <SelectTrigger data-testid="select-register-role">
                        <SelectValue placeholder="Selecione uma função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="readonly">Apenas Leitura</SelectItem>
                        <SelectItem value="auditor">Auditor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
                    <Input
                      id="register-password"
                      data-testid="input-register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      placeholder="Escolha uma senha forte"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={registerMutation.isPending}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? "Criando conta..." : "Criar Conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Hero Section */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-8 bg-primary">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-6">
            Gestão Segura de Configuração
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8">
            Automatize a ingestão de configurações FortiGate, verificação de conformidade e trilhas de auditoria com a plataforma de segurança empresarial ConfigHarbor.
          </p>
          <div className="space-y-4 text-sm text-primary-foreground/80">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
              <span>Processamento e validação automática de configurações</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
              <span>Monitoramento e relatórios de conformidade em tempo real</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
              <span>Trilha de auditoria completa e rastreamento de mudanças</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
