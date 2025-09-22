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
  console.log(`🔍 [PARSER] Iniciando parsing de configuração (${content.length} chars)`);
  
  const result: ParsedConfig = {
    firewallPolicies: [],
    systemInterfaces: [],
    systemAdmins: []
  };

  try {
    // Extract basic system information
    console.log(`📝 [PARSER] Extraindo informações básicas do sistema...`);
    result.hostname = extractHostname(content);
    result.model = extractModel(content);
    result.fortiosVersion = extractVersion(content);
    result.build = extractBuild(content);
    result.vdomEnabled = extractVdomEnabled(content);
    result.primaryVdom = extractPrimaryVdom(content);
    
    console.log(`📝 [PARSER] Sistema identificado: hostname=${result.hostname}, model=${result.model}, version=${result.fortiosVersion}`);

    // Parse configuration sections
    console.log(`🔧 [PARSER] Parseando seções de configuração...`);
    result.firewallPolicies = parseFirewallPolicies(content);
    console.log(`🛡️ [PARSER] Firewall policies encontradas: ${result.firewallPolicies.length}`);
    
    result.systemInterfaces = parseSystemInterfaces(content);
    console.log(`🌐 [PARSER] System interfaces encontradas: ${result.systemInterfaces.length}`);
    
    result.systemAdmins = parseSystemAdmins(content);
    console.log(`👤 [PARSER] System admins encontrados: ${result.systemAdmins.length}`);

  } catch (error) {
    console.error(`❌ [PARSER] Erro durante parsing:`, error.message);
    console.error(`❌ [PARSER] Stack trace:`, error.stack);
    // Continue with partial parsing
  }

  console.log(`✅ [PARSER] Parsing concluído: ${result.firewallPolicies.length} políticas, ${result.systemInterfaces.length} interfaces, ${result.systemAdmins.length} admins`);
  return result;
}

function extractHostname(content: string): string | undefined {
  const match = content.match(/set hostname\s+"([^"]+)"/);
  return match ? match[1] : undefined;
}

function extractModel(content: string): string | undefined {
  // Try to extract from config version header
  const headerMatch = content.match(/#config-version=FGT(\w+)-/);
  if (headerMatch) return `FortiGate-${headerMatch[1]}`;
  
  // Try to extract from alias
  const aliasMatch = content.match(/set alias\s+"([^"]+)"/);
  if (aliasMatch) return aliasMatch[1];
  
  return undefined;
}

function extractVersion(content: string): string | undefined {
  // Try to extract from config version header
  const match = content.match(/#config-version=FGT\w+-(\d+\.\d+\.\d+)-FW-build/);
  return match ? match[1] : undefined;
}

function extractBuild(content: string): string | undefined {
  // Try to extract from config version header
  const match = content.match(/#config-version=.*-build(\d+)-/);
  if (match) return match[1];
  
  // Try to extract from buildno comment
  const buildnoMatch = content.match(/#buildno=(\d+)/);
  return buildnoMatch ? buildnoMatch[1] : undefined;
}

function extractVdomEnabled(content: string): boolean {
  return content.includes('config vdom') || content.includes('set vdom-mode');
}

function extractPrimaryVdom(content: string): string | undefined {
  const match = content.match(/set vdom\s+"?([^"\s\n]+)"?/);
  return match ? match[1] : 'root';
}

function parseFirewallPolicies(content: string): any[] {
  console.log(`🛡️ [PARSER] Buscando blocos de firewall policy...`);
  const policies: any[] = [];
  
  // Find firewall policy configuration blocks - corrigido para formato .conf
  const policyBlockRegex = /config firewall policy([\s\S]*?)end/g;
  const policyBlocks = content.match(policyBlockRegex);
  
  if (!policyBlocks) {
    console.log(`⚠️ [PARSER] Nenhum bloco 'config firewall policy' encontrado`);
    return policies;
  }

  console.log(`🛡️ [PARSER] Encontrados ${policyBlocks.length} blocos de firewall policy`);

  for (const block of policyBlocks) {
    // Extrair políticas individuais com edit X ... next
    const policyMatches = block.match(/edit\s+(\d+)[\s\S]*?next/g);
    
    if (policyMatches) {
      console.log(`🛡️ [PARSER] Encontradas ${policyMatches.length} políticas individuais no bloco`);
      for (const policyMatch of policyMatches) {
        try {
          const policy = parseSingleFirewallPolicy(policyMatch);
          if (policy) {
            policies.push(policy);
            console.log(`✅ [PARSER] Política ${policy.seq} parseada com sucesso`);
          }
        } catch (error) {
          console.error(`❌ [PARSER] Erro parsing firewall policy:`, error.message);
        }
      }
    } else {
      console.log(`⚠️ [PARSER] Nenhuma política 'edit' encontrada no bloco`);
      console.log(`🔍 [PARSER] Amostra do bloco (${block.length} chars):`);
      console.log(block.substring(0, 800));
      console.log(`🔍 [PARSER] Regex usada: /edit\\s+(\\d+)([\\s\\S]*?)(?=\\s*next|\\s*end)/g`);
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
  console.log(`🌐 [PARSER] Buscando blocos de system interface...`);
  const interfaces: any[] = [];
  
  // Find system interface configuration blocks - corrigido para formato .conf
  const interfaceBlockRegex = /config system interface([\s\S]*?)end/g;
  const interfaceBlocks = content.match(interfaceBlockRegex);
  
  if (!interfaceBlocks) {
    console.log(`⚠️ [PARSER] Nenhum bloco 'config system interface' encontrado`);
    return interfaces;
  }

  console.log(`🌐 [PARSER] Encontrados ${interfaceBlocks.length} blocos de system interface`);

  for (const block of interfaceBlocks) {
    // Extrair interfaces individuais com edit "nome" ... next
    const interfaceMatches = block.match(/edit\s+"([^"]+)"[\s\S]*?next/g);
    
    if (interfaceMatches) {
      console.log(`🌐 [PARSER] Encontradas ${interfaceMatches.length} interfaces individuais no bloco`);
      for (const interfaceMatch of interfaceMatches) {
        try {
          const iface = parseSingleInterface(interfaceMatch);
          if (iface) {
            interfaces.push(iface);
            console.log(`✅ [PARSER] Interface '${iface.name}' parseada com sucesso`);
          }
        } catch (error) {
          console.error(`❌ [PARSER] Erro parsing system interface:`, error.message);
        }
      }
    } else {
      console.log(`⚠️ [PARSER] Nenhuma interface 'edit' encontrada no bloco`);
      console.log(`🔍 [PARSER] Amostra do bloco (${block.length} chars):`);
      console.log(block.substring(0, 800));
      console.log(`🔍 [PARSER] Regex usada: /edit\\s+\"([^\"]+)\"[\\s\\S]*?next/g`);
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
  console.log(`👤 [PARSER] Buscando blocos de system admin...`);
  const admins: any[] = [];
  
  // Find system admin configuration blocks - corrigido para formato .conf
  const adminBlockRegex = /config system admin([\s\S]*?)end/g;
  const adminBlocks = content.match(adminBlockRegex);
  
  if (!adminBlocks) {
    console.log(`⚠️ [PARSER] Nenhum bloco 'config system admin' encontrado`);
    return admins;
  }

  console.log(`👤 [PARSER] Encontrados ${adminBlocks.length} blocos de system admin`);

  for (const block of adminBlocks) {
    // Extrair admins individuais com edit "nome" ... next
    const adminMatches = block.match(/edit\s+"([^"]+)"[\s\S]*?next/g);
    
    if (adminMatches) {
      console.log(`👤 [PARSER] Encontrados ${adminMatches.length} admins individuais no bloco`);
      for (const adminMatch of adminMatches) {
        try {
          const admin = parseSingleAdmin(adminMatch);
          if (admin) {
            admins.push(admin);
            console.log(`✅ [PARSER] Admin '${admin.username}' parseado com sucesso`);
          }
        } catch (error) {
          console.error(`❌ [PARSER] Erro parsing system admin:`, error.message);
        }
      }
    } else {
      console.log(`⚠️ [PARSER] Nenhum admin 'edit' encontrado no bloco`);
      console.log(`🔍 [PARSER] Amostra do bloco (${block.length} chars):`);
      console.log(block.substring(0, 800));
      console.log(`🔍 [PARSER] Regex usada: /edit\\s+\"([^\"]+)\"[\\s\\S]*?next/g`);
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
  // Tenta primeiro com aspas
  const quotedRegex = new RegExp(`set\\s+${key}\\s+"([^"]+)"`, 'i');
  const quotedMatch = text.match(quotedRegex);
  if (quotedMatch) return quotedMatch[1];
  
  // Tenta sem aspas para valores simples
  const unquotedRegex = new RegExp(`set\\s+${key}\\s+([^\\s\\n]+)`, 'i');
  const unquotedMatch = text.match(unquotedRegex);
  return unquotedMatch ? unquotedMatch[1] : undefined;
}

function extractConfigNumber(text: string, key: string): number | undefined {
  const value = extractConfigValue(text, key);
  return value ? parseInt(value) : undefined;
}

function extractConfigArray(text: string, key: string): string[] | undefined {
  const value = extractConfigValue(text, key);
  if (!value) return undefined;
  
  // Se o valor contém espaços, provavelmente é uma lista
  if (value.includes(' ')) {
    return value.split(/\s+/).filter(v => v.length > 0);
  }
  
  // Senão, é um valor único
  return [value];
}
