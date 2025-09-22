import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { complianceService } from "./services/compliance";
import { ingestionService } from "./services/ingestion";
import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Em produção, não logar dados sensíveis - apenas informações básicas
      if (process.env.NODE_ENV !== "production" && capturedJsonResponse) {
        // Em desenvolvimento, logar apenas métodos seguros e informações não sensíveis
        if (req.method === "GET" && typeof capturedJsonResponse === "object") {
          // Logar apenas contagem de resultados, não dados completos
          if (Array.isArray(capturedJsonResponse)) {
            logLine += ` :: [${capturedJsonResponse.length} items]`;
          } else if (capturedJsonResponse.message) {
            logLine += ` :: ${capturedJsonResponse.message}`;
          }
        }
      }

      if (logLine.length > 100) {
        logLine = logLine.slice(0, 99) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("🚀 ConfigHarbor iniciando...");
    log(`📍 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    log(`📍 PORT: ${process.env.PORT || 'undefined'}`);
    log(`📍 DATABASE_URL: ${process.env.DATABASE_URL ? 'definido' : 'UNDEFINED'}`);
    
    // Teste de conectividade com banco de dados
    log("🔍 Testando conectividade com banco de dados...");
    // Em produção, logar informações de conectividade sem expor credenciais
    if (process.env.NODE_ENV === 'production') {
      const dbUrl = process.env.DATABASE_URL || '';
      const maskedUrl = dbUrl.replace(/:\/\/[^:]*:[^@]*@/, '://[USER]:[HIDDEN]@');
      log(`📊 CONNECTION: ${maskedUrl}`);
      
      // Mostrar variáveis individuais também
      log(`📊 PGUSER: ${process.env.PGUSER || 'NOT_SET'}`);
      log(`📊 PGHOST: ${process.env.PGHOST || 'NOT_SET'}`);
      log(`📊 PGDATABASE: ${process.env.PGDATABASE || 'NOT_SET'}`);
      log(`📊 PGPASSWORD: ${process.env.PGPASSWORD ? '[SET]' : '[NOT_SET]'}`);
    }
    await storage.testConnection();
    log("✅ Conectividade com banco de dados OK");
    
    // Teste específico do session store em produção
    if (process.env.NODE_ENV === 'production') {
      log("🔍 Testando session store especificamente...");
      try {
        // Teste direto do session store
        await new Promise((resolve, reject) => {
          storage.sessionStore.get('test_key', (err: any, session: any) => {
            if (err && err.message && err.message.includes('password authentication failed')) {
              reject(new Error(`SESSION STORE ERROR: ${err.message}`));
            } else {
              // Sem erro ou erro esperado (chave não existe)
              resolve(session);
            }
          });
        });
        log("✅ Session store funcionando corretamente");
      } catch (sessionError: any) {
        log(`❌ ERRO NO SESSION STORE: ${sessionError.message}`);
        log("🚫 O sistema não pode continuar sem session store funcional");
        process.exit(1);
      }
    }
    
    // Initialize default admin user
    log("👤 Verificando usuário admin padrão...");
    const existingAdmin = await storage.getUserByUsername("admin@local");
    if (existingAdmin) {
      log("✅ Usuário admin@local já existe");
    } else {
      log("⚠️  Usuário admin@local não encontrado - criando...");
    }
  } catch (initialError) {
    const errorMsg = `💥 ERRO CRÍTICO na inicialização: ${String(initialError)}`;
    log(errorMsg);
    console.error(errorMsg);
    console.error('Stack trace:', initialError);
    process.exit(1);
  }

  // Initialize default admin user  
  try {
    log("Checking for default admin user...");
    const existingAdmin = await storage.getUserByUsername("admin@local");
    if (!existingAdmin) {
      log("Creating default admin user...");
      
      // Ler senha do arquivo de credenciais obrigatório (produção)
      const fs = require('fs');
      const credentialPath = "/opt/FortiGateConfigHarbor/ADMIN_CREDENTIAL";
      
      if (!fs.existsSync(credentialPath)) {
        const errorMsg = `ERRO CRÍTICO: Arquivo de credenciais não encontrado em ${credentialPath}. Execute o script install.sh primeiro.`;
        log(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }
      
      let adminPassword;
      try {
        const credentialContent = fs.readFileSync(credentialPath, 'utf8');
        const passwordMatch = credentialContent.match(/SENHA INICIAL: (.+)/);
        if (!passwordMatch) {
          const errorMsg = "ERRO CRÍTICO: Formato inválido no arquivo de credenciais. Senha não encontrada.";
          log(errorMsg);
          console.error(errorMsg);
          process.exit(1);
        }
        adminPassword = passwordMatch[1].trim();
        log("Admin password loaded from credential file");
      } catch (credError) {
        const errorMsg = `ERRO CRÍTICO: Não foi possível ler o arquivo de credenciais: ${credError}`;
        log(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }
      
      await storage.createUser({
        username: "admin@local",
        displayName: "Administrador do Sistema",
        passwordHash: await hashPassword(adminPassword),
        role: "admin",
      });
      log("Default admin user created successfully with username: admin@local");
    } else {
      log("Default admin user already exists");
    }
  } catch (error) {
    const errorMsg = `💥 ERRO ao inicializar usuário admin: ${String(error)}`;
    log(errorMsg);
    console.error(errorMsg);
    console.error('Stack trace completo:', error);
  }

  // Initialize default compliance rules
  try {
    log("Initializing default compliance rules...");
    await complianceService.initializeDefaultRules();
    log("Compliance rules initialized successfully");
  } catch (error) {
    const errorMsg = `💥 ERRO ao inicializar regras de conformidade: ${String(error)}`;
    log(errorMsg);
    console.error(errorMsg);
    console.error('Stack trace completo:', error);
  }

  log("🔌 Registrando rotas da API...");
  const server = await registerRoutes(app);
  log("✅ Rotas da API registradas com sucesso");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  log("📏 Configurando servico de arquivos estaticos...");
  if (app.get("env") === "development") {
    log("👷 Modo desenvolvimento: configurando Vite");
    await setupVite(app, server);
  } else {
    log("📦 Modo produção: servindo arquivos estaticos");
    serveStatic(app);
  }
  log("✅ Servico de arquivos configurado");

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  log(`🌍 Iniciando servidor HTTP na porta ${port}...`);
  log(`🔗 Host: 0.0.0.0 (todas as interfaces)`);
  
  // Handler para erros de servidor (porta ocupada, permissões, etc.)
  server.on('error', (err) => {
    const errorMsg = `💥 ERRO CRÍTICO no servidor HTTP: ${err.message}`;
    log(errorMsg);
    console.error(errorMsg);
    console.error('Detalhes do erro:', err);
    
    if ((err as any).code === 'EADDRINUSE') {
      console.error(`🚫 Porta ${port} já está em uso. Verifique se outro processo está usando a porta.`);
    } else if ((err as any).code === 'EACCES') {
      console.error(`🚫 Sem permissão para usar a porta ${port}. Use sudo ou configure uma porta > 1024.`);
    }
    
    process.exit(1);
  });
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`🎆 ConfigHarbor FUNCIONANDO! Servidor rodando na porta ${port}`);
    log(`🔗 Acesse: http://localhost:${port}`);
    console.log(`
🎉🎉🎉 ConfigHarbor INICIALIZADO COM SUCESSO! 🎉🎉🎉`);
    console.log(`🌍 Servidor funcionando na porta ${port}`);
    console.log(`🔗 URL: http://localhost:${port}\n`);
    
    // Initialize automatic file ingestion service AFTER server is running
    log("🔄 Iniciando serviço de ingestão automática...");
    try {
      // Run initial ingestion check
      log("📂 Executando verificação inicial de arquivos...");
      const initialResult = await ingestionService.triggerManualIngestion();
      if (initialResult.processed > 0 || initialResult.quarantined > 0 || initialResult.duplicates > 0) {
        log(`✅ Ingestão inicial: ${initialResult.processed} processados, ${initialResult.quarantined} em quarentena, ${initialResult.duplicates} duplicados`);
      } else {
        log("📭 Nenhum arquivo novo encontrado na verificação inicial");
      }
      
      // Set up automatic ingestion every 5 minutes
      const INGESTION_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
      setInterval(async () => {
        try {
          log("🔄 Executando ingestão automática...");
          const result = await ingestionService.triggerManualIngestion();
          if (result.processed > 0 || result.quarantined > 0 || result.duplicates > 0) {
            log(`✅ Ingestão automática: ${result.processed} processados, ${result.quarantined} em quarentena, ${result.duplicates} duplicados`);
          } else {
            log("📭 Ingestão automática: nenhum arquivo novo encontrado");
          }
        } catch (error) {
          log(`❌ Erro na ingestão automática: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          console.error("Automatic ingestion error:", error);
        }
      }, INGESTION_INTERVAL);
      
      log(`✅ Serviço de ingestão automática configurado (verificação a cada 5 minutos)`);
    } catch (error) {
      log(`⚠️ Erro ao inicializar ingestão automática: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      console.error("Error initializing automatic ingestion:", error);
    }
  });
})();
