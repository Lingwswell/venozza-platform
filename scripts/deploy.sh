#!/usr/bin/env bash
# Publica a versao atual do codigo no servidor:
# backup do banco -> migrations -> prisma generate -> build -> reinicia o servico.
# Para no primeiro erro; se o build falhar o site antigo continua no ar.
#
#   bash scripts/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE="${VENOZZA_SERVICE:-venozza-web}"
cd "$APP_DIR"

step() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }

step "Backup dos bancos"
if [ -x /usr/local/sbin/backup-bancos.sh ]; then
  sudo /usr/local/sbin/backup-bancos.sh
else
  echo "(script de backup nao encontrado, seguindo)"
fi

step "Migrations"
npx prisma migrate deploy

step "Prisma Client"
npx prisma generate

step "Build (pode levar alguns minutos)"
npm run build

step "Reiniciando $SERVICE"
sudo systemctl restart "$SERVICE"
sleep 3
sudo systemctl --no-pager --lines=0 status "$SERVICE" | head -5

printf '\n\033[1;32mPronto! Abra o site com Ctrl+Shift+R.\033[0m\n'
