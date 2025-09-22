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
        password: await hashPassword(adminPassword),
        role: "admin",
      });
      log("Default admin user created successfully with username: admin@local");
    } else {
      log("Default admin user already exists");
    }
  } catch (error) {
    log("Error initializing default admin user:", String(error));
  }

  // Initialize default compliance rules
  try {
    log("Initializing default compliance rules...");
    await complianceService.initializeDefaultRules();
    log("Compliance rules initialized successfully");
  } catch (error) {
    log("Error initializing compliance rules:", String(error));
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
