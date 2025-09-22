import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { complianceService } from "./services/compliance";
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
    await storage.testConnection();
    log("✅ Conectividade com banco de dados OK");
    
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
  }, () => {
    log(`🎆 ConfigHarbor FUNCIONANDO! Servidor rodando na porta ${port}`);
    log(`🔗 Acesse: http://localhost:${port}`);
    console.log(`
🎉🎉🎉 ConfigHarbor INICIALIZADO COM SUCESSO! 🎉🎉🎉`);
    console.log(`🌍 Servidor funcionando na porta ${port}`);
    console.log(`🔗 URL: http://localhost:${port}\n`);
  });
})();
