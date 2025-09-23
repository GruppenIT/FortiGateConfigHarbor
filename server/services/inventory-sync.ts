import sql from 'mssql';
import { db } from '../db.js';
import { devices } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { storage } from '../storage.js';

// Interface para configuração do SQL Server
interface SqlConfig {
  server: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

// Função para criar configuração do SQL Server a partir dos parâmetros
const createSqlServerConfig = (config: SqlConfig): sql.config => ({
  server: config.server,
  port: parseInt(config.port),
  database: config.database,
  user: config.username,
  password: config.password,
  options: {
    encrypt: false, // Para redes internas
    trustServerCertificate: true,
    connectTimeout: 10000,
    requestTimeout: 10000,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
});

// Interface para os dados retornados pela consulta SQL Server
interface InventoryDevice {
  numserie: string;
  modelodesc: string;
  LocalizacaoDesc: string;
  statusid: number;
  StatusDesc: string;
}

export class InventorySyncService {
  private pool: sql.ConnectionPool | null = null;

  /**
   * Conecta ao SQL Server externo usando configurações do banco
   */
  private async connect(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    // Buscar configuração salva no banco
    const config = await storage.getEllevoConfig();
    if (!config) {
      throw new Error('Configuração do Sistema Ellevo não encontrada. Configure em Configurações > Sistema Ellevo');
    }

    const sqlConfig = createSqlServerConfig(config);
    console.log('[INVENTÁRIO] 🔌 Conectando ao SQL Server externo...');
    this.pool = new sql.ConnectionPool(sqlConfig);
    await this.pool.connect();
    console.log('[INVENTÁRIO] ✅ Conectado ao SQL Server externo');
    return this.pool;
  }

  /**
   * Desconecta do SQL Server externo
   */
  private async disconnect(): Promise<void> {
    if (this.pool && this.pool.connected) {
      await this.pool.close();
      console.log('[INVENTÁRIO] 🔌 Desconectado do SQL Server externo');
    }
  }

  /**
   * Busca equipamentos FortiGate do sistema de inventário externo
   */
  private async fetchInventoryDevices(): Promise<InventoryDevice[]> {
    const pool = await this.connect();
    
    const query = `
      SELECT 
        equip.numserie, 
        model.modelodesc, 
        loc.LocalizacaoDesc, 
        equip.statusid, 
        invstatus.StatusDesc 
      FROM InvEquipamentos equip
      INNER JOIN InvModelo model ON model.ModeloID = equip.ModeloID
      INNER JOIN InvLocalizacao loc ON loc.LocalizacaoID = equip.LocalizacaoID
      INNER JOIN InvStatus invstatus ON invstatus.StatusID = equip.StatusID
      WHERE equip.FabricanteID = 1 AND equip.CategoriaID = 7
    `;

    console.log('[INVENTÁRIO] 📋 Executando consulta no sistema externo...');
    const result = await pool.request().query<InventoryDevice>(query);
    console.log(`[INVENTÁRIO] 📦 Encontrados ${result.recordset.length} equipamentos no inventário`);
    
    return result.recordset;
  }

  /**
   * Sincroniza um equipamento do inventário com nossa base local
   */
  private async syncDevice(inventoryDevice: InventoryDevice): Promise<void> {
    const { numserie, modelodesc, LocalizacaoDesc, statusid, StatusDesc } = inventoryDevice;

    try {
      // Verificar se o dispositivo já existe
      const existingDevice = await db
        .select()
        .from(devices)
        .where(eq(devices.serial, numserie))
        .limit(1);

      const deviceData = {
        serial: numserie,
        modelDesc: modelodesc,
        localizacaoDesc: LocalizacaoDesc,
        statusId: statusid,
        statusDesc: StatusDesc,
        inventoryLastSync: new Date(),
      };

      if (existingDevice.length > 0) {
        // Atualizar dispositivo existente
        await db
          .update(devices)
          .set({
            modelDesc: modelodesc,
            localizacaoDesc: LocalizacaoDesc,
            statusId: statusid,
            statusDesc: StatusDesc,
            inventoryLastSync: new Date(),
          })
          .where(eq(devices.serial, numserie));
        
        console.log(`[INVENTÁRIO] 🔄 Atualizado: ${numserie} - ${modelodesc}`);
      } else {
        // Criar novo dispositivo
        await db.insert(devices).values(deviceData);
        console.log(`[INVENTÁRIO] ➕ Criado: ${numserie} - ${modelodesc}`);
      }
    } catch (error) {
      console.error(`[INVENTÁRIO] ❌ Erro ao sincronizar ${numserie}:`, error);
      throw error;
    }
  }

  /**
   * Executa a sincronização completa
   */
  async syncInventory(): Promise<{ synced: number; errors: number }> {
    const startTime = Date.now();
    console.log('[INVENTÁRIO] 🔄 Iniciando sincronização com sistema externo...');

    let synced = 0;
    let errors = 0;

    try {
      // Buscar equipamentos do inventário externo
      const inventoryDevices = await this.fetchInventoryDevices();

      // Sincronizar cada equipamento
      for (const device of inventoryDevices) {
        try {
          await this.syncDevice(device);
          synced++;
        } catch (error) {
          console.error(`[INVENTÁRIO] ❌ Erro ao sincronizar ${device.numserie}:`, error);
          errors++;
        }
      }

      // Marcar equipamentos que não estão mais no inventário como inativos
      // (opcional - manter por agora para não perder histórico)

      const duration = Date.now() - startTime;
      console.log(`[INVENTÁRIO] ✅ Sincronização concluída em ${duration}ms`);
      console.log(`[INVENTÁRIO] 📊 Sincronizados: ${synced}, Erros: ${errors}`);

      return { synced, errors };
    } catch (error) {
      console.error('[INVENTÁRIO] ❌ Erro na sincronização:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Testa a conectividade com o SQL Server externo
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[INVENTÁRIO] 🔍 Testando conectividade com SQL Server externo...');
      const pool = await this.connect();
      
      // Teste simples de conectividade
      await pool.request().query('SELECT 1 as test');
      
      console.log('[INVENTÁRIO] ✅ Conectividade com SQL Server externo OK');
      return true;
    } catch (error) {
      console.error('[INVENTÁRIO] ❌ Erro de conectividade com SQL Server externo:', error);
      return false;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Testa a conectividade com configuração específica (para testes via interface)
   */
  async testConnectionWithConfig(config: SqlConfig): Promise<{success: boolean, message?: string}> {
    let pool: sql.ConnectionPool | null = null;
    try {
      console.log('[INVENTÁRIO] 🔍 Testando conectividade com configuração fornecida...');
      const sqlConfig = createSqlServerConfig(config);
      pool = new sql.ConnectionPool(sqlConfig);
      await pool.connect();
      await pool.request().query('SELECT 1 as test');
      return { success: true, message: 'Conexão estabelecida com sucesso!' };
    } catch (error) {
      console.error('[INVENTÁRIO] ❌ Erro na conexão de teste:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      return { success: false, message: `Falha na conexão: ${errorMsg}` };
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error('[INVENTÁRIO] ⚠️ Erro ao fechar conexão de teste:', closeError);
        }
      }
    }
  }
}

// Instância singleton do serviço
export const inventorySyncService = new InventorySyncService();