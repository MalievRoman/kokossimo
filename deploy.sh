#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/home/deploy/apps/kokossimo"
BACKEND_DIR="$APP_ROOT/kokossimo-backend"
FRONTEND_DIR="$APP_ROOT/kokossimo-frontend"
STATIC_DIR="/var/www/kokossimo"

log() {
  echo "==> $1"
}

log "Pull latest code"
cd "$APP_ROOT"
if ! git pull --ff-only; then
  if git status --porcelain | grep -q "^\?\? deploy.sh$"; then
    log "Untracked deploy.sh detected. Replacing with repo version."
    rm -f deploy.sh
    git pull --ff-only
    chmod +x deploy.sh
    exec ./deploy.sh
  fi
  echo "git pull failed. Fix conflicts and rerun."
  exit 1
fi

log "Backend update"
cd "$BACKEND_DIR"
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn-kokossimo

log "Frontend build"
cd "$FRONTEND_DIR"
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install it first: sudo apt install -y nodejs npm"
  exit 1
fi
npm install --no-fund --no-audit
npm run build

log "Copy frontend static to backend staticfiles (Nginx serves /static/ from here)"
rm -rf "$BACKEND_DIR/staticfiles/js"
cp -r dist/js "$BACKEND_DIR/staticfiles/"
[ -d dist/assets ] && rm -rf "$BACKEND_DIR/staticfiles/assets" && cp -r dist/assets "$BACKEND_DIR/staticfiles/"
[ -f dist/favicon.png ] && cp dist/favicon.png "$BACKEND_DIR/staticfiles/"
sudo chmod -R o+rX "$BACKEND_DIR/staticfiles"

log "Publish frontend"
sudo mkdir -p "$STATIC_DIR"
sudo rm -rf "$STATIC_DIR"/*
sudo cp -r dist/* "$STATIC_DIR"/
sudo systemctl restart nginx

log "Deploy completed"
