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

    for (const rule of rules) {
      try {
        const parsedRule = yaml.parse(rule.dsl) as ComplianceRule;
        parsedRule.name = rule.name; // Propagar o nome da regra para checkRule
        const results = await this.checkRule(parsedRule);
        
        for (const result of results) {
          await storage.insertComplianceResults([{
            deviceVersionId: result.deviceVersionId,
            ruleId: rule.id,
            status: result.status,
            evidenceJson: result.evidence,
            measuredAt: new Date()
          }]);

          if (result.status === 'fail') {
            violations++;
          }
        }
        
        rulesChecked++;
      } catch (error) {
        console.error(`Error checking compliance rule ${rule.name}:`, error);
      }
    }

    return { rulesChecked, violations };
  }

  private async checkRule(rule: ComplianceRule): Promise<Array<{
    deviceVersionId: number;
    status: 'pass' | 'fail';
    evidence: any;
  }>> {
    // This is a simplified compliance checker
    // In a real implementation, this would execute the DSL queries against the database
    
    const results: Array<{
      deviceVersionId: number;
      status: 'pass' | 'fail';
      evidence: any;
    }> = [];

    // Check firewall em locação com configuração recente
    if (rule.name === "Firewall em Locação com Configuração Recente") {
      const devicesInLocation = await storage.getDevicesWithStatusDescription("Locação");
      
      for (const device of devicesInLocation) {
        const latestVersion = await storage.getLatestDeviceVersion(device.serial);
        if (latestVersion && latestVersion.capturedAt) {
          const hoursAgo48 = new Date(Date.now() - 48 * 60 * 60 * 1000);
          const lastConfigUpdate = new Date(latestVersion.capturedAt);
          
          const status = lastConfigUpdate > hoursAgo48 ? 'pass' : 'fail';
          
          results.push({
            deviceVersionId: latestVersion.id,
            status,
            evidence: {
              serial: device.serial,
              hostname: device.hostname,
              statusDesc: device.statusDesc,
              lastConfigUpdate: latestVersion.capturedAt,
              model: device.model,
              rule: rule.name,
              hoursOld: Math.round((Date.now() - lastConfigUpdate.getTime()) / (60 * 60 * 1000))
            }
          });
        }
      }
    }
    // Example: Check admin trusted hosts rule
    else if (rule.target === 'system_admins' && rule.assert.includes('trusted_hosts')) {
      // This would normally execute a proper query based on the DSL
      // For now, we'll implement a basic check
      results.push({
        deviceVersionId: 1, // This would be dynamic
        status: 'fail',
        evidence: {
          admin: 'admin',
          trusted_hosts: [],
          rule: rule.name
        }
      });
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
        name: "Strong password policy",
        severity: "High", 
        dsl: yaml.stringify({
          target: "system_admins",
          assert: "two_factor = true OR public_key_set = true",
          evidence: {
            select: ["username", "two_factor", "public_key_set", "profile"]
          }
        }),
        description: "Admin users must use two-factor authentication or SSH keys",
        enabled: true
      },
      {
        name: "Interface security",
        severity: "Medium",
        dsl: yaml.stringify({
          target: "system_interfaces", 
          where: "name != 'lo'",
          assert: "allow_access.length = 0 OR (allow_access.includes('https') AND NOT allow_access.includes('http'))",
          evidence: {
            select: ["name", "allow_access", "zone", "ip_cidr"]
          }
        }),
        description: "Management interfaces should use HTTPS only, not HTTP",
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
