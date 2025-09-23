import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { ingestionService } from "./services/ingestion";
import { complianceService } from "./services/compliance";
import { inventorySyncService } from "./services/inventory-sync";
import { insertEllevoConfigSchema } from "@shared/schema";

// Helper function to check authentication (with dev bypass)
function requireAuth(req: any, res: any): boolean {
  // Skip auth in development if SKIP_AUTH is set
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    return true;
  }
  
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
    return false;
  }
  return true;
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Devices
  app.get("/api/devices", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  // Devices summary with counts, pagination, sorting and search
  app.get("/api/devices/summary", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const {
        page = '1',
        limit = '50',
        search = '',
        sortBy = 'hostname',
        sortOrder = 'asc',
        complianceFilter = ''
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string))); // Max 100 per page
      const searchTerm = (search as string).trim();
      const sortColumn = sortBy as string;
      const sortDirection = (sortOrder as string).toLowerCase() === 'desc' ? 'desc' : 'asc';
      const complianceFilterType = (complianceFilter as string).trim();

      const result = await storage.getDevicesSummaryPaginated({
        page: pageNum,
        limit: limitNum,
        search: searchTerm,
        sortBy: sortColumn,
        sortOrder: sortDirection,
        complianceFilter: complianceFilterType
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching devices summary:", error);
      res.status(500).json({ message: "Failed to fetch devices summary" });
    }
  });

  app.get("/api/devices/:serial", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const device = await storage.getDeviceWithLatestVersion(req.params.serial);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      console.error("Error fetching device:", error);
      res.status(500).json({ message: "Failed to fetch device" });
    }
  });

  app.get("/api/devices/:serial/versions", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const versions = await storage.getDeviceVersions(req.params.serial);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching device versions:", error);
      res.status(500).json({ message: "Failed to fetch device versions" });
    }
  });

  app.get("/api/device-versions/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const version = await storage.getDeviceVersionById(req.params.id);
      if (!version) {
        return res.status(404).json({ message: "Device version not found" });
      }
      res.json(version);
    } catch (error) {
      console.error("Error fetching device version:", error);
      res.status(500).json({ message: "Failed to fetch device version" });
    }
  });

  // Configuration endpoints
  app.get("/api/devices/:serial/firewall-policies", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const policies = await storage.getFirewallPolicies(req.params.serial);
      res.json(policies);
    } catch (error) {
      console.error("Error fetching firewall policies:", error);
      res.status(500).json({ message: "Failed to fetch firewall policies" });
    }
  });

  app.get("/api/devices/:serial/system-interfaces", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const interfaces = await storage.getSystemInterfaces(req.params.serial);
      res.json(interfaces);
    } catch (error) {
      console.error("Error fetching system interfaces:", error);
      res.status(500).json({ message: "Failed to fetch system interfaces" });
    }
  });

  app.get("/api/devices/:serial/system-admins", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const admins = await storage.getSystemAdmins(req.params.serial);
      res.json(admins);
    } catch (error) {
      console.error("Error fetching system admins:", error);
      res.status(500).json({ message: "Failed to fetch system admins" });
    }
  });

  // Compliance
  app.get("/api/compliance/rules", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const rules = await storage.getComplianceRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching compliance rules:", error);
      res.status(500).json({ message: "Failed to fetch compliance rules" });
    }
  });

  app.post("/api/compliance/rules", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const rule = await storage.createComplianceRule(req.body);
      await storage.logAudit({
        userId: req.user.id,
        action: "create_compliance_rule",
        target: rule.id,
        detailsJson: { name: rule.name, severity: rule.severity }
      });
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating compliance rule:", error);
      res.status(500).json({ message: "Failed to create compliance rule" });
    }
  });

  app.get("/api/devices/:serial/compliance", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const results = await storage.getComplianceResultsForDevice(req.params.serial);
      res.json(results);
    } catch (error) {
      console.error("Error fetching compliance results:", error);
      res.status(500).json({ message: "Failed to fetch compliance results" });
    }
  });

  // Ingestion
  app.post("/api/ingestion/trigger", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const result = await ingestionService.triggerManualIngestion();
      await storage.logAudit({
        userId: req.user.id,
        action: "trigger_manual_ingestion",
        target: "ingestion_service",
        detailsJson: result
      });
      res.json(result);
    } catch (error) {
      console.error("Error triggering manual ingestion:", error);
      res.status(500).json({ message: "Failed to trigger ingestion" });
    }
  });

  // Quarantine
  app.get("/api/quarantine", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const errors = await storage.getIngestErrors();
      res.json(errors);
    } catch (error) {
      console.error("Error fetching quarantine items:", error);
      res.status(500).json({ message: "Failed to fetch quarantine items" });
    }
  });

  // Audit logs
  app.get("/api/audit", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role === 'readonly') return res.sendStatus(403);
    
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // User management
  app.get("/api/users", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    // TODO: Implement user listing
    res.json([]);
  });

  // Compliance checking
  app.post("/api/compliance/check", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const result = await complianceService.runComplianceCheck();
      await storage.logAudit({
        userId: req.user.id,
        action: "run_compliance_check",
        target: "compliance_service",
        detailsJson: result
      });
      res.json(result);
    } catch (error) {
      console.error("Error running compliance check:", error);
      res.status(500).json({ message: "Failed to run compliance check" });
    }
  });

  // Get all compliance results
  app.get("/api/compliance/results", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const results = await storage.getAllComplianceResults();
      res.json(results);
    } catch (error) {
      console.error("Error fetching compliance results:", error);
      res.status(500).json({ message: "Failed to fetch compliance results" });
    }
  });

  // Get compliance statistics
  app.get("/api/compliance/stats", async (req, res) => {
    if (!requireAuth(req, res)) return;
    
    try {
      const stats = await storage.getComplianceStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching compliance stats:", error);
      res.status(500).json({ message: "Failed to fetch compliance stats" });
    }
  });

  // Alternative evaluation endpoint for API consistency
  app.post("/api/compliance/evaluate", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const result = await complianceService.runComplianceCheck();
      await storage.logAudit({
        userId: req.user.id,
        action: "run_compliance_check",
        target: "compliance_service",
        detailsJson: result
      });
      res.json(result);
    } catch (error) {
      console.error("Error running compliance evaluation:", error);
      res.status(500).json({ message: "Failed to run compliance evaluation" });
    }
  });

  // Inventory synchronization endpoints
  app.get("/api/inventory/test-connection", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const isConnected = await inventorySyncService.testConnection();
      res.json({ connected: isConnected });
    } catch (error) {
      console.error("Error testing inventory connection:", error);
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  app.post("/api/inventory/sync", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const result = await inventorySyncService.syncInventory();
      await storage.logAudit({
        userId: req.user.id,
        action: "sync_inventory",
        target: "inventory_service",
        detailsJson: result
      });
      res.json(result);
    } catch (error) {
      console.error("Error syncing inventory:", error);
      res.status(500).json({ message: "Failed to sync inventory" });
    }
  });

  // Ellevo Configuration endpoints
  app.get("/api/ellevo-config", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const config = await storage.getEllevoConfig();
      if (!config) {
        return res.json({
          server: "",
          port: "1433",
          database: "",
          username: "",
          password: ""
        });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching Ellevo config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/ellevo-config", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const validatedConfig = insertEllevoConfigSchema.parse(req.body);
      const config = await storage.createOrUpdateEllevoConfig(validatedConfig);
      
      await storage.logAudit({
        userId: req.user.id,
        action: "update_ellevo_config",
        target: "ellevo_configuration",
        detailsJson: { server: config.server, database: config.database }
      });
      
      // Restart inventory sync service with new configuration
      try {
        const restartInventorySync = (global as any).restartInventorySync;
        if (typeof restartInventorySync === 'function') {
          console.log(`[API] 🔄 Reiniciando serviço de sincronização após salvar configuração`);
          // Don't await to avoid blocking the response
          restartInventorySync().catch((err: any) => {
            console.error('Erro ao reiniciar sincronização:', err);
          });
        }
      } catch (restartError) {
        console.error("Error restarting inventory sync:", restartError);
        // Don't fail the config save if restart fails
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error saving Ellevo config:", error);
      res.status(500).json({ message: "Failed to save configuration" });
    }
  });

  app.post("/api/ellevo-sync/test", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      const config = req.body;
      const testResult = await inventorySyncService.testConnectionWithConfig(config);
      
      await storage.logAudit({
        userId: req.user.id,
        action: "test_ellevo_connection",
        target: "ellevo_configuration",
        detailsJson: { success: testResult.success, server: config.server }
      });
      
      res.json(testResult);
    } catch (error) {
      console.error("Error testing Ellevo connection:", error);
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  app.post("/api/ellevo-sync/force", async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    try {
      console.log(`[API] 🔄 Sincronização manual iniciada por ${req.user.username}`);
      const syncResult = await inventorySyncService.syncInventory();
      
      await storage.logAudit({
        userId: req.user.id,
        action: "force_inventory_sync",
        target: "inventory_system",
        detailsJson: { synced: syncResult.synced, errors: syncResult.errors }
      });
      
      console.log(`[API] ✅ Sincronização manual concluída: ${syncResult.synced} sincronizados, ${syncResult.errors} erros`);
      res.json({
        success: true,
        message: `Sincronização concluída com sucesso. ${syncResult.synced} equipamentos sincronizados${syncResult.errors > 0 ? `, ${syncResult.errors} com erro` : ''}`,
        synced: syncResult.synced,
        errors: syncResult.errors
      });
    } catch (error) {
      console.error("Error forcing inventory sync:", error);
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Check if sync is already in progress
      if (error instanceof Error && error.message.includes('já está em andamento')) {
        await storage.logAudit({
          userId: req.user.id,
          action: "force_inventory_sync_conflict",
          target: "inventory_system",
          detailsJson: { error: "Sync already in progress" }
        });
        
        return res.status(409).json({ 
          success: false,
          message: "Sincronização já está em andamento. Aguarde a conclusão." 
        });
      }
      
      await storage.logAudit({
        userId: req.user.id,
        action: "force_inventory_sync_failed",
        target: "inventory_system",
        detailsJson: { error: errorMsg }
      });
      
      res.status(500).json({ 
        success: false,
        message: `Erro na sincronização: ${errorMsg}` 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
