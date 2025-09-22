#!/bin/bash

# Script de diagnóstico e correção para problemas de autenticação PostgreSQL
# Execute este script no servidor de produção onde o erro está ocorrendo

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCESSO] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

echo "🔧 DIAGNÓSTICO E CORREÇÃO DE AUTENTICAÇÃO POSTGRESQL"
echo "=================================================="

# Verificar se está executando como root
if [[ $EUID -ne 0 ]]; then
   error "Este script deve ser executado como root: sudo $0"
fi

APP_DIR="/opt/FortiGateConfigHarbor"

# 1. Verificar estrutura de arquivos
log "1. Verificando estrutura de arquivos..."

if [ ! -d "$APP_DIR" ]; then
    error "Diretório $APP_DIR não encontrado. Execute o script install.sh primeiro."
fi

if [ ! -f "$APP_DIR/.env" ]; then
    error "Arquivo $APP_DIR/.env não encontrado."
fi

success "Estrutura de diretórios OK"

# 2. Verificar credenciais atuais
log "2. Verificando credenciais atuais..."
cd "$APP_DIR"

if ! grep -q "DATABASE_URL" .env; then
    error "DATABASE_URL não encontrado no arquivo .env"
fi

if ! grep -q "PGPASSWORD" .env; then
    error "PGPASSWORD não encontrado no arquivo .env"
fi

# Extrair credenciais atuais
CURRENT_PASSWORD=$(grep "PGPASSWORD=" .env | cut -d'=' -f2)
CURRENT_DB_URL=$(grep "DATABASE_URL=" .env | cut -d'=' -f2-)

log "Credenciais atuais detectadas"

# 3. Testar conectividade atual
log "3. Testando conectividade atual..."

if PGPASSWORD="$CURRENT_PASSWORD" psql -h 127.0.0.1 -U configharbor_user -d configharbor -c "SELECT 1;" &>/dev/null; then
    success "Conectividade OK! O problema pode estar na aplicação, não no banco."
    log "Reiniciando serviço..."
    systemctl restart configharbor
    sleep 5
    if systemctl is-active --quiet configharbor; then
        success "Serviço reiniciado com sucesso!"
        log "Execute: sudo journalctl -u configharbor -f"
        exit 0
    else
        warning "Serviço ainda com problema após restart"
    fi
else
    warning "Conectividade com banco falhando. Regenerando credenciais..."
fi

# 4. Regenerar credenciais PostgreSQL
log "4. Regenerando credenciais do banco de dados..."

# Gerar nova senha
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
log "Nova senha gerada"

# Alterar senha no PostgreSQL usando socket Unix
if sudo -u postgres psql -h /var/run/postgresql -U postgres -w -v ON_ERROR_STOP=1 <<EOF
ALTER ROLE configharbor_user WITH PASSWORD '$NEW_PASSWORD';
\q
EOF
then
    success "Senha alterada no PostgreSQL"
else
    error "Falha ao alterar senha no PostgreSQL. Verifique configuração pg_hba.conf"
fi

# 5. Atualizar arquivo .env
log "5. Atualizando arquivo .env..."

if sed -i "s/PGPASSWORD=.*/PGPASSWORD=$NEW_PASSWORD/" .env && \
   sed -i "s|DATABASE_URL=postgresql://configharbor_user:[^@]*@|DATABASE_URL=postgresql://configharbor_user:$NEW_PASSWORD@|" .env; then
    success "Arquivo .env atualizado"
else
    error "Falha ao atualizar arquivo .env"
fi

# 6. Testar nova conectividade
log "6. Testando nova conectividade..."

if PGPASSWORD="$NEW_PASSWORD" psql -h 127.0.0.1 -U configharbor_user -d configharbor -c "SELECT 1;" &>/dev/null; then
    success "Nova conectividade confirmada!"
else
    error "Falha mesmo com nova senha. Problema na configuração PostgreSQL."
fi

# 7. Reiniciar serviço
log "7. Reiniciando serviço ConfigHarbor..."

systemctl restart configharbor
sleep 5

if systemctl is-active --quiet configharbor; then
    success "✅ PROBLEMA RESOLVIDO! Serviço funcionando normalmente."
    echo ""
    echo "Para monitorar os logs:"
    echo "sudo journalctl -u configharbor -f"
    echo ""
    echo "Para acessar o sistema:"
    echo "http://localhost:5000"
else
    warning "Serviço ainda com problemas. Verificar logs:"
    echo "sudo journalctl -u configharbor -l"
    
    log "Verificando últimos logs..."
    journalctl -u configharbor --no-pager -l | tail -20
fi