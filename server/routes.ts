import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { ingestionService } from "./services/ingestion";
import { complianceService } from "./services/compliance";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.get("/api/devices/:serial", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const versions = await storage.getDeviceVersions(req.params.serial);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching device versions:", error);
      res.status(500).json({ message: "Failed to fetch device versions" });
    }
  });

  // Compliance
  app.get("/api/compliance/rules", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const rules = await storage.getComplianceRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching compliance rules:", error);
      res.status(500).json({ message: "Failed to fetch compliance rules" });
    }
  });

  app.post("/api/compliance/rules", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    
    // TODO: Implement user listing
    res.json([]);
  });

  // Compliance checking
  app.post("/api/compliance/check", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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

  const httpServer = createServer(app);
  return httpServer;
}
