import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  boolean, 
  integer, 
  bigserial,
  json,
  pgEnum,
  index
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'auditor', 'readonly']);
export const complianceStatusEnum = pgEnum('compliance_status', ['pass', 'fail']);
export const changeTypeEnum = pgEnum('change_type', ['added', 'removed', 'modified']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default('readonly'),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  failedAttempts: integer("failed_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
});

// Tenants table
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Devices table
export const devices = pgTable("devices", {
  serial: text("serial").primaryKey(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  hostname: text("hostname"),
  model: text("model"),
  tags: text("tags").array(),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastSeen: timestamp("last_seen").defaultNow(),
  vdomEnabled: boolean("vdom_enabled").default(false),
  primaryVdom: text("primary_vdom"),
}, (table) => ({
  tenantIdx: index("devices_tenant_idx").on(table.tenantId),
  modelIdx: index("devices_model_idx").on(table.model),
}));

// Device versions table
export const deviceVersions = pgTable("device_versions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceSerial: text("device_serial").notNull().references(() => devices.serial, { onDelete: "cascade" }),
  fortiosVersion: text("fortios_version"),
  build: text("build"),
  capturedAt: timestamp("captured_at").defaultNow(),
  fileHash: text("file_hash").notNull(),
  archivePath: text("archive_path").notNull(),
}, (table) => ({
  deviceIdx: index("device_versions_device_idx").on(table.deviceSerial),
  versionIdx: index("device_versions_version_idx").on(table.fortiosVersion),
  hashIdx: index("device_versions_hash_idx").on(table.fileHash),
}));

// Raw configurations table
export const configsRaw = pgTable("configs_raw", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceVersionId: integer("device_version_id").notNull().references(() => deviceVersions.id, { onDelete: "cascade" }),
  rawText: text("raw_text").notNull(),
});

// Firewall policies table
export const firewallPolicies = pgTable("firewall_policies", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceVersionId: integer("device_version_id").notNull().references(() => deviceVersions.id, { onDelete: "cascade" }),
  seq: integer("seq"),
  uuid: text("uuid"),
  srcAddr: text("src_addr").array(),
  dstAddr: text("dst_addr").array(),
  srcIntf: text("src_intf").array(),
  dstIntf: text("dst_intf").array(),
  service: text("service").array(),
  action: text("action"),
  schedule: text("schedule"),
  nat: boolean("nat"),
  log: boolean("log"),
  profiles: text("profiles").array(),
  geoipRestrict: text("geoip_restrict").array(),
  inspectionMode: text("inspection_mode"),
  vdom: text("vdom"),
}, (table) => ({
  deviceVersionIdx: index("firewall_policies_device_version_idx").on(table.deviceVersionId),
  serviceIdx: index("firewall_policies_service_idx").on(table.service),
  actionIdx: index("firewall_policies_action_idx").on(table.action),
}));

// System interfaces table
export const systemInterfaces = pgTable("system_interfaces", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceVersionId: integer("device_version_id").notNull().references(() => deviceVersions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ipCidr: text("ip_cidr"),
  mode: text("mode"),
  vlan: integer("vlan"),
  zone: text("zone"),
  status: text("status"),
  allowAccess: text("allow_access").array(),
  vdom: text("vdom"),
}, (table) => ({
  deviceVersionIdx: index("system_interfaces_device_version_idx").on(table.deviceVersionId),
  allowAccessIdx: index("system_interfaces_allow_access_idx").on(table.allowAccess),
}));

// System admins table
export const systemAdmins = pgTable("system_admins", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceVersionId: integer("device_version_id").notNull().references(() => deviceVersions.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  profile: text("profile"),
  trustedHosts: text("trusted_hosts").array(),
  twoFactor: boolean("two_factor"),
  publicKeySet: boolean("public_key_set"),
  vdomScope: text("vdom_scope"),
}, (table) => ({
  deviceVersionIdx: index("system_admins_device_version_idx").on(table.deviceVersionId),
  trustedHostsIdx: index("system_admins_trusted_hosts_idx").on(table.trustedHosts),
}));

// Object diffs table
export const objectDiffs = pgTable("object_diffs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceVersionId: integer("device_version_id").notNull().references(() => deviceVersions.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  changeType: changeTypeEnum("change_type").notNull(),
  diffJson: json("diff_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Compliance rules table
export const complianceRules = pgTable("compliance_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  severity: text("severity").notNull(),
  dsl: text("dsl").notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Compliance results table
export const complianceResults = pgTable("compliance_results", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceVersionId: integer("device_version_id").notNull().references(() => deviceVersions.id, { onDelete: "cascade" }),
  ruleId: varchar("rule_id").notNull().references(() => complianceRules.id, { onDelete: "cascade" }),
  status: complianceStatusEnum("status").notNull(),
  evidenceJson: json("evidence_json"),
  measuredAt: timestamp("measured_at").defaultNow(),
}, (table) => ({
  deviceVersionIdx: index("compliance_results_device_version_idx").on(table.deviceVersionId),
  ruleIdx: index("compliance_results_rule_idx").on(table.ruleId),
  statusIdx: index("compliance_results_status_idx").on(table.status),
}));

// Audit log table
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  when: timestamp("when").defaultNow(),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  target: text("target"),
  detailsJson: json("details_json"),
}, (table) => ({
  userIdx: index("audit_log_user_idx").on(table.userId),
  actionIdx: index("audit_log_action_idx").on(table.action),
  whenIdx: index("audit_log_when_idx").on(table.when),
}));

// Ingest errors table
export const ingestErrors = pgTable("ingest_errors", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  path: text("path").notNull(),
  fileHash: text("file_hash"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  quarantinedPath: text("quarantined_path"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLog),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  devices: many(devices),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [devices.tenantId],
    references: [tenants.id],
  }),
  versions: many(deviceVersions),
}));

export const deviceVersionsRelations = relations(deviceVersions, ({ one, many }) => ({
  device: one(devices, {
    fields: [deviceVersions.deviceSerial],
    references: [devices.serial],
  }),
  configRaw: one(configsRaw),
  firewallPolicies: many(firewallPolicies),
  systemInterfaces: many(systemInterfaces),
  systemAdmins: many(systemAdmins),
  objectDiffs: many(objectDiffs),
  complianceResults: many(complianceResults),
}));

export const configsRawRelations = relations(configsRaw, ({ one }) => ({
  deviceVersion: one(deviceVersions, {
    fields: [configsRaw.deviceVersionId],
    references: [deviceVersions.id],
  }),
}));

export const firewallPoliciesRelations = relations(firewallPolicies, ({ one }) => ({
  deviceVersion: one(deviceVersions, {
    fields: [firewallPolicies.deviceVersionId],
    references: [deviceVersions.id],
  }),
}));

export const systemInterfacesRelations = relations(systemInterfaces, ({ one }) => ({
  deviceVersion: one(deviceVersions, {
    fields: [systemInterfaces.deviceVersionId],
    references: [deviceVersions.id],
  }),
}));

export const systemAdminsRelations = relations(systemAdmins, ({ one }) => ({
  deviceVersion: one(deviceVersions, {
    fields: [systemAdmins.deviceVersionId],
    references: [deviceVersions.id],
  }),
}));

export const objectDiffsRelations = relations(objectDiffs, ({ one }) => ({
  deviceVersion: one(deviceVersions, {
    fields: [objectDiffs.deviceVersionId],
    references: [deviceVersions.id],
  }),
}));

export const complianceRulesRelations = relations(complianceRules, ({ many }) => ({
  results: many(complianceResults),
}));

export const complianceResultsRelations = relations(complianceResults, ({ one }) => ({
  deviceVersion: one(deviceVersions, {
    fields: [complianceResults.deviceVersionId],
    references: [deviceVersions.id],
  }),
  rule: one(complianceRules, {
    fields: [complianceResults.ruleId],
    references: [complianceRules.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
  failedAttempts: true,
  lockedUntil: true,
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  firstSeen: true,
  lastSeen: true,
});

export const insertDeviceVersionSchema = createInsertSchema(deviceVersions).omit({
  id: true,
  capturedAt: true,
});

export const insertComplianceRuleSchema = createInsertSchema(complianceRules).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  when: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertDeviceVersion = z.infer<typeof insertDeviceVersionSchema>;
export type DeviceVersion = typeof deviceVersions.$inferSelect;
export type InsertComplianceRule = z.infer<typeof insertComplianceRuleSchema>;
export type ComplianceRule = typeof complianceRules.$inferSelect;
export type ComplianceResult = typeof complianceResults.$inferSelect;
export type FirewallPolicy = typeof firewallPolicies.$inferSelect;
export type SystemInterface = typeof systemInterfaces.$inferSelect;
export type SystemAdmin = typeof systemAdmins.$inferSelect;
export type IngestError = typeof ingestErrors.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
