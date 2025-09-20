import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Devices from "@/pages/devices";
import DeviceDetail from "@/pages/device-detail";
import Configurations from "@/pages/configurations";
import Compliance from "@/pages/compliance";
import Ingestion from "@/pages/ingestion";
import Quarantine from "@/pages/quarantine";
import UserManagement from "@/pages/user-management";
import AuditLog from "@/pages/audit-log";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/devices/:serial" component={DeviceDetail} />
      <ProtectedRoute path="/devices" component={Devices} />
      <ProtectedRoute path="/configurations" component={Configurations} />
      <ProtectedRoute path="/compliance" component={Compliance} />
      <ProtectedRoute path="/ingestion" component={Ingestion} />
      <ProtectedRoute path="/quarantine" component={Quarantine} />
      <ProtectedRoute path="/users" component={UserManagement} />
      <ProtectedRoute path="/audit" component={AuditLog} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
