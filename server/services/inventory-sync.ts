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
  private isSyncing: boolean = false;

  /**
   * Conecta ao SQL Server externo usando configurações do banco
   */
  private async connect(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      console.log('[INVENTÁRIO] 🔄 Reutilizando conexão existente com SQL Server');
      return this.pool;
    }

    console.log('[INVENTÁRIO] 🔍 Buscando configuração do Sistema Ellevo...');
    
    // Buscar configuração salva no banco
    const config = await storage.getEllevoConfig();
    if (!config) {
      console.log('[INVENTÁRIO] ❌ Configuração não encontrada');
      throw new Error('Configuração do Sistema Ellevo não encontrada. Configure em Configurações > Sistema Ellevo');
    }

    // Log details only in development mode for security
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INVENTÁRIO] ✅ Configuração encontrada: ${config.server}:${config.port || 1433}/${config.database}`);
      console.log(`[INVENTÁRIO] 👤 Usuário: ${config.username}`);
      console.log(`[INVENTÁRIO] 🔌 Tentando conectar ao SQL Server: ${config.server}:${config.port || 1433}`);
    } else {
      console.log(`[INVENTÁRIO] ✅ Configuração encontrada`);
      console.log(`[INVENTÁRIO] 🔌 Tentando conectar ao SQL Server externo`);
    }

    const sqlConfig = createSqlServerConfig(config);
    console.log(`[INVENTÁRIO] 📋 Configurações: encrypt=${sqlConfig.options?.encrypt}, trustServerCertificate=${sqlConfig.options?.trustServerCertificate}`);
    
    const connectionStart = Date.now();
    this.pool = new sql.ConnectionPool(sqlConfig);
    await this.pool.connect();
    const connectionTime = Date.now() - connectionStart;
    
    console.log(`[INVENTÁRIO] ✅ Conectado ao SQL Server externo em ${connectionTime}ms`);
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
    console.log('[INVENTÁRIO] 🔍 Filtros: FabricanteID=1 (FortiGate), CategoriaID=7');
    
    // Log SQL query only in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[INVENTÁRIO] 📄 Query SQL:', query.trim().replace(/\s+/g, ' '));
    }
    
    const queryStart = Date.now();
    const result = await pool.request().query<InventoryDevice>(query);
    const queryTime = Date.now() - queryStart;
    
    console.log(`[INVENTÁRIO] 📦 Encontrados ${result.recordset.length} equipamentos no inventário (${queryTime}ms)`);
    
    // Log sample data only in development mode
    if (result.recordset.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('[INVENTÁRIO] 📊 Primeira amostra:');
      const sample = result.recordset[0];
      console.log(`[INVENTÁRIO]   - Serial: ${sample.numserie}`);
      console.log(`[INVENTÁRIO]   - Modelo: ${sample.modelodesc}`);
      console.log(`[INVENTÁRIO]   - Localização: ${sample.LocalizacaoDesc}`);
      console.log(`[INVENTÁRIO]   - Status: ${sample.StatusDesc} (ID: ${sample.statusid})`);
    }
    
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
    // Verificar se já está sincronizando
    if (this.isSyncing) {
      console.log('[INVENTÁRIO] ⚠️ Sincronização já em andamento, ignorando nova solicitação');
      throw new Error('Sincronização já está em andamento');
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    console.log(`[INVENTÁRIO] 🔄 === INICIANDO SINCRONIZAÇÃO ${timestamp} ===`);
    console.log('[INVENTÁRIO] 🎯 Objetivo: Sincronizar equipamentos FortiGate do PlataformaEllevo');

    let synced = 0;
    let errors = 0;

    try {
      // Buscar equipamentos do inventário externo
      console.log('[INVENTÁRIO] 📡 Etapa 1/3: Buscar equipamentos do sistema externo');
      const inventoryDevices = await this.fetchInventoryDevices();

      if (inventoryDevices.length === 0) {
        console.log('[INVENTÁRIO] ⚠️ Nenhum equipamento encontrado no sistema externo');
        console.log('[INVENTÁRIO] 💡 Verifique se os filtros FabricanteID=1 e CategoriaID=7 estão corretos');
        return { synced: 0, errors: 0 };
      }

      // Sincronizar cada equipamento
      console.log(`[INVENTÁRIO] 🔄 Etapa 2/3: Sincronizar ${inventoryDevices.length} equipamentos`);
      let processedCount = 0;
      
      for (const device of inventoryDevices) {
        try {
          processedCount++;
          console.log(`[INVENTÁRIO] [${processedCount}/${inventoryDevices.length}] Processando: ${device.numserie}`);
          await this.syncDevice(device);
          synced++;
        } catch (error) {
          console.error(`[INVENTÁRIO] ❌ [${processedCount}/${inventoryDevices.length}] Erro ao sincronizar ${device.numserie}:`, error);
          errors++;
        }
      }

      // Marcar equipamentos que não estão mais no inventário como inativos
      // (opcional - manter por agora para não perder histórico)
      console.log('[INVENTÁRIO] 📋 Etapa 3/3: Verificação de equipamentos removidos (atualmente desabilitada)');

      const duration = Date.now() - startTime;
      const endTimestamp = new Date().toISOString();
      
      console.log(`[INVENTÁRIO] ✅ === SINCRONIZAÇÃO CONCLUÍDA ${endTimestamp} ===`);
      console.log(`[INVENTÁRIO] ⏱️ Duração total: ${duration}ms`);
      console.log(`[INVENTÁRIO] 📊 Resultado: ${synced} sincronizados, ${errors} erros`);
      console.log(`[INVENTÁRIO] 📈 Taxa de sucesso: ${inventoryDevices.length > 0 ? Math.round((synced / inventoryDevices.length) * 100) : 0}%`);

      return { synced, errors };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[INVENTÁRIO] ❌ === SINCRONIZAÇÃO FALHOU (${duration}ms) ===`);
      console.error('[INVENTÁRIO] 💥 Erro crítico na sincronização:', error);
      throw error;
    } finally {
      this.isSyncing = false;
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