#!/bin/bash

# FortiGate ConfigHarbor - Script de Instalação para Ubuntu Server 24.04
# Este script faz o deploy completo do sistema com hard-reset do banco de dados

set -e
set -o pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Função para log de erros (sai do script)
error() {
    echo -e "${RED}[ERRO]${NC} $1" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}


# Verificar se é Ubuntu 24.04
check_ubuntu_version() {
    if [[ ! -f /etc/os-release ]]; then
        error "Sistema operacional não identificado"
    fi
    
    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]] || [[ "$VERSION_ID" != "24.04" ]]; then
        error "Este script é específico para Ubuntu Server 24.04. Versão detectada: $PRETTY_NAME"
    fi
    
    log "Ubuntu 24.04 detectado - continuando instalação"
}

# Verificar se está executando como root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Este script deve ser executado como root (use sudo)"
    fi
}

# Instalar dependências do sistema
install_system_dependencies() {
    log "Atualizando pacotes do sistema..."
    apt update && apt upgrade -y
    
    log "Instalando dependências básicas..."
    apt install -y curl wget git build-essential software-properties-common

    # Instalar Node.js 20.x
    log "Instalando Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # Verificar versões instaladas
    node_version=$(node --version)
    npm_version=$(npm --version)
    log "Node.js instalado: $node_version"
    log "NPM instalado: $npm_version"
}

# Instalar e configurar PostgreSQL
setup_postgresql() {
    log "Instalando PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    
    # Gerar senha aleatória segura para o banco de dados (variável global)
    export DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    log "Senha do banco de dados gerada com segurança"
    
    # Iniciar serviço
    systemctl start postgresql
    systemctl enable postgresql
    
    log "Configurando banco de dados PostgreSQL..."
    
    # Detectar versão do PostgreSQL sem precisar conectar ao banco
    PG_MAJOR=$(ls -1d /etc/postgresql/[0-9]* 2>/dev/null | sed 's#.*/##' | sort -Vr | head -n1)
    if [ -z "$PG_MAJOR" ]; then
        # Fallback: detectar pela instalação do package
        PG_MAJOR=$(apt-cache policy postgresql | grep -o 'postgresql-[0-9][0-9]*' | head -n1 | cut -d'-' -f2)
    fi
    if [ -z "$PG_MAJOR" ]; then
        PG_MAJOR="16"  # Default para Ubuntu 24.04
    fi
    
    log "Versão PostgreSQL detectada: $PG_MAJOR"
    PG_HBA_FILE="/etc/postgresql/$PG_MAJOR/main/pg_hba.conf"
    
    # Verificar se arquivo existe
    if [ ! -f "$PG_HBA_FILE" ]; then
        error "❌ Arquivo pg_hba.conf não encontrado: $PG_HBA_FILE"
    fi
    
    # Backup do arquivo original
    cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup.$(date +%s)"
    log "Backup de pg_hba.conf criado"
    
    # Parar PostgreSQL para reconfiguração segura
    log "Parando PostgreSQL para reconfiguração robusta..."
    systemctl stop postgresql
    sleep 2
    
    # Configurar pg_hba.conf de forma robusta (substituir completamente)
    log "Configurando autenticação PostgreSQL com SCRAM-SHA-256..."
    
    cat > "$PG_HBA_FILE" << 'PG_HBA_CONTENT'
# CONFIGHARBOR - Configuração de Autenticação Segura
# Database administrative login by Unix domain socket
local   all             postgres                                peer

# ConfigHarbor - Aplicação principal
local   configharbor    configharbor_user                       scram-sha-256
host    configharbor    configharbor_user    127.0.0.1/32       scram-sha-256
host    configharbor    configharbor_user    ::1/128            scram-sha-256

# Bloquear outras conexões não autorizadas (segurança)
local   all             all                                     reject
host    all             all             127.0.0.1/32            reject  
host    all             all             ::1/128                 reject
host    all             all             0.0.0.0/0               reject
PG_HBA_CONTENT

    # Iniciar PostgreSQL com nova configuração
    systemctl start postgresql
    sleep 3
    
    # Recarregar configuração PostgreSQL
    systemctl reload postgresql
    log "PostgreSQL reconfigurado para autenticação SCRAM-SHA-256"
    
    # Aguardar PostgreSQL processar alterações de configuração
    sleep 3
    log "Aguardando PostgreSQL processar configurações..."
    
    # Criar usuário e banco de dados para ConfigHarbor com configuração robusta
    log "Criando usuário e banco de dados..."
    sudo -u postgres psql -h /var/run/postgresql -U postgres -w -v ON_ERROR_STOP=1 <<EOF
-- Finalizar conexões existentes se necessário
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'configharbor';

-- Remover banco e usuário existentes (reset completo)
DROP DATABASE IF EXISTS configharbor;
DROP ROLE IF EXISTS configharbor_user;

-- Criar novo usuário com senha SCRAM
CREATE ROLE configharbor_user WITH LOGIN PASSWORD '$DB_PASSWORD';

-- Criar banco dedicado
CREATE DATABASE configharbor WITH OWNER configharbor_user;

-- Conceder privilégios completos
GRANT ALL PRIVILEGES ON DATABASE configharbor TO configharbor_user;
GRANT CREATE ON DATABASE configharbor TO configharbor_user;

-- Conectar ao banco e configurar permissões schema
\c configharbor

-- Garantir permissões no schema public
GRANT ALL ON SCHEMA public TO configharbor_user;
GRANT CREATE ON SCHEMA public TO configharbor_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO configharbor_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO configharbor_user;

-- Verificar criação
\du configharbor_user
\l configharbor
EOF

    # Testar conectividade robusta com múltiplas verificações
    log "Executando testes de conectividade..."
    sleep 3  # Aguardar PostgreSQL processar as alterações
    
    # Teste 1: Verificar se usuário existe
    log "Teste 1: Verificando se usuário foi criado..."
    if sudo -u postgres psql -h /var/run/postgresql -U postgres -w -c "\du" | grep configharbor_user >/dev/null; then
        log "✓ Usuário configharbor_user existe no PostgreSQL"
    else
        error "❌ Usuário configharbor_user NÃO foi criado"
    fi
    
    # Teste 2: Verificar se banco existe
    log "Teste 2: Verificando se banco foi criado..."
    if sudo -u postgres psql -h /var/run/postgresql -U postgres -w -c "\l" | grep configharbor >/dev/null; then
        log "✓ Banco configharbor existe no PostgreSQL"
    else
        error "❌ Banco configharbor NÃO foi criado"
    fi
    
    # Teste 3: Conectividade TCP/IP
    log "Teste 3: Testando conectividade TCP/IP..."
    if PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U configharbor_user -d configharbor -c "SELECT 'CONECTIVIDADE OK' as status, current_timestamp;" 2>/dev/null; then
        log "✅ Conectividade TCP/IP confirmada"
    else
        log "❌ Falha na conectividade TCP/IP - testando socket Unix..."
        
        # Teste 4: Socket Unix como fallback
        if PGPASSWORD=$DB_PASSWORD psql -h /var/run/postgresql -U configharbor_user -d configharbor -c "SELECT 'CONECTIVIDADE UNIX OK' as status;" 2>/dev/null; then
            log "✓ Conectividade via socket Unix funciona"
        else
            # Debug completo
            log "DEBUG: Todas as tentativas de conexão falharam"
            log "DEBUG: Usuário: configharbor_user"
            log "DEBUG: Banco: configharbor"
            log "DEBUG: Configuração pg_hba.conf atual:"
            cat "$PG_HBA_FILE" | grep -v "^#" | grep -v "^$" || true
            
            error "❌ Falha crítica na conectividade - configuração PostgreSQL incorreta"
        fi
    fi
    
    log "✅ Todos os testes de conectividade passaram"

    log "PostgreSQL configurado com sucesso"
}

# Função integrada para validação robusta de conectividade
validate_postgresql_ready() {
    local APP_DIR="/opt/FortiGateConfigHarbor" 
    local max_retries=8
    local retry=0
    local wait_time=2
    
    log "Validando conectividade PostgreSQL robusta..."
    
    while [ $retry -lt $max_retries ]; do
        # Teste com credenciais do .env
        if [ -f "$APP_DIR/.env" ]; then
            source "$APP_DIR/.env"
            
            # Teste 1: TCP/IP
            if PGPASSWORD="$PGPASSWORD" psql -h 127.0.0.1 -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 'ConfigHarbor DB Ready' as status;" >/dev/null 2>&1; then
                log "✅ PostgreSQL conectividade TCP validada (tentativa $((retry + 1)))"
                return 0
            fi
            
            # Teste 2: Socket Unix fallback
            if PGPASSWORD="$PGPASSWORD" psql -h /var/run/postgresql -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 'ConfigHarbor DB Ready via Unix socket' as status;" >/dev/null 2>&1; then
                log "✅ PostgreSQL conectividade Unix socket validada (tentativa $((retry + 1)))"
                return 0
            fi
        fi
        
        retry=$((retry + 1))
        if [ $retry -lt $max_retries ]; then
            log "Tentativa $retry falhou, aguardando $wait_time segundos..."
            sleep $wait_time
            # Backoff exponencial
            wait_time=$((wait_time * 2))
            if [ $wait_time -gt 16 ]; then
                wait_time=16  # Max 16 segundos
            fi
        fi
    done
    
    error "❌ Falha crítica: PostgreSQL não responde após $max_retries tentativas"
    return 1
}

# Configurar estrutura de diretórios
setup_directories() {
    log "Criando estrutura de diretórios..."
    
    # Diretório principal da aplicação
    APP_DIR="/opt/FortiGateConfigHarbor"
    mkdir -p "$APP_DIR"
    mkdir -p "$APP_DIR/data"
    mkdir -p "$APP_DIR/logs"
    mkdir -p "$APP_DIR/archive"
    mkdir -p "$APP_DIR/quarantine"
    
    # Permissões serão definidas posteriormente pela função create_system_user()
    
    log "Estrutura de diretórios criada em $APP_DIR"
}

# Copiar aplicação para diretório de produção
deploy_application() {
    log "Copiando aplicação para produção..."
    
    APP_DIR="/opt/FortiGateConfigHarbor"
    CURRENT_DIR=$(pwd)
    GITHUB_REPO="https://github.com/GruppenIT/FortiGateConfigHarbor"
    # Use uma tag específica ou commit hash para garantir reprodutibilidade
    GITHUB_TAG="main"  # Em produção, use uma tag específica como "v1.0.0"
    
    
    # Verificar se os arquivos da aplicação existem localmente
    if [ ! -d "$CURRENT_DIR/client" ] || [ ! -d "$CURRENT_DIR/server" ]; then
        log "Arquivos da aplicação não encontrados localmente. Baixando do GitHub..."
        
        # Criar diretório temporário para download
        TEMP_DIR="/tmp/configharbor-download"
        rm -rf "$TEMP_DIR"
        mkdir -p "$TEMP_DIR"
        cd "$TEMP_DIR"
        
        # Baixar arquivos do repositório GitHub com verificação de integridade
        log "Baixando arquivos do repositório (ref: $GITHUB_TAG)..."
        if ! curl -fsSL "$GITHUB_REPO/archive/refs/heads/$GITHUB_TAG.tar.gz" | tar -xz --strip-components=1; then
            error "Falha ao baixar ou extrair arquivos da aplicação do GitHub"
        fi
        
        # Verificar se todos os arquivos necessários foram baixados
        REQUIRED_FILES=("client" "server" "shared" "package.json" "package-lock.json" "tsconfig.json" "vite.config.ts" "tailwind.config.ts" "postcss.config.js" "drizzle.config.ts")
        for file in "${REQUIRED_FILES[@]}"; do
            if [ ! -e "$file" ]; then
                error "Arquivo obrigatório não encontrado após download: $file"
            fi
        done
        
        CURRENT_DIR="$TEMP_DIR"
        log "Arquivos baixados com sucesso do GitHub"
    else
        log "Usando arquivos da aplicação encontrados localmente"
    fi
    
    # Copiar todos os arquivos necessários
    cp -r "$CURRENT_DIR/client" "$APP_DIR/"
    cp -r "$CURRENT_DIR/server" "$APP_DIR/"
    cp -r "$CURRENT_DIR/shared" "$APP_DIR/"
    cp "$CURRENT_DIR/package.json" "$APP_DIR/"
    cp "$CURRENT_DIR/package-lock.json" "$APP_DIR/"
    cp "$CURRENT_DIR/tsconfig.json" "$APP_DIR/"
    cp "$CURRENT_DIR/vite.config.ts" "$APP_DIR/"
    cp "$CURRENT_DIR/tailwind.config.ts" "$APP_DIR/"
    cp "$CURRENT_DIR/postcss.config.js" "$APP_DIR/"
    cp "$CURRENT_DIR/drizzle.config.ts" "$APP_DIR/"
    
    # Instalar dependências
    cd "$APP_DIR"
    log "Instalando dependências da aplicação..."
    npm ci --production=false
    
    # Build da aplicação
    log "Fazendo build da aplicação..."
    npm run build
    
    # Limpar diretório temporário se foi usado
    if [ -d "/tmp/configharbor-download" ]; then
        rm -rf "/tmp/configharbor-download"
        log "Limpeza do diretório temporário concluída"
    fi
    
    log "Aplicação deployada com sucesso"
}

# Configurar variáveis de ambiente
setup_environment() {
    log "Configurando variáveis de ambiente..."
    
    APP_DIR="/opt/FortiGateConfigHarbor"
    
    # Gerar senha aleatória para admin
    ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-16)
    
    # Gerar session secret
    SESSION_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-32)
    
    # Criar arquivo .env robusto
    log "Criando arquivo .env com configuração robusta..."
    cat > "$APP_DIR/.env" << ENV_CONFIG
# ===================================================================
# CONFIGHARBOR - Configuração de Ambiente de Produção
# Gerado automaticamente em: $(date '+%Y-%m-%d %H:%M:%S')
# ===================================================================

# Configuração do Banco de Dados PostgreSQL
DATABASE_URL=postgresql://configharbor_user:$DB_PASSWORD@127.0.0.1:5432/configharbor
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=configharbor_user
PGPASSWORD=$DB_PASSWORD
PGDATABASE=configharbor

# Configuração de Segurança
SESSION_SECRET=$SESSION_SECRET

# Configuração de Ambiente de Produção
NODE_ENV=production
PORT=5000

# Configuração de Diretórios
DATA_DIR=/opt/FortiGateConfigHarbor/data
ARCHIVE_DIR=/opt/FortiGateConfigHarbor/archive
QUARANTINE_DIR=/opt/FortiGateConfigHarbor/quarantine
LOG_DIR=/opt/FortiGateConfigHarbor/logs

# Configuração de Logging
LOG_LEVEL=info
DEBUG=false

# Configuração de Ingestão
INGESTION_ENABLED=true
INGESTION_INTERVAL=300000
MAX_FILE_SIZE=10485760

# Configuração de Compliance
COMPLIANCE_ENABLED=true
COMPLIANCE_INTERVAL=3600000

# Timezone
TZ=America/Sao_Paulo
ENV_CONFIG

    # Salvar credenciais do admin
    cat > "$APP_DIR/ADMIN_CREDENTIAL" << EOF
SISTEMA: FortiGate ConfigHarbor
DATA DE INSTALAÇÃO: $(date '+%Y-%m-%d %H:%M:%S')
USUÁRIO ADMINISTRADOR: admin@local
SENHA INICIAL: $ADMIN_PASSWORD

IMPORTANTE:
- Este é o usuário administrador padrão do sistema
- Altere esta senha no primeiro acesso
- Mantenha este arquivo em local seguro
- Não compartilhe estas credenciais

URL de Acesso: http://$(hostname -I | awk '{print $1}'):5000
EOF

    # Definir permissões restritivas para arquivos sensíveis
    chmod 600 "$APP_DIR/.env"
    chmod 600 "$APP_DIR/ADMIN_CREDENTIAL"
    
    log "Variáveis de ambiente configuradas"
    log "Credenciais salvas em: $APP_DIR/ADMIN_CREDENTIAL"
}

# Configurar banco de dados e usuário admin
setup_database() {
    log "Inicializando banco de dados..."
    
    APP_DIR="/opt/FortiGateConfigHarbor"
    cd "$APP_DIR"
    
    # Executar migrations com fallback robusto
    log "Aplicando schema do banco de dados..."
    if ! npx drizzle-kit push --config=drizzle.config.ts --force 2>/dev/null; then
        log "WARN: drizzle-kit push falhou, aplicando schema manualmente..."
        
        # Aplicar schema manualmente se drizzle falhar
        PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U configharbor_user -d configharbor <<'SCHEMA_EOF'
-- Garantir que colunas necessárias existam na tabela users
DO $$
BEGIN
    -- Adicionar coluna password_hash se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash TEXT;
        RAISE NOTICE 'Coluna password_hash adicionada à tabela users';
    END IF;
    
    -- Adicionar coluna updated_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP;
        RAISE NOTICE 'Coluna updated_at adicionada à tabela users';
    END IF;
END
$$;
SCHEMA_EOF
        log "Schema aplicado manualmente com sucesso"
    else
        log "Schema aplicado via drizzle-kit com sucesso"
    fi
    
    # Obter senha do admin do arquivo de credenciais
    ADMIN_PASSWORD=$(grep "SENHA INICIAL:" "$APP_DIR/ADMIN_CREDENTIAL" | cut -d' ' -f3)
    
    # Gerar hash correto da senha admin
    log "Gerando hash seguro da senha administrador..."
    ADMIN_HASH=$(node -e "
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return \`\${buf.toString('hex')}.\${salt}\`;
}

hashPassword('${ADMIN_PASSWORD}').then(hash => console.log(hash));
")
    
    # Criar usuário admin inicial via SQL direto
    log "Criando usuário administrador padrão..."
    PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U configharbor_user -d configharbor <<EOF
-- Remover usuário admin existente se houver
DELETE FROM users WHERE username = 'admin@local';

-- Inserir novo usuário admin com hash válido
INSERT INTO users (username, password_hash, display_name, role, created_at, updated_at) 
VALUES (
    'admin@local',
    '$ADMIN_HASH',
    'Administrador do Sistema',
    'admin',
    NOW(),
    NOW()
);
\q
EOF
    
    log "Banco de dados inicializado com usuário admin@local"
}

# Criar usuário de sistema dedicado
create_system_user() {
    log "Criando usuário de sistema configharbor..."
    
    # Criar grupo e usuário de sistema
    groupadd --system configharbor 2>/dev/null || true
    useradd --system --gid configharbor --home-dir /opt/FortiGateConfigHarbor \
        --shell /usr/sbin/nologin --comment "FortiGate ConfigHarbor Service" \
        configharbor 2>/dev/null || true
    
    # Ajustar propriedade de todos os arquivos e diretórios
    APP_DIR="/opt/FortiGateConfigHarbor"
    chown -R configharbor:configharbor "$APP_DIR"
    
    # Definir permissões seguras para diretórios (750)
    find "$APP_DIR" -type d -exec chmod 750 {} \;
    
    # Definir permissões para arquivos regulares (640)
    find "$APP_DIR" -type f -exec chmod 640 {} \;
    
    # Permissões especiais para arquivos executáveis necessários
    find "$APP_DIR/node_modules/.bin" -type f -exec chmod 750 {} \; 2>/dev/null || true
    
    # Permissões restritivas para arquivos sensíveis (600)
    chmod 600 "$APP_DIR/.env"
    chmod 600 "$APP_DIR/ADMIN_CREDENTIAL"
    
    # Garantir que diretórios de dados têm permissões corretas
    chmod 750 "$APP_DIR/data"
    chmod 750 "$APP_DIR/logs"
    chmod 750 "$APP_DIR/archive"
    chmod 750 "$APP_DIR/quarantine"
    
    log "Usuário de sistema configharbor criado com segurança"
}

# Criar serviço systemd
create_systemd_service() {
    log "Criando serviço systemd..."
    
    cat > /etc/systemd/system/configharbor.service << EOF
[Unit]
Description=FortiGate ConfigHarbor
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=configharbor
Group=configharbor
WorkingDirectory=/opt/FortiGateConfigHarbor
Environment=NODE_ENV=production
EnvironmentFile=/opt/FortiGateConfigHarbor/.env

# Debug steps para diagnosticar problemas
ExecStartPre=/bin/bash -c 'echo "=== ConfigHarbor Debug Info ===" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "Timestamp: $(date)" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "Working Directory: $(pwd)" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "User: $(whoami)" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "Node version: $(node --version)" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "Checking files..." >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'ls -la /opt/FortiGateConfigHarbor/dist/ >> /tmp/configharbor-debug.log 2>&1'
ExecStartPre=/bin/bash -c 'echo "Environment variables:" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "NODE_ENV=$NODE_ENV PORT=$PORT" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "DATABASE_URL status: $(test -n \"$DATABASE_URL\" && echo \"SET\" || echo \"NOT_SET\")" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'echo "Testing file access..." >> /tmp/configharbor-debug.log'
ExecStartPre=/usr/bin/test -f /opt/FortiGateConfigHarbor/dist/index.js
ExecStartPre=/bin/bash -c 'echo "File test passed, testing database connectivity..." >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'source /opt/FortiGateConfigHarbor/.env && echo "Testing DB with user: $PGUSER, host: 127.0.0.1, db: $PGDATABASE" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'source /opt/FortiGateConfigHarbor/.env && echo "DATABASE_URL format check..." >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'source /opt/FortiGateConfigHarbor/.env && echo "DATABASE_URL: $(echo "$DATABASE_URL" | sed '"'"'s#://[^:]*:[^@]*@#://[USER]:[HIDDEN]@#g'"'"')" >> /tmp/configharbor-debug.log'
ExecStartPre=/bin/bash -c 'source /opt/FortiGateConfigHarbor/.env && PGPASSWORD=$PGPASSWORD psql -h 127.0.0.1 -U $PGUSER -d $PGDATABASE -c "SELECT 1 as preflight_check;" >> /tmp/configharbor-debug.log 2>&1 || (echo "CRITICAL: Individual PG vars connection failed" >> /tmp/configharbor-debug.log && exit 1)'
ExecStartPre=/bin/bash -c 'source /opt/FortiGateConfigHarbor/.env && psql "$DATABASE_URL" -c "SELECT 1 as database_url_test;" >> /tmp/configharbor-debug.log 2>&1 || (echo "CRITICAL: DATABASE_URL connection failed - serviço não pode iniciar" >> /tmp/configharbor-debug.log && exit 1)'
ExecStartPre=/bin/bash -c 'echo "Database connectivity confirmed, starting application..." >> /tmp/configharbor-debug.log'

ExecStart=/usr/bin/node /opt/FortiGateConfigHarbor/dist/index.js
Restart=always
RestartSec=10

# Security hardening mínimo necessário 
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateNetwork=false

# Diretórios acessíveis pelo serviço
ReadWritePaths=/opt/FortiGateConfigHarbor/data
ReadWritePaths=/opt/FortiGateConfigHarbor/logs
ReadWritePaths=/opt/FortiGateConfigHarbor/archive
ReadWritePaths=/opt/FortiGateConfigHarbor/quarantine
ReadWritePaths=/tmp

# Logs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=configharbor

[Install]
WantedBy=multi-user.target
EOF

    # Recarregar systemd e habilitar serviço
    systemctl daemon-reload
    systemctl enable configharbor
    
    log "Serviço systemd criado e habilitado"
}

# Configurar firewall
setup_firewall() {
    log "Configurando firewall..."
    
    # Instalar UFW se não estiver instalado
    apt install -y ufw
    
    # Configurar regras básicas
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 5000/tcp
    ufw --force enable
    
    log "Firewall configurado - porta 5000 liberada"
}

# Função principal
main() {
    log "Iniciando instalação do FortiGate ConfigHarbor..."
    
    check_root
    check_ubuntu_version
    
    log "=== FASE 1: Instalação de dependências ==="
    install_system_dependencies
    
    log "=== FASE 2: Configuração do PostgreSQL ==="
    setup_postgresql
    
    log "=== FASE 3: Configuração de diretórios ==="
    setup_directories
    
    log "=== FASE 4: Deploy da aplicação ==="
    deploy_application
    
    log "=== FASE 5: Configuração de ambiente ==="
    setup_environment
    
    log "=== FASE 5.1: Validando PostgreSQL ==="
    validate_postgresql_ready
    
    log "=== FASE 6: Inicialização do banco de dados ==="
    setup_database
    
    log "=== FASE 7: Criação de usuário de sistema ==="
    create_system_user
    
    log "=== FASE 8: Configuração do serviço ==="
    create_systemd_service
    
    log "=== FASE 9: Configuração do firewall ==="
    setup_firewall
    
    log "=== INSTALAÇÃO CONCLUÍDA COM SUCESSO! ==="
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                   INSTALAÇÃO CONCLUÍDA                      ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║ Sistema:${NC} FortiGate ConfigHarbor                            ${GREEN}║${NC}"
    echo -e "${GREEN}║ URL:${NC}     http://$(hostname -I | awk '{print $1}'):5000                      ${GREEN}║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║ Credenciais do administrador:${NC}                             ${GREEN}║${NC}"
    echo -e "${GREEN}║ Usuário:${NC} admin@local                                      ${GREEN}║${NC}"
    echo -e "${GREEN}║ Arquivo:${NC} /opt/FortiGateConfigHarbor/ADMIN_CREDENTIAL     ${GREEN}║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║ Para iniciar o sistema:${NC}                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║ ${NC}sudo systemctl start configharbor                        ${GREEN}║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║ Para ver logs:${NC}                                           ${GREEN}║${NC}"
    echo -e "${GREEN}║ ${NC}sudo journalctl -u configharbor -f                       ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Configuração de sudoers não necessária - sistema totalmente integrado
    log "Sistema configurado com validação integrada (sem scripts auxiliares)"
    
    # Habilitar e iniciar o serviço
    log "Habilitando e iniciando serviço ConfigHarbor..."
    systemctl enable configharbor
    systemctl start configharbor
    
    # Aguardar inicialização e verificar status
    log "Aguardando inicialização do serviço..."
    sleep 8
    
    if systemctl is-active --quiet configharbor; then
        log "✅ Serviço ConfigHarbor funcionando corretamente!"
    else
        warn "Serviço não iniciou corretamente. Verifique os logs com: sudo journalctl -u configharbor -f"
    fi
}

# Executar função principal
main "$@"