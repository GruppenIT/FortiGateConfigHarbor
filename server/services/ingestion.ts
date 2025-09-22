import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { storage } from '../storage';
import { parseFortiOSConfig } from './parser';

// Use diretório correto baseado no ambiente
const DATA_DIR = process.env.DATA_DIR || (process.env.NODE_ENV === 'development' ? './data' : '/data');
const ARCHIVE_DIR = process.env.ARCHIVE_DIR || (process.env.NODE_ENV === 'development' ? './archive' : '/archive');
const QUARANTINE_DIR = process.env.QUARANTINE_DIR || (process.env.NODE_ENV === 'development' ? './archive/_quarantine' : '/archive/_quarantine');

export class IngestionService {
  private processing = false;

  async triggerManualIngestion(): Promise<{ processed: number; quarantined: number; duplicates: number }> {
    console.log('🔄 [INGESTÃO MANUAL] Iniciando processamento manual...');
    console.log(`📁 [INGESTÃO MANUAL] Diretório de dados: ${DATA_DIR}`);
    console.log(`📦 [INGESTÃO MANUAL] Diretório de arquivo: ${ARCHIVE_DIR}`);
    console.log(`⚠️ [INGESTÃO MANUAL] Diretório de quarentena: ${QUARANTINE_DIR}`);
    
    if (this.processing) {
      console.log('⚠️ [INGESTÃO MANUAL] Ingestão já em andamento');
      throw new Error('Ingestion already in progress');
    }

    this.processing = true;
    try {
      const result = await this.processFiles();
      console.log(`✅ [INGESTÃO MANUAL] Processamento concluído:`, result);
      return result;
    } catch (error) {
      console.error('❌ [INGESTÃO MANUAL] Erro no processamento:', error);
      throw error;
    } finally {
      this.processing = false;
    }
  }

  async processFiles(): Promise<{ processed: number; quarantined: number; duplicates: number }> {
    let processed = 0;
    let quarantined = 0;
    let duplicates = 0;

    try {
      console.log('📂 [PROCESSAMENTO] Garantindo que diretórios existam...');
      // Ensure directories exist
      await this.ensureDirectories();

      console.log(`📂 [PROCESSAMENTO] Lendo arquivos do diretório: ${DATA_DIR}`);
      // Read files from data directory
      const files = await fs.readdir(DATA_DIR);
      console.log(`📂 [PROCESSAMENTO] Encontrados ${files.length} itens no diretório:`, files);
      
      for (const filename of files) {
        // Skip incomplete files
        if (filename.endsWith('.part') || filename.startsWith('.')) {
          console.log(`⏭️ [PROCESSAMENTO] Pulando arquivo: ${filename} (arquivo temporário ou oculto)`);
          continue;
        }

        const filePath = path.join(DATA_DIR, filename);
        console.log(`🔍 [PROCESSAMENTO] Processando: ${filename} (${filePath})`);
        
        try {
          const stat = await fs.stat(filePath);
          if (!stat.isFile()) {
            console.log(`⏭️ [PROCESSAMENTO] Pulando: ${filename} (não é arquivo)`);
            continue;
          }

          console.log(`📄 [PROCESSAMENTO] Processando arquivo: ${filename} (${stat.size} bytes)`);
          const result = await this.processFile(filePath, filename);
          
          switch (result.status) {
            case 'processed':
              processed++;
              break;
            case 'quarantined':
              quarantined++;
              break;
            case 'duplicate':
              duplicates++;
              break;
          }
        } catch (error) {
          console.error(`Error processing file ${filename}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.quarantineFile(filePath, filename, `Processing error: ${errorMessage}`);
          quarantined++;
        }
      }
    } catch (error) {
      console.error('Error in file processing:', error);
      throw error;
    }

    return { processed, quarantined, duplicates };
  }

  private async processFile(filePath: string, filename: string): Promise<{ status: 'processed' | 'quarantined' | 'duplicate' }> {
    console.log(`📄 [INGESTÃO] Processando arquivo: ${filename} (${filePath})`);
    
    // Read and hash file
    const content = await fs.readFile(filePath, 'utf-8');
    const fileHash = createHash('sha256').update(content).digest('hex');
    
    console.log(`🔍 [INGESTÃO] Arquivo lido: ${content.length} caracteres, hash: ${fileHash.substring(0, 8)}...`);

    // Check for duplicates
    const existingVersion = await storage.getDeviceVersionByHash(fileHash);
    if (existingVersion) {
      console.log(`⚠️ [INGESTÃO] Arquivo duplicado detectado, removendo: ${filename}`);
      await fs.unlink(filePath); // Remove duplicate
      return { status: 'duplicate' };
    }

    // Extract serial number
    const serial = this.extractSerial(content);
    console.log(`🏷️ [INGESTÃO] Serial extraído: ${serial || 'NÃO ENCONTRADO'}`);
    if (!serial) {
      console.log(`❌ [INGESTÃO] Serial não encontrado, movendo para quarentena: ${filename}`);
      await this.quarantineFile(filePath, filename, 'Serial number not found');
      return { status: 'quarantined' };
    }

    // Parse configuration
    try {
      console.log(`🔧 [INGESTÃO] Iniciando parsing da configuração...`);
      const parsed = parseFortiOSConfig(content);
      console.log(`✅ [INGESTÃO] Parsing concluído: ${parsed.firewallPolicies.length} políticas, ${parsed.systemInterfaces.length} interfaces, ${parsed.systemAdmins.length} admins`);
      
      // Create or update device
      console.log(`💾 [INGESTÃO] Criando/atualizando dispositivo: ${serial}`);
      const device = await storage.createOrUpdateDevice({
        serial,
        hostname: parsed.hostname,
        model: parsed.model,
        tags: [],
        vdomEnabled: parsed.vdomEnabled || false,
        primaryVdom: parsed.primaryVdom
      });
      console.log(`✅ [INGESTÃO] Dispositivo criado/atualizado: ${device.serial}`);

      // Create device version
      console.log(`📦 [INGESTÃO] Criando versão do dispositivo...`);
      const deviceVersion = await storage.createDeviceVersion({
        deviceSerial: serial,
        fortiosVersion: parsed.fortiosVersion,
        build: parsed.build,
        fileHash,
        archivePath: await this.archiveFile(filePath, filename, serial, parsed.tenant)
      });
      console.log(`✅ [INGESTÃO] Versão criada: ID ${deviceVersion.id}`);

      // Store parsed configuration objects
      if (parsed.firewallPolicies.length > 0) {
        console.log(`🛡️ [INGESTÃO] Salvando ${parsed.firewallPolicies.length} políticas de firewall...`);
        const policies = parsed.firewallPolicies.map(p => ({
          ...p,
          deviceVersionId: deviceVersion.id
        }));
        await storage.insertFirewallPolicies(policies);
        console.log(`✅ [INGESTÃO] Políticas salvas com sucesso`);
      } else {
        console.log(`ℹ️ [INGESTÃO] Nenhuma política de firewall para salvar`);
      }

      if (parsed.systemInterfaces.length > 0) {
        console.log(`🌐 [INGESTÃO] Salvando ${parsed.systemInterfaces.length} interfaces do sistema...`);
        const interfaces = parsed.systemInterfaces.map(i => ({
          ...i,
          deviceVersionId: deviceVersion.id
        }));
        await storage.insertSystemInterfaces(interfaces);
        console.log(`✅ [INGESTÃO] Interfaces salvas com sucesso`);
      } else {
        console.log(`ℹ️ [INGESTÃO] Nenhuma interface do sistema para salvar`);
      }

      if (parsed.systemAdmins.length > 0) {
        console.log(`👤 [INGESTÃO] Salvando ${parsed.systemAdmins.length} administradores do sistema...`);
        const admins = parsed.systemAdmins.map(a => ({
          ...a,
          deviceVersionId: deviceVersion.id
        }));
        await storage.insertSystemAdmins(admins);
        console.log(`✅ [INGESTÃO] Administradores salvos com sucesso`);
      } else {
        console.log(`ℹ️ [INGESTÃO] Nenhum administrador do sistema para salvar`);
      }

      // Remove original file
      console.log(`🗑️ [INGESTÃO] Removendo arquivo original: ${filename}`);
      await fs.unlink(filePath);

      console.log(`🎉 [INGESTÃO] Processamento concluído com sucesso para: ${filename}`);
      return { status: 'processed' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
      console.error(`❌ [INGESTÃO] Erro durante parsing de ${filename}:`, error);
      await this.quarantineFile(filePath, filename, `Parse error: ${errorMessage}`);
      return { status: 'quarantined' };
    }
  }

  private extractSerial(content: string): string | null {
    return this.deriveCanonicalSerial(content);
  }

  /**
   * Derive canonical device serial using multi-layer strategy with strict validation.
   * Prioritizes FortiGate-only sources and rejects FortiManager/FortiAnalyzer IDs.
   */
  private deriveCanonicalSerial(content: string): string | null {
    console.log('🔍 [SERIAL] Iniciando extração de serial canônico...');
    
    // Strategy 1: csf-device (FortiGate central management device ID)
    const csfDeviceMatches = content.match(/set\s+csf-device\s+"?(FGT[0-9A-Z]{8,})"?/gi);
    if (csfDeviceMatches && csfDeviceMatches.length > 0) {
      // Extract just the serial part, not the full match
      const serialMatch = csfDeviceMatches[0].match(/"?(FGT[0-9A-Z]{8,})"?/i);
      if (serialMatch) {
        const serial = this.validateFortiGateSerial(serialMatch[1]);
        if (serial) {
          console.log(`✅ [SERIAL] Serial encontrado via csf-device: ${serial}`);
          return serial;
        }
      }
    }
    
    // Strategy 2: Other FortiGate-only keys
    const fortiGateKeys = ['fabric-device', 'device-serial', 'csf-fabric-device'];
    for (const key of fortiGateKeys) {
      const regex = new RegExp(`set\\s+${key}\\s+"?(FGT[0-9A-Z]{8,})"?`, 'gi');
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        const serialMatch = matches[0].match(/"?(FGT[0-9A-Z]{8,})"?/i);
        if (serialMatch) {
          const serial = this.validateFortiGateSerial(serialMatch[1]);
          if (serial) {
            console.log(`✅ [SERIAL] Serial encontrado via ${key}: ${serial}`);
            return serial;
          }
        }
      }
    }
    
    // Strategy 3: Comment/header serial hints
    const headerMatches = content.match(/#\s*serial(?:-number)?\s*=\s*(FGT[0-9A-Z]{8,})/i);
    if (headerMatches) {
      const serial = this.validateFortiGateSerial(headerMatches[1]);
      if (serial) {
        console.log(`✅ [SERIAL] Serial encontrado via header: ${serial}`);
        return serial;
      }
    }
    
    // Strategy 4: Fallback composite key
    console.log('⚠️ [SERIAL] Nenhum serial FGT encontrado, gerando ID composto...');
    const fallbackSerial = this.generateFallbackSerial(content);
    if (fallbackSerial) {
      console.log(`🔄 [SERIAL] Serial fallback gerado: ${fallbackSerial}`);
      return fallbackSerial;
    }
    
    console.log('❌ [SERIAL] Falha em extrair serial por qualquer método');
    return null;
  }

  /**
   * Strict validation for FortiGate serial numbers.
   * Accepts only uppercase alphanumeric starting with FGT, length 12-20.
   * Explicitly rejects FortiManager (FMG*) and FortiAnalyzer (FAZ*) serials.
   */
  private validateFortiGateSerial(serial: string): string | null {
    if (!serial) return null;
    
    // Normalize to uppercase
    const normalizedSerial = serial.toUpperCase().trim();
    
    // Explicit rejection of non-FortiGate prefixes
    if (normalizedSerial.startsWith('FMG') || 
        normalizedSerial.startsWith('FAZ') || 
        normalizedSerial.startsWith('FMGV') ||
        normalizedSerial.startsWith('FAZV')) {
      console.log(`❌ [SERIAL] Rejeitando serial não-FortiGate: ${normalizedSerial}`);
      return null;
    }
    
    // Validate FortiGate serial: FGT followed by 8-17 alphanumeric chars
    if (/^FGT[0-9A-Z]{8,17}$/.test(normalizedSerial)) {
      return normalizedSerial;
    }
    
    console.log(`❌ [SERIAL] Serial não atende formato FGT: ${normalizedSerial}`);
    return null;
  }

  /**
   * Generate a stable fallback pseudo-ID when no FortiGate serial is found.
   * Uses hash of [model, hostname, first 2 IPv4s from interfaces].
   */
  private generateFallbackSerial(content: string): string | null {
    try {
      // Extract model from system global
      const modelMatch = content.match(/set\s+alias\s+"([^"]+)"/i);
      const model = modelMatch ? modelMatch[1] : 'UNKNOWN';
      
      // Extract hostname
      const hostnameMatch = content.match(/set\s+hostname\s+"([^"]+)"/i);
      const hostname = hostnameMatch ? hostnameMatch[1] : 'UNKNOWN';
      
      // Extract first 2 IPv4 addresses from interfaces
      const ipMatches = content.match(/set\s+ip\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g);
      const ips = ipMatches ? ipMatches.slice(0, 2).map(match => match.split(' ')[2]).join('-') : 'NO-IP';
      
      // Create composite key
      const compositeKey = `${model}-${hostname}-${ips}`;
      const hash = createHash('sha256').update(compositeKey).digest('hex').substring(0, 12).toUpperCase();
      
      const fallbackSerial = `FGT-UNKNOWN-${hash}`;
      console.log(`🔄 [SERIAL] Composite key: ${compositeKey} -> ${fallbackSerial}`);
      
      return fallbackSerial;
    } catch (error) {
      console.error('❌ [SERIAL] Erro gerando serial fallback:', error);
      return null;
    }
  }

  private async archiveFile(filePath: string, filename: string, serial: string, tenant?: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const archivePath = path.join(
      ARCHIVE_DIR,
      tenant || 'unknown',
      serial,
      String(year),
      month,
      day,
      filename
    );

    await fs.mkdir(path.dirname(archivePath), { recursive: true });
    await fs.copyFile(filePath, archivePath);

    return archivePath;
  }

  private async quarantineFile(filePath: string, filename: string, reason: string): Promise<void> {
    const quarantinePath = path.join(QUARANTINE_DIR, filename);
    
    await fs.mkdir(QUARANTINE_DIR, { recursive: true });
    await fs.copyFile(filePath, quarantinePath);
    await fs.unlink(filePath);

    // Calculate file hash for quarantined file
    const content = await fs.readFile(quarantinePath, 'utf-8');
    const fileHash = createHash('sha256').update(content).digest('hex');

    await storage.logIngestError({
      path: filePath,
      fileHash,
      reason,
      quarantinedPath: quarantinePath
    });
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    await fs.mkdir(QUARANTINE_DIR, { recursive: true });
  }
}

export const ingestionService = new IngestionService();
