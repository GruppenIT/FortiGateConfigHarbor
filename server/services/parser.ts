interface ParsedConfig {
  hostname?: string;
  model?: string;
  fortiosVersion?: string;
  build?: string;
  tenant?: string;
  vdomEnabled?: boolean;
  primaryVdom?: string;
  firewallPolicies: any[];
  systemInterfaces: any[];
  systemAdmins: any[];
}

export function parseFortiOSConfig(content: string): ParsedConfig {
  const result: ParsedConfig = {
    firewallPolicies: [],
    systemInterfaces: [],
    systemAdmins: []
  };

  try {
    // Extract basic system information
    result.hostname = extractHostname(content);
    result.model = extractModel(content);
    result.fortiosVersion = extractVersion(content);
    result.build = extractBuild(content);
    result.vdomEnabled = extractVdomEnabled(content);
    result.primaryVdom = extractPrimaryVdom(content);

    // Parse configuration sections
    result.firewallPolicies = parseFirewallPolicies(content);
    result.systemInterfaces = parseSystemInterfaces(content);
    result.systemAdmins = parseSystemAdmins(content);

  } catch (error) {
    console.warn('Parser warning:', error.message);
    // Continue with partial parsing
  }

  return result;
}

function extractHostname(content: string): string | undefined {
  const match = content.match(/set hostname\s+"?([^"\s\n]+)"?/);
  return match ? match[1] : undefined;
}

function extractModel(content: string): string | undefined {
  // Try to extract from version info or comments
  const versionMatch = content.match(/FortiGate-(\w+)/);
  if (versionMatch) return `FortiGate-${versionMatch[1]}`;

  const modelMatch = content.match(/model:\s*(\w+)/i);
  return modelMatch ? modelMatch[1] : undefined;
}

function extractVersion(content: string): string | undefined {
  const match = content.match(/FortiOS\s+v(\d+\.\d+\.\d+)/);
  return match ? match[1] : undefined;
}

function extractBuild(content: string): string | undefined {
  const match = content.match(/build(\d+)/);
  return match ? match[1] : undefined;
}

function extractVdomEnabled(content: string): boolean {
  return content.includes('config vdom') || content.includes('set vdom-mode');
}

function extractPrimaryVdom(content: string): string | undefined {
  const match = content.match(/set vdom\s+"?([^"\s\n]+)"?/);
  return match ? match[1] : 'root';
}

function parseFirewallPolicies(content: string): any[] {
  const policies: any[] = [];
  
  // Find firewall policy configuration blocks
  const policyBlocks = content.match(/config firewall policy([\s\S]*?)(?=config\s+\w+|$)/g);
  
  if (!policyBlocks) return policies;

  for (const block of policyBlocks) {
    const policyMatches = block.match(/edit\s+(\d+)([\s\S]*?)(?=edit|\s*end)/g);
    
    if (policyMatches) {
      for (const policyMatch of policyMatches) {
        try {
          const policy = parseSingleFirewallPolicy(policyMatch);
          if (policy) policies.push(policy);
        } catch (error) {
          console.warn('Error parsing firewall policy:', error.message);
        }
      }
    }
  }

  return policies;
}

function parseSingleFirewallPolicy(policyText: string): any | null {
  const seqMatch = policyText.match(/edit\s+(\d+)/);
  if (!seqMatch) return null;

  const policy = {
    seq: parseInt(seqMatch[1]),
    uuid: extractConfigValue(policyText, 'uuid'),
    srcAddr: extractConfigArray(policyText, 'srcaddr'),
    dstAddr: extractConfigArray(policyText, 'dstaddr'),
    srcIntf: extractConfigArray(policyText, 'srcintf'),
    dstIntf: extractConfigArray(policyText, 'dstintf'),
    service: extractConfigArray(policyText, 'service'),
    action: extractConfigValue(policyText, 'action'),
    schedule: extractConfigValue(policyText, 'schedule'),
    nat: extractConfigValue(policyText, 'nat') === 'enable',
    log: extractConfigValue(policyText, 'logtraffic') !== 'disable',
    profiles: extractConfigArray(policyText, 'utm-status') || [],
    geoipRestrict: extractConfigArray(policyText, 'geoip-anycast') || [],
    inspectionMode: extractConfigValue(policyText, 'inspection-mode'),
    vdom: extractConfigValue(policyText, 'vdom') || 'root'
  };

  return policy;
}

function parseSystemInterfaces(content: string): any[] {
  const interfaces: any[] = [];
  
  // Find system interface configuration blocks
  const interfaceBlocks = content.match(/config system interface([\s\S]*?)(?=config\s+\w+|$)/g);
  
  if (!interfaceBlocks) return interfaces;

  for (const block of interfaceBlocks) {
    const interfaceMatches = block.match(/edit\s+"([^"]+)"([\s\S]*?)(?=edit|\s*end)/g);
    
    if (interfaceMatches) {
      for (const interfaceMatch of interfaceMatches) {
        try {
          const iface = parseSingleInterface(interfaceMatch);
          if (iface) interfaces.push(iface);
        } catch (error) {
          console.warn('Error parsing system interface:', error.message);
        }
      }
    }
  }

  return interfaces;
}

function parseSingleInterface(interfaceText: string): any | null {
  const nameMatch = interfaceText.match(/edit\s+"([^"]+)"/);
  if (!nameMatch) return null;

  const iface = {
    name: nameMatch[1],
    ipCidr: extractConfigValue(interfaceText, 'ip'),
    mode: extractConfigValue(interfaceText, 'mode'),
    vlan: extractConfigNumber(interfaceText, 'vlanid'),
    zone: extractConfigValue(interfaceText, 'zone'),
    status: extractConfigValue(interfaceText, 'status'),
    allowAccess: extractConfigArray(interfaceText, 'allowaccess'),
    vdom: extractConfigValue(interfaceText, 'vdom') || 'root'
  };

  return iface;
}

function parseSystemAdmins(content: string): any[] {
  const admins: any[] = [];
  
  // Find system admin configuration blocks
  const adminBlocks = content.match(/config system admin([\s\S]*?)(?=config\s+\w+|$)/g);
  
  if (!adminBlocks) return admins;

  for (const block of adminBlocks) {
    const adminMatches = block.match(/edit\s+"([^"]+)"([\s\S]*?)(?=edit|\s*end)/g);
    
    if (adminMatches) {
      for (const adminMatch of adminMatches) {
        try {
          const admin = parseSingleAdmin(adminMatch);
          if (admin) admins.push(admin);
        } catch (error) {
          console.warn('Error parsing system admin:', error.message);
        }
      }
    }
  }

  return admins;
}

function parseSingleAdmin(adminText: string): any | null {
  const nameMatch = adminText.match(/edit\s+"([^"]+)"/);
  if (!nameMatch) return null;

  const admin = {
    username: nameMatch[1],
    profile: extractConfigValue(adminText, 'accprofile'),
    trustedHosts: extractConfigArray(adminText, 'trusthost') || [],
    twoFactor: extractConfigValue(adminText, 'two-factor') === 'enable',
    publicKeySet: adminText.includes('ssh-public-key'),
    vdomScope: extractConfigValue(adminText, 'vdom') || 'root'
  };

  return admin;
}

function extractConfigValue(text: string, key: string): string | undefined {
  const regex = new RegExp(`set\\s+${key}\\s+"?([^"\\s\\n]+)"?`, 'i');
  const match = text.match(regex);
  return match ? match[1] : undefined;
}

function extractConfigNumber(text: string, key: string): number | undefined {
  const value = extractConfigValue(text, key);
  return value ? parseInt(value) : undefined;
}

function extractConfigArray(text: string, key: string): string[] | undefined {
  const regex = new RegExp(`set\\s+${key}\\s+"([^"]+)"`, 'i');
  const match = text.match(regex);
  if (!match) return undefined;
  
  // Split by space and filter empty strings
  return match[1].split(/\s+/).filter(item => item.length > 0);
}
