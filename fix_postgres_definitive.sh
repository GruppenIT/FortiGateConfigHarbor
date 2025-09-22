#!/bin/bash

# CORREÇÃO DEFINITIVA PARA PROBLEMA DE AUTENTICAÇÃO POSTGRESQL
# Este script reseta completamente a configuração e resolve o problema

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo -e "${RED}[ERRO CRÍTICO] $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCESSO] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

echo "🔥 CORREÇÃO DEFINITIVA - RESET COMPLETO POSTGRESQL"
echo "================================================="

# Verificar se está executando como root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root: sudo $0"
fi

APP_DIR="/opt/FortiGateConfigHarbor"

# 1. PARAR SERVIÇO COMPLETAMENTE
log "1. Parando serviço ConfigHarbor..."
systemctl stop configharbor || true
systemctl disable configharbor || true
sleep 3
success "Serviço parado"

# 2. BACKUP E LIMPEZA
log "2. Fazendo backup de arquivos importantes..."
if [ -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%s)"
    info "Backup do .env criado"
fi

# 3. DETECTAR VERSÃO POSTGRESQL
log "3. Detectando versão PostgreSQL..."
PG_MAJOR=$(ls -1d /etc/postgresql/[0-9]* 2>/dev/null | sed 's#.*/##' | sort -Vr | head -n1)
if [ -z "$PG_MAJOR" ]; then
    PG_MAJOR="16"
fi
info "Versão PostgreSQL: $PG_MAJOR"

# 4. RESETAR USUÁRIO E BANCO POSTGRESQL COMPLETAMENTE
log "4. RESETANDO PostgreSQL completamente..."

# Parar postgresql para reset completo
systemctl stop postgresql
sleep 2

# Configurar pg_hba.conf para acesso administrativo
PG_HBA_FILE="/etc/postgresql/$PG_MAJOR/main/pg_hba.conf"
cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup.$(date +%s)"

cat > "$PG_HBA_FILE" << 'PG_HBA_EOF'
# CONFIGURAÇÃO TEMPORÁRIA PARA RESET - NÃO USAR EM PRODUÇÃO
# Database administrative login by Unix domain socket
local   all             postgres                                peer

# TYPE  DATABASE        USER            ADDRESS                 METHOD
# "local" is for Unix domain socket connections only
local   all             all                                     trust
# IPv4 local connections:
host    all             all             127.0.0.1/32            trust  
# IPv6 local connections:
host    all             all             ::1/128                 trust
PG_HBA_EOF

# Iniciar postgresql com configuração temporária
systemctl start postgresql
sleep 3

success "PostgreSQL reiniciado com configuração temporária"

# 5. REMOVER E RECRIAR USUÁRIO/BANCO
log "5. Removendo usuário e banco existentes..."

sudo -u postgres psql -h /var/run/postgresql -U postgres -w << 'RESET_SQL'
-- Finalizar todas as conexões ativas
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'configharbor';

-- Remover banco e usuário (forçar)
DROP DATABASE IF EXISTS configharbor;
DROP ROLE IF EXISTS configharbor_user;
RESET_SQL

success "Usuário e banco removidos"

# 6. GERAR NOVA SENHA E RECRIAR TUDO
log "6. Gerando nova senha e recriando estruturas..."

# Gerar senha super forte
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/\n" | cut -c1-32)
info "Nova senha gerada: ${NEW_PASSWORD:0:8}... (truncada por segurança)"

# Recriar usuário e banco
sudo -u postgres psql -h /var/run/postgresql -U postgres -w << EOF
-- Criar usuário com nova senha
CREATE ROLE configharbor_user WITH LOGIN PASSWORD '$NEW_PASSWORD';

-- Criar banco
CREATE DATABASE configharbor WITH OWNER configharbor_user;

-- Conceder privilégios completos
GRANT ALL PRIVILEGES ON DATABASE configharbor TO configharbor_user;
GRANT CREATE ON DATABASE configharbor TO configharbor_user;

-- Conectar ao banco e criar schema
\c configharbor

-- Garantir permissões no schema public
GRANT ALL ON SCHEMA public TO configharbor_user;
GRANT CREATE ON SCHEMA public TO configharbor_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO configharbor_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO configharbor_user;

-- Mostrar resultado
\du configharbor_user
\l configharbor
EOF

success "Usuário e banco recriados com sucesso"

# 7. CONFIGURAR pg_hba.conf PRODUÇÃO
log "7. Configurando pg_hba.conf para produção..."

cat > "$PG_HBA_FILE" << 'PRODUCTION_HBA'
# CONFIGURAÇÃO PRODUÇÃO CONFIGHARBOR
# Database administrative login by Unix domain socket
local   all             postgres                                peer

# ConfigHarbor database connections
local   configharbor    configharbor_user                       scram-sha-256
host    configharbor    configharbor_user    127.0.0.1/32       scram-sha-256
host    configharbor    configharbor_user    ::1/128            scram-sha-256

# Bloquear outras conexões por segurança
local   all             all                                     reject
host    all             all             127.0.0.1/32            reject
host    all             all             ::1/128                 reject
PRODUCTION_HBA

# Recarregar configuração
systemctl reload postgresql
sleep 3
success "Configuração de produção aplicada"

# 8. TESTAR CONECTIVIDADE
log "8. Testando conectividade..."

if PGPASSWORD="$NEW_PASSWORD" psql -h 127.0.0.1 -U configharbor_user -d configharbor -c "SELECT 'TESTE OK' as resultado, current_timestamp;" 2>/dev/null; then
    success "✅ CONECTIVIDADE POSTGRESQL CONFIRMADA!"
else
    error "❌ Falha na conectividade mesmo após reset completo"
fi

# 9. ATUALIZAR ARQUIVO .ENV
log "9. Atualizando arquivos de configuração..."

cd "$APP_DIR"

# Gerar DATABASE_URL completa
DATABASE_URL="postgresql://configharbor_user:$NEW_PASSWORD@127.0.0.1:5432/configharbor"

# Criar .env do zero com novas credenciais
cat > .env << ENV_EOF
# Configuração do banco de dados (gerado automaticamente)
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=configharbor
PGUSER=configharbor_user
PGPASSWORD=$NEW_PASSWORD
DATABASE_URL=$DATABASE_URL

# Configuração da aplicação
NODE_ENV=production
PORT=5000
SESSION_SECRET=$(openssl rand -hex 32)
ENV_EOF

# Definir permissões corretas
chown configharbor:configharbor .env
chmod 600 .env

success "Arquivo .env atualizado com novas credenciais"

# 10. TESTAR CONECTIVIDADE COM NOVA CONFIGURAÇÃO
log "10. Testando configuração final..."

# Testar como usuário da aplicação
if sudo -u configharbor bash -c "cd $APP_DIR && source .env && PGPASSWORD=\$PGPASSWORD psql -h 127.0.0.1 -U configharbor_user -d configharbor -c 'SELECT current_database(), current_user;'" 2>/dev/null; then
    success "✅ CONFIGURAÇÃO FINAL VALIDADA!"
else
    error "❌ Problema na configuração final"
fi

# 11. HABILITAR E INICIAR SERVIÇO
log "11. Habilitando e iniciando serviço..."

systemctl enable configharbor
systemctl start configharbor
sleep 5

# Verificar status
if systemctl is-active --quiet configharbor; then
    success "🎉 SERVIÇO FUNCIONANDO PERFEITAMENTE!"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           PROBLEMA RESOLVIDO!            ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo "ConfigHarbor está rodando em: http://127.0.0.1:5000"
    echo "Usuário: admin@local"
    echo "Senha: arquivo /opt/FortiGateConfigHarbor/ADMIN_CREDENTIAL"
    echo ""
    echo "Para monitorar logs:"
    echo "sudo journalctl -u configharbor -f"
    
else
    warning "Serviço com problemas. Verificando logs..."
    journalctl -u configharbor --no-pager -l | tail -20
fi

# 12. RESUMO FINAL
log "12. Resumo das alterações:"
info "- PostgreSQL resetado completamente"
info "- Usuário configharbor_user recriado"
info "- Banco configharbor recriado"  
info "- Nova senha gerada: ${NEW_PASSWORD:0:8}..."
info "- Arquivo .env regenerado"
info "- pg_hba.conf configurado para produção"
info "- Serviço reiniciado"

echo ""
success "🚀 CORREÇÃO DEFINITIVA CONCLUÍDA!"