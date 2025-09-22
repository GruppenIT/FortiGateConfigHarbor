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

/**
 * Extrai blocos de configuração balanceados (config...end) do conteúdo.
 * Funciona com configurações aninhadas como config gui-dashboard...end.
 */
function extractBalancedConfigBlocks(content: string, configName: string): string[] {
  const blocks: string[] = [];
  const startPattern = new RegExp(configName, 'gi');
  let match;
  
  while ((match = startPattern.exec(content)) !== null) {
    const startIndex = match.index;
    let depth = 0;
    let endIndex = startIndex;
    
    // Procurar pelo 'end' correspondente contando os blocos config/end
    for (let i = startIndex; i < content.length; i++) {
      const remaining = content.substring(i);
      
      // Verificar se encontramos um novo 'config'
      if (remaining.match(/^config\s+/)) {
        depth++;
        i += remaining.match(/^config\s+/)![0].length - 1; // Ajustar índice
        continue;
      }
      
      // Verificar se encontramos um 'end'
      if (remaining.match(/^end(\s|$)/)) {
        depth--;
        if (depth === 0) {
          endIndex = i + 3; // +3 para incluir 'end'
          break;
        }
        i += 2; // +2 para pular 'end'
        continue;
      }
    }
    
    if (depth === 0 && endIndex > startIndex) {
      const block = content.substring(startIndex, endIndex + 1);
      blocks.push(block);
      console.log(`🔍 [PARSER] Bloco balanceado extraído (${block.length} chars)`);
    } else {
      console.log(`⚠️ [PARSER] Bloco não balanceado encontrado para '${configName}'`);
    }
  }
  
  return blocks;
}

/**
 * Extrai blocos edit...next balanceados de um bloco de configuração.
 * Lida com configurações aninhadas dentro dos blocos edit.
 */
function extractBalancedEditBlocks(configBlock: string): string[] {
  const editBlocks: string[] = [];
  const editPattern = /edit\s+"([^"]+)"/gi;
  let match;
  
  while ((match = editPattern.exec(configBlock)) !== null) {
    const startIndex = match.index;
    let depth = 0;
    let endIndex = startIndex;
    let inConfig = false;
    
    // Procurar pelo 'next' correspondente contando os blocos config/end aninhados
    for (let i = startIndex; i < configBlock.length; i++) {
      const remaining = configBlock.substring(i);
      
      // Verificar se encontramos um novo 'config' aninhado
      if (remaining.match(/^config\s+/)) {
        inConfig = true;
        depth++;
        i += remaining.match(/^config\s+/)![0].length - 1;
        continue;
      }
      
      // Verificar se encontramos um 'end' que fecha um config aninhado
      if (inConfig && remaining.match(/^end(\s|$)/)) {
        depth--;
        if (depth === 0) {
          inConfig = false;
        }
        i += 2;
        continue;
      }
      
      // Verificar se encontramos um 'next' e não estamos dentro de um config aninhado
      if (!inConfig && remaining.match(/^next(\s|$)/)) {
        endIndex = i + 4; // +4 para incluir 'next'
        break;
      }
    }
    
    if (endIndex > startIndex) {
      const editBlock = configBlock.substring(startIndex, endIndex);
      editBlocks.push(editBlock);
      console.log(`🔍 [PARSER] Edit balanceado extraído: '${match[1]}' (${editBlock.length} chars)`);
    } else {
      console.log(`⚠️ [PARSER] Edit não balanceado encontrado para '${match[1]}'`);
    }
  }
  
  return editBlocks;
}

function parseSystemAdmins(content: string): any[] {
  console.log(`👤 [PARSER] Buscando blocos de system admin...`);
  const admins: any[] = [];
  
  // Encontrar blocos de config system admin com parsing balanceado de config/end
  const adminBlocks = extractBalancedConfigBlocks(content, 'config system admin');
  
  if (!adminBlocks || adminBlocks.length === 0) {
    console.log(`⚠️ [PARSER] Nenhum bloco 'config system admin' encontrado`);
    return admins;
  }

  console.log(`👤 [PARSER] Encontrados ${adminBlocks.length} blocos de system admin`);

  for (const block of adminBlocks) {
    // Extrair admins individuais com edit "nome" ... next usando parsing balanceado
    const adminMatches = extractBalancedEditBlocks(block);
    
    if (adminMatches && adminMatches.length > 0) {
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
    trustedHosts: extractTrustedHosts(adminText),
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

/**
 * Extrai trusted hosts numerados (trusthost1, trusthost2, etc.) de um bloco de admin FortiOS.
 * Cada trusthost contém IP e máscara de subrede.
 */
function extractTrustedHosts(adminText: string): string[] {
  const trustedHosts: string[] = [];
  
  // Procura por trusthost1, trusthost2, trusthost3, etc.
  const trusthostRegex = /set\s+trusthost(\d+)\s+([^\n\r]+)/gi;
  let match;
  
  console.log(`🔍 [PARSER] Procurando trusted hosts no admin...`);
  
  while ((match = trusthostRegex.exec(adminText)) !== null) {
    const trusthostNumber = match[1];
    const trusthostValue = match[2].trim();
    
    // Trusted host geralmente é "IP MASK" (ex: "192.168.1.0 255.255.255.0")
    const parts = trusthostValue.split(/\s+/);
    if (parts.length >= 2) {
      const ip = parts[0];
      const mask = parts[1];
      const cidr = convertMaskToCIDR(ip, mask);
      trustedHosts.push(cidr);
      console.log(`✅ [PARSER] Trusted host ${trusthostNumber}: ${ip}/${mask} -> ${cidr}`);
    } else if (parts.length === 1) {
      // Caso seja só o IP sem máscara
      trustedHosts.push(parts[0]);
      console.log(`✅ [PARSER] Trusted host ${trusthostNumber}: ${parts[0]}`);
    }
  }
  
  if (trustedHosts.length === 0) {
    console.log(`⚠️ [PARSER] Nenhum trusted host encontrado no admin`);
    return [];
  }
  
  console.log(`✅ [PARSER] Total de ${trustedHosts.length} trusted hosts encontrados`);
  return trustedHosts;
}

/**
 * Converte IP + máscara de subrede para notação CIDR.
 */
function convertMaskToCIDR(ip: string, mask: string): string {
  try {
    // Converte máscara para CIDR
    const maskParts = mask.split('.').map(Number);
    let cidrBits = 0;
    
    for (const part of maskParts) {
      cidrBits += (part.toString(2).match(/1/g) || []).length;
    }
    
    return `${ip}/${cidrBits}`;
  } catch (error) {
    // Fallback para formato original se conversão falhar
    return `${ip}/${mask}`;
  }
}
