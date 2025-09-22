import { 
  users, 
  tenants,
  devices, 
  deviceVersions,
  firewallPolicies,
  systemInterfaces,
  systemAdmins,
  complianceRules,
  complianceResults,
  auditLog,
  ingestErrors,
  type User, 
  type InsertUser,
  type Device,
  type InsertDevice,
  type DeviceVersion,
  type InsertDeviceVersion,
  type ComplianceRule,
  type InsertComplianceRule,
  type ComplianceResult,
  type FirewallPolicy,
  type SystemInterface,
  type SystemAdmin,
  type IngestError,
  type AuditLog,
  type InsertAuditLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  // Database connection
  testConnection(): Promise<void>;
  
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  incrementFailedAttempts(id: string): Promise<void>;
  resetFailedAttempts(id: string): Promise<void>;
  lockUser(id: string, until: Date): Promise<void>;
  
  // Device management
  getDevice(serial: string): Promise<Device | undefined>;
  createOrUpdateDevice(device: InsertDevice): Promise<Device>;
  getDevices(limit?: number): Promise<Device[]>;
  getDeviceWithLatestVersion(serial: string): Promise<Device & { latestVersion?: DeviceVersion } | undefined>;
  
  // Device versions
  createDeviceVersion(version: InsertDeviceVersion): Promise<DeviceVersion>;
  getDeviceVersions(deviceSerial: string, limit?: number): Promise<DeviceVersion[]>;
  getDeviceVersionByHash(hash: string): Promise<DeviceVersion | undefined>;
  
  // Configuration objects
  insertFirewallPolicies(policies: any[]): Promise<void>;
  insertSystemInterfaces(interfaces: any[]): Promise<void>;
  insertSystemAdmins(admins: any[]): Promise<void>;
  
  // Compliance
  getComplianceRules(): Promise<ComplianceRule[]>;
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  insertComplianceResults(results: any[]): Promise<void>;
  getComplianceResultsForDevice(deviceSerial: string): Promise<ComplianceResult[]>;
  getAllComplianceResults(): Promise<ComplianceResult[]>;
  getComplianceStats(): Promise<{
    compliantDevices: number;
    violations: number;
    warnings: number;
    lastCheck: Date | null;
  }>;
  
  // Metrics and dashboard
  getDashboardMetrics(): Promise<{
    totalDevices: number;
    complianceScore: number;
    filesIngestedToday: number;
    quarantinedFiles: number;
  }>;
  
  // Audit logging
  logAudit(log: InsertAuditLog): Promise<void>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  
  // Error handling
  logIngestError(error: Omit<IngestError, 'id' | 'createdAt'>): Promise<void>;
  getIngestErrors(limit?: number): Promise<IngestError[]>;
  
  // Configuration retrieval
  getFirewallPolicies(deviceSerial: string): Promise<FirewallPolicy[]>;
  getSystemInterfaces(deviceSerial: string): Promise<SystemInterface[]>;
  getSystemAdmins(deviceSerial: string): Promise<SystemAdmin[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      tableName: 'session',
      createTableIfMissing: true 
    });
  }

  async testConnection(): Promise<void> {
    try {
      const startTime = Date.now();
      // Teste robusto de conectividade usando pool diretamente
      const result = await pool.query('SELECT 1 as connection_test, NOW() as timestamp');
      const duration = Date.now() - startTime;
      
      if (result.rows.length === 0) {
        throw new Error('Query retornou resultado vazio');
      }
      
      console.log(`✅ Conectividade com banco OK (${duration}ms) - Timestamp: ${result.rows[0].timestamp}`);
    } catch (error) {
      const errorMsg = `Falha na conectividade com PostgreSQL: ${String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await db
      .update(users)
      .set({ failedAttempts: sql`${users.failedAttempts} + 1` })
      .where(eq(users.id, id));
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await db
      .update(users)
      .set({ failedAttempts: 0 })
      .where(eq(users.id, id));
  }

  async lockUser(id: string, until: Date): Promise<void> {
    await db
      .update(users)
      .set({ lockedUntil: until })
      .where(eq(users.id, id));
  }

  async getDevice(serial: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.serial, serial));
    return device || undefined;
  }

  async createOrUpdateDevice(device: InsertDevice): Promise<Device> {
    const [result] = await db
      .insert(devices)
      .values({ ...device, lastSeen: new Date() })
      .onConflictDoUpdate({
        target: devices.serial,
        set: { 
          hostname: device.hostname,
          model: device.model,
          tags: device.tags,
          lastSeen: new Date(),
          vdomEnabled: device.vdomEnabled,
          primaryVdom: device.primaryVdom
        }
      })
      .returning();
    return result;
  }

  async getDevices(limit = 100): Promise<Device[]> {
    return await db
      .select()
      .from(devices)
      .orderBy(desc(devices.lastSeen))
      .limit(limit);
  }

  async getDeviceWithLatestVersion(serial: string): Promise<Device & { latestVersion?: DeviceVersion } | undefined> {
    const device = await this.getDevice(serial);
    if (!device) return undefined;

    const [latestVersion] = await db
      .select()
      .from(deviceVersions)
      .where(eq(deviceVersions.deviceSerial, serial))
      .orderBy(desc(deviceVersions.capturedAt))
      .limit(1);

    return { ...device, latestVersion };
  }

  async createDeviceVersion(version: InsertDeviceVersion): Promise<DeviceVersion> {
    const [result] = await db
      .insert(deviceVersions)
      .values(version)
      .returning();
    return result;
  }

  async getDeviceVersions(deviceSerial: string, limit = 50): Promise<DeviceVersion[]> {
    return await db
      .select()
      .from(deviceVersions)
      .where(eq(deviceVersions.deviceSerial, deviceSerial))
      .orderBy(desc(deviceVersions.capturedAt))
      .limit(limit);
  }

  async getDeviceVersionByHash(hash: string): Promise<DeviceVersion | undefined> {
    const [version] = await db
      .select()
      .from(deviceVersions)
      .where(eq(deviceVersions.fileHash, hash));
    return version || undefined;
  }

  async insertFirewallPolicies(policies: any[]): Promise<void> {
    if (policies.length > 0) {
      await db.insert(firewallPolicies).values(policies);
    }
  }

  async insertSystemInterfaces(interfaces: any[]): Promise<void> {
    if (interfaces.length > 0) {
      await db.insert(systemInterfaces).values(interfaces);
    }
  }

  async insertSystemAdmins(admins: any[]): Promise<void> {
    if (admins.length > 0) {
      await db.insert(systemAdmins).values(admins);
    }
  }

  async getComplianceRules(): Promise<ComplianceRule[]> {
    return await db
      .select()
      .from(complianceRules)
      .where(eq(complianceRules.enabled, true))
      .orderBy(complianceRules.name);
  }

  async createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule> {
    const [result] = await db
      .insert(complianceRules)
      .values(rule)
      .returning();
    return result;
  }

  async insertComplianceResults(results: any[]): Promise<void> {
    if (results.length > 0) {
      await db.insert(complianceResults).values(results);
    }
  }

  async getComplianceResultsForDevice(deviceSerial: string): Promise<ComplianceResult[]> {
    const results = await db
      .select({
        id: complianceResults.id,
        deviceVersionId: complianceResults.deviceVersionId,
        ruleId: complianceResults.ruleId,
        status: complianceResults.status,
        evidenceJson: complianceResults.evidenceJson,
        measuredAt: complianceResults.measuredAt
      })
      .from(complianceResults)
      .innerJoin(deviceVersions, eq(complianceResults.deviceVersionId, deviceVersions.id))
      .where(eq(deviceVersions.deviceSerial, deviceSerial))
      .orderBy(desc(complianceResults.measuredAt));
    
    return results;
  }

  async getDashboardMetrics(): Promise<{
    totalDevices: number;
    complianceScore: number;
    filesIngestedToday: number;
    quarantinedFiles: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalDevicesResult] = await db
      .select({ count: count() })
      .from(devices);

    const [filesTodayResult] = await db
      .select({ count: count() })
      .from(deviceVersions)
      .where(sql`${deviceVersions.capturedAt} >= ${today}`);

    const [quarantinedResult] = await db
      .select({ count: count() })
      .from(ingestErrors);

    // Calculate compliance score
    const [passResult] = await db
      .select({ count: count() })
      .from(complianceResults)
      .where(eq(complianceResults.status, 'pass'));

    const [totalResult] = await db
      .select({ count: count() })
      .from(complianceResults);

    const complianceScore = totalResult.count > 0 
      ? Math.round((passResult.count / totalResult.count) * 100 * 10) / 10
      : 100;

    return {
      totalDevices: totalDevicesResult.count,
      complianceScore,
      filesIngestedToday: filesTodayResult.count,
      quarantinedFiles: quarantinedResult.count,
    };
  }

  async logAudit(log: InsertAuditLog): Promise<void> {
    await db.insert(auditLog).values(log);
  }

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.when))
      .limit(limit);
  }

  async logIngestError(error: Omit<IngestError, 'id' | 'createdAt'>): Promise<void> {
    await db.insert(ingestErrors).values(error);
  }

  async getIngestErrors(limit = 100): Promise<IngestError[]> {
    return await db
      .select()
      .from(ingestErrors)
      .orderBy(desc(ingestErrors.createdAt))
      .limit(limit);
  }

  async getAllComplianceResults(): Promise<ComplianceResult[]> {
    return await db
      .select()
      .from(complianceResults)
      .orderBy(desc(complianceResults.measuredAt));
  }

  async getComplianceStats(): Promise<{
    compliantDevices: number;
    violations: number;
    warnings: number;
    lastCheck: Date | null;
  }> {
    // Get unique devices that are compliant (all rules pass)
    const compliantDevicesQuery = await db
      .select({
        deviceVersionId: complianceResults.deviceVersionId
      })
      .from(complianceResults)
      .groupBy(complianceResults.deviceVersionId)
      .having(sql`COUNT(CASE WHEN ${complianceResults.status} = 'fail' THEN 1 END) = 0`);

    // Get violations (fail status)
    const [violationsResult] = await db
      .select({ count: count() })
      .from(complianceResults)
      .where(eq(complianceResults.status, 'fail'));

    // Get last check date
    const [lastCheckResult] = await db
      .select({ measuredAt: complianceResults.measuredAt })
      .from(complianceResults)
      .orderBy(desc(complianceResults.measuredAt))
      .limit(1);

    return {
      compliantDevices: compliantDevicesQuery.length,
      violations: violationsResult.count,
      warnings: 0, // We don't have warnings in our current schema
      lastCheck: lastCheckResult?.measuredAt || null,
    };
  }

  async getFirewallPolicies(deviceSerial: string): Promise<FirewallPolicy[]> {
    console.log(`[DEBUG] Buscando firewall policies para dispositivo: ${deviceSerial}`);
    const result = await db
      .select()
      .from(firewallPolicies)
      .innerJoin(deviceVersions, eq(firewallPolicies.deviceVersionId, deviceVersions.id))
      .where(eq(deviceVersions.deviceSerial, deviceSerial))
      .then(rows => rows.map(row => row.firewall_policies));
    console.log(`[DEBUG] Encontradas ${result.length} políticas para dispositivo ${deviceSerial}`);
    return result;
  }

  async getSystemInterfaces(deviceSerial: string): Promise<SystemInterface[]> {
    console.log(`[DEBUG] Buscando system interfaces para dispositivo: ${deviceSerial}`);
    const result = await db
      .select()
      .from(systemInterfaces)
      .innerJoin(deviceVersions, eq(systemInterfaces.deviceVersionId, deviceVersions.id))
      .where(eq(deviceVersions.deviceSerial, deviceSerial))
      .then(rows => rows.map(row => row.system_interfaces));
    console.log(`[DEBUG] Encontradas ${result.length} interfaces para dispositivo ${deviceSerial}`);
    return result;
  }

  async getSystemAdmins(deviceSerial: string): Promise<SystemAdmin[]> {
    console.log(`[DEBUG] Buscando system admins para dispositivo: ${deviceSerial}`);
    const result = await db
      .select()
      .from(systemAdmins)
      .innerJoin(deviceVersions, eq(systemAdmins.deviceVersionId, deviceVersions.id))
      .where(eq(deviceVersions.deviceSerial, deviceSerial))
      .then(rows => rows.map(row => row.system_admins));
    console.log(`[DEBUG] Encontrados ${result.length} admins para dispositivo ${deviceSerial}`);
    return result;
  }
}

export const storage = new DatabaseStorage();
