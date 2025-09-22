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
    // Read and hash file
    const content = await fs.readFile(filePath, 'utf-8');
    const fileHash = createHash('sha256').update(content).digest('hex');

    // Check for duplicates
    const existingVersion = await storage.getDeviceVersionByHash(fileHash);
    if (existingVersion) {
      await fs.unlink(filePath); // Remove duplicate
      return { status: 'duplicate' };
    }

    // Extract serial number
    const serial = this.extractSerial(content);
    if (!serial) {
      await this.quarantineFile(filePath, filename, 'Serial number not found');
      return { status: 'quarantined' };
    }

    // Parse configuration
    try {
      const parsed = parseFortiOSConfig(content);
      
      // Create or update device
      const device = await storage.createOrUpdateDevice({
        serial,
        hostname: parsed.hostname,
        model: parsed.model,
        tags: [],
        vdomEnabled: parsed.vdomEnabled || false,
        primaryVdom: parsed.primaryVdom
      });

      // Create device version
      const deviceVersion = await storage.createDeviceVersion({
        deviceSerial: serial,
        fortiosVersion: parsed.fortiosVersion,
        build: parsed.build,
        fileHash,
        archivePath: await this.archiveFile(filePath, filename, serial, parsed.tenant)
      });

      // Store parsed configuration objects
      if (parsed.firewallPolicies.length > 0) {
        const policies = parsed.firewallPolicies.map(p => ({
          ...p,
          deviceVersionId: deviceVersion.id
        }));
        await storage.insertFirewallPolicies(policies);
      }

      if (parsed.systemInterfaces.length > 0) {
        const interfaces = parsed.systemInterfaces.map(i => ({
          ...i,
          deviceVersionId: deviceVersion.id
        }));
        await storage.insertSystemInterfaces(interfaces);
      }

      if (parsed.systemAdmins.length > 0) {
        const admins = parsed.systemAdmins.map(a => ({
          ...a,
          deviceVersionId: deviceVersion.id
        }));
        await storage.insertSystemAdmins(admins);
      }

      // Remove original file
      await fs.unlink(filePath);

      return { status: 'processed' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
      await this.quarantineFile(filePath, filename, `Parse error: ${errorMessage}`);
      return { status: 'quarantined' };
    }
  }

  private extractSerial(content: string): string | null {
    // Try to extract from headers/comments
    const headerMatches = content.match(/(?:Serial-Number|serial-number):\s*(\w+)/i);
    if (headerMatches) {
      return this.validateSerial(headerMatches[1]);
    }

    // Try to extract from config system global
    const globalMatches = content.match(/config system global[\s\S]*?set hostname\s+"([^"]+)"[\s\S]*?end/);
    if (globalMatches) {
      // Look for serial in the same section
      const serialMatches = content.match(/set serial-number\s+"?([^"\s]+)"?/);
      if (serialMatches) {
        return this.validateSerial(serialMatches[1]);
      }
    }

    // Try generic serial number pattern
    const serialMatches = content.match(/\b(FG\w+|F\w{3,})\b/);
    if (serialMatches) {
      return this.validateSerial(serialMatches[1]);
    }

    return null;
  }

  private validateSerial(serial: string): string | null {
    // Validate FortiGate serial format (usually starts with FG or F)
    if (/^F[GW]?\w{3,}$/.test(serial)) {
      return serial;
    }
    return null;
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
