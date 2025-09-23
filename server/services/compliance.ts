import { storage } from '../storage';
import * as yaml from 'yaml';

interface ComplianceRule {
  id: string;
  name: string;
  severity: string;
  target: string;
  where?: string;
  assert: string;
  evidence: {
    select: string[];
  };
}

export class ComplianceService {
  async runComplianceCheck(): Promise<{ rulesChecked: number; violations: number }> {
    const rules = await storage.getComplianceRules();
    let rulesChecked = 0;
    let violations = 0;

    // Clear existing results first
    await storage.clearComplianceResults();
    
    console.log(`[COMPLIANCE] Starting compliance check for ${rules.length} rules...`);

    for (const rule of rules) {
      try {
        if (!rule.enabled) {
          console.log(`[COMPLIANCE] Skipping disabled rule: ${rule.name}`);
          continue;
        }
        
        console.log(`[COMPLIANCE] Checking rule: ${rule.name}`);
        const parsedRule = yaml.parse(rule.dsl) as ComplianceRule;
        parsedRule.name = rule.name; // Propagar o nome da regra para checkRule
        const results = await this.checkRule(parsedRule);
        
        console.log(`[COMPLIANCE] Rule '${rule.name}' generated ${results.length} results`);
        
        if (results.length > 0) {
          const complianceResults = results.map(result => ({
            deviceVersionId: result.deviceVersionId,
            ruleId: rule.id,
            status: result.status,
            evidenceJson: result.evidence,
            measuredAt: new Date()
          }));
          
          await storage.insertComplianceResults(complianceResults);

          const ruleViolations = results.filter(r => r.status === 'fail').length;
          violations += ruleViolations;
          console.log(`[COMPLIANCE] Rule '${rule.name}': ${ruleViolations} violations out of ${results.length} checks`);
        }
        
        rulesChecked++;
      } catch (error) {
        console.error(`[COMPLIANCE] Error checking compliance rule ${rule.name}:`, error);
      }
    }

    console.log(`[COMPLIANCE] Compliance check completed: ${rulesChecked} rules checked, ${violations} total violations`);
    return { rulesChecked, violations };
  }

  private async checkRule(rule: ComplianceRule): Promise<Array<{
    deviceVersionId: number;
    status: 'pass' | 'fail';
    evidence: any;
  }>> {
    const results: Array<{
      deviceVersionId: number;
      status: 'pass' | 'fail';
      evidence: any;
    }> = [];

    // Get all device versions that have configuration data
    const deviceVersionsWithData = await storage.getDeviceVersionsWithConfigData();
    
    for (const deviceVersion of deviceVersionsWithData) {
      try {
        let ruleResults: Array<{ status: 'pass' | 'fail'; evidence: any }> = [];
        
        // Check firewall em locação com configuração recente
        if (rule.name === "Firewall em Locação com Configuração Recente") {
          const device = await storage.getDeviceBySerial(deviceVersion.deviceSerial);
          if (device && device.statusDesc === "Locação") {
            const hoursAgo48 = new Date(Date.now() - 48 * 60 * 60 * 1000);
            const lastConfigUpdate = deviceVersion.capturedAt ? new Date(deviceVersion.capturedAt) : new Date(0);
            
            const status = lastConfigUpdate > hoursAgo48 ? 'pass' : 'fail';
            
            ruleResults.push({
              status,
              evidence: {
                serial: device.serial,
                hostname: device.hostname,
                statusDesc: device.statusDesc,
                lastConfigUpdate: deviceVersion.capturedAt,
                model: device.model,
                rule: rule.name,
                hoursOld: Math.round((Date.now() - lastConfigUpdate.getTime()) / (60 * 60 * 1000))
              }
            });
          }
        }
        
        // Check admin trusted hosts rule
        else if (rule.target === 'system_admins' && rule.assert.includes('trusted_hosts')) {
          const admins = await storage.getSystemAdmins(deviceVersion.deviceSerial);
          
          if (admins.length === 0) {
            // No admin data for this device version
            continue;
          }
          
          let deviceHasViolation = false;
          const deviceEvidence: any[] = [];
          
          for (const admin of admins) {
            // Check rule: "username != 'maintenance'" AND "trusted_hosts.length > 0"
            if (admin.username !== 'maintenance') {
              const hasTrustedHosts = admin.trustedHosts && admin.trustedHosts.length > 0;
              
              deviceEvidence.push({
                username: admin.username,
                trusted_hosts: admin.trustedHosts || [],
                profile: admin.profile,
                has_trusted_hosts: hasTrustedHosts
              });
              
              if (!hasTrustedHosts) {
                deviceHasViolation = true;
              }
            }
          }
          
          if (deviceEvidence.length > 0) {
            ruleResults.push({
              status: deviceHasViolation ? 'fail' : 'pass',
              evidence: {
                rule: rule.name,
                device_serial: deviceVersion.deviceSerial,
                admins: deviceEvidence,
                violation_count: deviceEvidence.filter(a => !a.has_trusted_hosts).length
              }
            });
          }
        }
        
        // Check strong password policy
        else if (rule.target === 'system_admins' && rule.assert.includes('two_factor')) {
          const admins = await storage.getSystemAdmins(deviceVersion.deviceSerial);
          
          if (admins.length === 0) {
            continue;
          }
          
          let deviceHasViolation = false;
          const deviceEvidence: any[] = [];
          
          for (const admin of admins) {
            const hasTwoFactor = admin.twoFactor === true;
            const hasPublicKey = admin.publicKeySet === true;
            const passesRule = hasTwoFactor || hasPublicKey;
            
            deviceEvidence.push({
              username: admin.username,
              two_factor: admin.twoFactor,
              public_key_set: admin.publicKeySet,
              profile: admin.profile,
              passes_rule: passesRule
            });
            
            if (!passesRule) {
              deviceHasViolation = true;
            }
          }
          
          ruleResults.push({
            status: deviceHasViolation ? 'fail' : 'pass',
            evidence: {
              rule: rule.name,
              device_serial: deviceVersion.deviceSerial,
              admins: deviceEvidence,
              violation_count: deviceEvidence.filter(a => !a.passes_rule).length
            }
          });
        }
        
        // Check interface security
        else if (rule.target === 'system_interfaces' && rule.assert.includes('allow_access')) {
          const interfaces = await storage.getSystemInterfaces(deviceVersion.deviceSerial);
          
          if (interfaces.length === 0) {
            continue;
          }
          
          let deviceHasViolation = false;
          const deviceEvidence: any[] = [];
          
          for (const intf of interfaces) {
            // Skip loopback interface
            if (intf.name === 'lo') {
              continue;
            }
            
            const allowAccess = intf.allowAccess || [];
            // Rule: allow_access.length = 0 OR (allow_access.includes('https') AND NOT allow_access.includes('http'))
            const hasNoAccess = allowAccess.length === 0;
            const hasHttpsOnly = allowAccess.includes('https') && !allowAccess.includes('http');
            const passesRule = hasNoAccess || hasHttpsOnly;
            
            deviceEvidence.push({
              name: intf.name,
              allow_access: allowAccess,
              zone: intf.zone,
              ip_cidr: intf.ipCidr,
              passes_rule: passesRule
            });
            
            if (!passesRule) {
              deviceHasViolation = true;
            }
          }
          
          if (deviceEvidence.length > 0) {
            ruleResults.push({
              status: deviceHasViolation ? 'fail' : 'pass',
              evidence: {
                rule: rule.name,
                device_serial: deviceVersion.deviceSerial,
                interfaces: deviceEvidence,
                violation_count: deviceEvidence.filter(i => !i.passes_rule).length
              }
            });
          }
        }
        
        // Add results for this device version
        for (const ruleResult of ruleResults) {
          results.push({
            deviceVersionId: deviceVersion.id,
            status: ruleResult.status,
            evidence: ruleResult.evidence
          });
        }
        
      } catch (error) {
        console.error(`Error checking rule '${rule.name}' for device version ${deviceVersion.id}:`, error);
      }
    }

    return results;
  }

  async initializeDefaultRules(): Promise<void> {
    const defaultRules = [
      {
        name: "Admins with trusted hosts",
        severity: "Critical",
        dsl: yaml.stringify({
          target: "system_admins",
          where: "username != 'maintenance'",
          assert: "trusted_hosts.length > 0",
          evidence: {
            select: ["username", "trusted_hosts", "profile"]
          }
        }),
        description: "All admin users (except maintenance) must have trusted host restrictions configured",
        enabled: true
      },
      {
        name: "Firewall em Locação com Configuração Recente",
        severity: "High",
        dsl: yaml.stringify({
          target: "devices",
          where: "statusDesc = 'Locação'",
          assert: "last_configuration_update > 48_hours_ago",
          evidence: {
            select: ["serial", "hostname", "statusDesc", "last_configuration_update", "model"]
          }
        }),
        description: "Firewalls em locação devem receber configuração nas últimas 48 horas",
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      try {
        const existing = await storage.getComplianceRules();
        const ruleExists = existing.some(r => r.name === rule.name);
        
        if (!ruleExists) {
          await storage.createComplianceRule(rule);
        }
      } catch (error) {
        console.error(`Error creating default rule ${rule.name}:`, error);
      }
    }
  }
}

export const complianceService = new ComplianceService();
