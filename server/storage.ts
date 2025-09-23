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
  ellevoConfigs,
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
  type InsertAuditLog,
  type EllevoConfig,
  type InsertEllevoConfig
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, count, sql, ilike } from "drizzle-orm";
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
  getDeviceBySerial(serial: string): Promise<Device | undefined>;
  createOrUpdateDevice(device: InsertDevice): Promise<Device>;
  getDevices(limit?: number): Promise<Device[]>;
  getDevicesSummary(): Promise<Array<Device & { 
    version: string; 
    lastUpdate: string; 
    policiesCount: number; 
    interfacesCount: number; 
    adminsCount: number; 
  }>>;
  getDeviceWithLatestVersion(serial: string): Promise<Device & { latestVersion?: DeviceVersion } | undefined>;
  
  // Device versions
  createDeviceVersion(version: InsertDeviceVersion): Promise<DeviceVersion>;
  getDeviceVersions(deviceSerial: string, limit?: number): Promise<DeviceVersion[]>;
  getDeviceVersionById(id: string): Promise<DeviceVersion | undefined>;
  getDeviceVersionByHash(hash: string): Promise<DeviceVersion | undefined>;
  getDeviceVersionsWithConfigData(): Promise<DeviceVersion[]>;
  
  // Configuration objects
  insertFirewallPolicies(policies: any[]): Promise<void>;
  insertSystemInterfaces(interfaces: any[]): Promise<void>;
  insertSystemAdmins(admins: any[]): Promise<void>;
  
  // Compliance
  getComplianceRules(): Promise<ComplianceRule[]>;
  createComplianceRule(rule: InsertComplianceRule): Promise<ComplianceRule>;
  insertComplianceResults(results: any[]): Promise<void>;
  clearComplianceResults(): Promise<void>;
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
  
  // Compliance specific methods
  getDevicesWithStatusDescription(statusDesc: string): Promise<Device[]>;
  getLatestDeviceVersion(deviceSerial: string): Promise<DeviceVersion | undefined>;
  
  // Ellevo Configuration management
  getEllevoConfig(): Promise<EllevoConfig | undefined>;
  createOrUpdateEllevoConfig(config: InsertEllevoConfig): Promise<EllevoConfig>;
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

  async getDevicesSummary(): Promise<Array<Device & { 
    version: string; 
    lastUpdate: string; 
    policiesCount: number; 
    interfacesCount: number; 
    adminsCount: number; 
  }>> {
    // First get all devices
    const allDevices = await this.getDevices();
    
    const devicesSummary = [];
    
    for (const device of allDevices) {
      // Get latest version for this device
      const [latestVersion] = await db
        .select()
        .from(deviceVersions)
        .where(eq(deviceVersions.deviceSerial, device.serial))
        .orderBy(desc(deviceVersions.capturedAt))
        .limit(1);
      
      let policiesCount = 0;
      let interfacesCount = 0;
      let adminsCount = 0;
      
      if (latestVersion) {
        // Count policies for this version
        const [policyCount] = await db
          .select({ count: count() })
          .from(firewallPolicies)
          .where(eq(firewallPolicies.deviceVersionId, latestVersion.id));
        policiesCount = policyCount.count;
        
        // Count interfaces for this version
        const [interfaceCount] = await db
          .select({ count: count() })
          .from(systemInterfaces)
          .where(eq(systemInterfaces.deviceVersionId, latestVersion.id));
        interfacesCount = interfaceCount.count;
        
        // Count admins for this version
        const [adminCount] = await db
          .select({ count: count() })
          .from(systemAdmins)
          .where(eq(systemAdmins.deviceVersionId, latestVersion.id));
        adminsCount = adminCount.count;
      }
      
      devicesSummary.push({
        ...device,
        version: latestVersion?.fortiosVersion || 'N/A',
        lastUpdate: latestVersion?.capturedAt?.toISOString() || device.lastSeen?.toISOString() || new Date().toISOString(),
        policiesCount,
        interfacesCount,
        adminsCount
      });
    }
    
    return devicesSummary;
  }

  async getDevicesSummaryPaginated(options: {
    page: number;
    limit: number;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    complianceFilter?: string;
  }): Promise<{
    devices: Array<Device & { 
      version: string; 
      lastUpdate: string; 
      policiesCount: number; 
      interfacesCount: number; 
      adminsCount: number; 
      complianceStatus?: 'compliant' | 'non_compliant' | 'unknown';
      violationsCount?: number;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit, search, sortBy, sortOrder, complianceFilter } = options;
    const offset = (page - 1) * limit;

    // Build search condition
    const searchCondition = search ? 
      or(
        ilike(devices.hostname, `%${search}%`),
        ilike(devices.serial, `%${search}%`),
        ilike(devices.model, `%${search}%`),
        ilike(devices.modelDesc, `%${search}%`),
        ilike(devices.localizacaoDesc, `%${search}%`),
        ilike(devices.statusDesc, `%${search}%`)
      ) : undefined;

    // Get total count for pagination
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(devices)
      .where(searchCondition);

    // Determine sort column
    let sortColumn;
    switch (sortBy) {
      case 'hostname':
        sortColumn = devices.hostname;
        break;
      case 'serial':
        sortColumn = devices.serial;
        break;
      case 'model':
        sortColumn = devices.modelDesc;
        break;
      case 'localizacaoDesc':
        sortColumn = devices.localizacaoDesc;
        break;
      case 'lastSeen':
        sortColumn = devices.lastSeen;
        break;
      default:
        sortColumn = devices.hostname;
    }

    // Build final query with search, sort and pagination
    let query = db.select().from(devices);
    
    if (searchCondition) {
      query = query.where(searchCondition);
    }

    if (sortOrder === 'desc') {
      query = query.orderBy(desc(sortColumn));
    } else {
      query = query.orderBy(asc(sortColumn));
    }

    // If compliance filter is applied, we need to get all devices first, then filter by compliance
    let devicesToProcess = [];
    let totalCountForCompliance = totalCount;
    
    if (complianceFilter === 'non_compliant') {
      // Get all devices that match search criteria (not paginated yet)
      let allDevicesQuery = db.select().from(devices);
      if (searchCondition) {
        allDevicesQuery = allDevicesQuery.where(searchCondition);
      }
      const allDevices = await allDevicesQuery;
      
      // Filter devices based on compliance status
      for (const device of allDevices) {
        const [latestVersion] = await db
          .select()
          .from(deviceVersions)
          .where(eq(deviceVersions.deviceSerial, device.serial))
          .orderBy(desc(deviceVersions.capturedAt))
          .limit(1);
          
        if (latestVersion) {
          // Check compliance results for this device version
          const violations = await db
            .select()
            .from(complianceResults)
            .where(and(
              eq(complianceResults.deviceVersionId, latestVersion.id),
              eq(complianceResults.status, 'fail')
            ));
            
          if (violations.length > 0) {
            devicesToProcess.push(device);
          }
        }
      }
      
      // Update total count for compliance-filtered results
      totalCountForCompliance = devicesToProcess.length;
      
      // Apply sorting to filtered devices
      if (sortOrder === 'desc') {
        devicesToProcess.sort((a, b) => {
          const aVal = (a as any)[sortBy] || '';
          const bVal = (b as any)[sortBy] || '';
          return bVal.localeCompare(aVal);
        });
      } else {
        devicesToProcess.sort((a, b) => {
          const aVal = (a as any)[sortBy] || '';
          const bVal = (b as any)[sortBy] || '';
          return aVal.localeCompare(bVal);
        });
      }
      
      // Apply pagination to compliance-filtered results
      devicesToProcess = devicesToProcess.slice(offset, offset + limit);
    } else {
      // Use normal pagination for non-filtered results
      const paginatedDevices = await query.limit(limit).offset(offset);
      devicesToProcess = paginatedDevices;
    }
    
    // Now get detailed info for each device in current page
    const devicesSummary = [];
    
    for (const device of devicesToProcess) {
      // Get latest version for this device
      const [latestVersion] = await db
        .select()
        .from(deviceVersions)
        .where(eq(deviceVersions.deviceSerial, device.serial))
        .orderBy(desc(deviceVersions.capturedAt))
        .limit(1);
      
      let policiesCount = 0;
      let interfacesCount = 0;
      let adminsCount = 0;
      let complianceStatus: 'compliant' | 'non_compliant' | 'unknown' = 'unknown';
      let violationsCount = 0;
      
      if (latestVersion) {
        // Count policies for this version
        const [policyCount] = await db
          .select({ count: count() })
          .from(firewallPolicies)
          .where(eq(firewallPolicies.deviceVersionId, latestVersion.id));
        policiesCount = policyCount.count;
        
        // Count interfaces for this version
        const [interfaceCount] = await db
          .select({ count: count() })
          .from(systemInterfaces)
          .where(eq(systemInterfaces.deviceVersionId, latestVersion.id));
        interfacesCount = interfaceCount.count;
        
        // Count admins for this version
        const [adminCount] = await db
          .select({ count: count() })
          .from(systemAdmins)
          .where(eq(systemAdmins.deviceVersionId, latestVersion.id));
        adminsCount = adminCount.count;
        
        // Get compliance status
        const complianceResultsForDevice = await db
          .select()
          .from(complianceResults)
          .where(eq(complianceResults.deviceVersionId, latestVersion.id));
          
        if (complianceResultsForDevice.length > 0) {
          const violations = complianceResultsForDevice.filter(r => r.status === 'fail');
          violationsCount = violations.length;
          complianceStatus = violations.length > 0 ? 'non_compliant' : 'compliant';
        }
      }
      
      devicesSummary.push({
        ...device,
        version: latestVersion?.fortiosVersion || 'N/A',
        lastUpdate: latestVersion?.capturedAt?.toISOString() || device.lastSeen?.toISOString() || new Date().toISOString(),
        policiesCount,
        interfacesCount,
        adminsCount,
        complianceStatus,
        violationsCount
      });
    }

    const totalPages = Math.ceil(totalCountForCompliance / limit);
    
    return {
      devices: devicesSummary,
      pagination: {
        page,
        limit,
        total: totalCountForCompliance,
        totalPages
      }
    };
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

  async getDeviceVersionById(id: string): Promise<DeviceVersion | undefined> {
    const [version] = await db
      .select()
      .from(deviceVersions)
      .where(eq(deviceVersions.id, parseInt(id)));
    return version || undefined;
  }

  async getDeviceVersionsWithConfigData(): Promise<DeviceVersion[]> {
    // Get all device versions that have at least one of:
    // - system admins data
    // - system interfaces data  
    // - firewall policies data
    const versionsWithAdmins = db
      .selectDistinct({ id: deviceVersions.id, deviceSerial: deviceVersions.deviceSerial, capturedAt: deviceVersions.capturedAt, fileHash: deviceVersions.fileHash, archivePath: deviceVersions.archivePath, fortiosVersion: deviceVersions.fortiosVersion, build: deviceVersions.build })
      .from(deviceVersions)
      .innerJoin(systemAdmins, eq(systemAdmins.deviceVersionId, deviceVersions.id));
    
    const versionsWithInterfaces = db
      .selectDistinct({ id: deviceVersions.id, deviceSerial: deviceVersions.deviceSerial, capturedAt: deviceVersions.capturedAt, fileHash: deviceVersions.fileHash, archivePath: deviceVersions.archivePath, fortiosVersion: deviceVersions.fortiosVersion, build: deviceVersions.build })
      .from(deviceVersions)
      .innerJoin(systemInterfaces, eq(systemInterfaces.deviceVersionId, deviceVersions.id));
      
    const versionsWithPolicies = db
      .selectDistinct({ id: deviceVersions.id, deviceSerial: deviceVersions.deviceSerial, capturedAt: deviceVersions.capturedAt, fileHash: deviceVersions.fileHash, archivePath: deviceVersions.archivePath, fortiosVersion: deviceVersions.fortiosVersion, build: deviceVersions.build })
      .from(deviceVersions)
      .innerJoin(firewallPolicies, eq(firewallPolicies.deviceVersionId, deviceVersions.id));
    
    // Union all and get unique device versions
    const allVersions = await db
      .select()
      .from(versionsWithAdmins.union(versionsWithInterfaces).union(versionsWithPolicies).as('unique_versions'));
    
    return allVersions;
  }

  async getDeviceBySerial(serial: string): Promise<Device | undefined> {
    return this.getDevice(serial);
  }

  async clearComplianceResults(): Promise<void> {
    await db.delete(complianceResults);
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
        ruleName: complianceRules.name,
        status: complianceResults.status,
        evidenceJson: complianceResults.evidenceJson,
        measuredAt: complianceResults.measuredAt
      })
      .from(complianceResults)
      .innerJoin(deviceVersions, eq(complianceResults.deviceVersionId, deviceVersions.id))
      .innerJoin(complianceRules, eq(complianceResults.ruleId, complianceRules.id))
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

  async getDevicesWithStatusDescription(statusDesc: string): Promise<Device[]> {
    const result = await db
      .select()
      .from(devices)
      .where(eq(devices.statusDesc, statusDesc));
    return result;
  }

  async getLatestDeviceVersion(deviceSerial: string): Promise<DeviceVersion | undefined> {
    const [version] = await db
      .select()
      .from(deviceVersions)
      .where(eq(deviceVersions.deviceSerial, deviceSerial))
      .orderBy(desc(deviceVersions.capturedAt))
      .limit(1);
    return version || undefined;
  }

  async getEllevoConfig(): Promise<EllevoConfig | undefined> {
    const [config] = await db
      .select()
      .from(ellevoConfigs)
      .orderBy(desc(ellevoConfigs.createdAt))
      .limit(1);
    return config || undefined;
  }

  async createOrUpdateEllevoConfig(insertConfig: InsertEllevoConfig): Promise<EllevoConfig> {
    // Verificar se já existe uma configuração
    const existingConfig = await this.getEllevoConfig();
    
    if (existingConfig) {
      // Atualizar configuração existente
      const [updatedConfig] = await db
        .update(ellevoConfigs)
        .set({
          ...insertConfig,
          updatedAt: new Date(),
        })
        .where(eq(ellevoConfigs.id, existingConfig.id))
        .returning();
      return updatedConfig;
    } else {
      // Criar nova configuração
      const [newConfig] = await db
        .insert(ellevoConfigs)
        .values(insertConfig)
        .returning();
      return newConfig;
    }
  }
}

export const storage = new DatabaseStorage();
