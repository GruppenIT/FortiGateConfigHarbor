import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Shield, Users, Network } from "lucide-react";

export default function Configurations() {
  return (
    <MainLayout title="Configuration Management">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-6">
            <p className="text-muted-foreground">
              View and analyze FortiGate configuration objects across your infrastructure.
            </p>
          </div>

          <Tabs defaultValue="policies" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-1/2">
              <TabsTrigger value="policies" data-testid="tab-policies">
                <Shield className="h-4 w-4 mr-2" />
                Policies
              </TabsTrigger>
              <TabsTrigger value="interfaces" data-testid="tab-interfaces">
                <Network className="h-4 w-4 mr-2" />
                Interfaces
              </TabsTrigger>
              <TabsTrigger value="admins" data-testid="tab-admins">
                <Users className="h-4 w-4 mr-2" />
                Admins
              </TabsTrigger>
              <TabsTrigger value="objects" data-testid="tab-objects">
                <Settings className="h-4 w-4 mr-2" />
                Objects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="policies">
              <Card>
                <CardHeader>
                  <CardTitle>Firewall Policies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No firewall policies found</h3>
                    <p className="text-muted-foreground">
                      Firewall policies will appear here once device configurations are processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="interfaces">
              <Card>
                <CardHeader>
                  <CardTitle>System Interfaces</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No interfaces found</h3>
                    <p className="text-muted-foreground">
                      System interfaces will appear here once device configurations are processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admins">
              <Card>
                <CardHeader>
                  <CardTitle>System Administrators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No administrators found</h3>
                    <p className="text-muted-foreground">
                      System administrators will appear here once device configurations are processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="objects">
              <Card>
                <CardHeader>
                  <CardTitle>Configuration Objects</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No configuration objects found</h3>
                    <p className="text-muted-foreground">
                      Configuration objects will appear here once device configurations are processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </MainLayout>
  );
}
