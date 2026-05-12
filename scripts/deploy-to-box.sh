#!/usr/bin/env bash
#
# 把 atlas-control 一键部署到 Atlas 盒子（已用作主控的那一台）
#
# 用法:
#   bash scripts/deploy-to-box.sh <user>@<box-ip>          # 用 SSH 密钥
#   SSHPASS=xxx bash scripts/deploy-to-box.sh <user>@<ip>  # 用密码（需要 sshpass）
#
# 前提:
#   - 目标盒子已存在 /opt/node20 (Node 20 已装) 和 /opt/atlas-control/ (首次安装过)
#   - 目标盒子已存在 atlas-control.service systemd unit
#

set -e
TARGET="${1:?usage: $0 <user>@<box-ip>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building frontend..."
cd "$REPO_ROOT/web"
npm run build

echo "==> Packaging atlas-control sources..."
cd "$REPO_ROOT/.."
tar -czf /tmp/atlas-control-update.tar.gz \
  --exclude='atlas-control/node_modules' \
  --exclude='atlas-control/web/node_modules' \
  --exclude='atlas-control/.git' \
  atlas-control/

echo "==> Pushing to $TARGET ..."
if [ -n "$SSHPASS" ]; then
  SSH() { sshpass -e ssh -o StrictHostKeyChecking=no "$@"; }
  SCP() { sshpass -e scp -o StrictHostKeyChecking=no "$@"; }
else
  SSH() { ssh "$@"; }
  SCP() { scp "$@"; }
fi
export SSHPASS

SCP /tmp/atlas-control-update.tar.gz "$TARGET:/tmp/"
SSH "$TARGET" "
  set -e
  PW=\"\${ATLAS_SUDO_PW:-}\"
  do_sudo() {
    if [ \"\$(id -u)\" = 0 ]; then bash -c \"\$1\"
    elif [ -n \"\$PW\" ]; then echo \"\$PW\" | sudo -S -p '' bash -c \"\$1\"
    else sudo bash -c \"\$1\"
    fi
  }
  do_sudo '
    rm -rf /tmp/atlas-control-new
    mkdir -p /tmp/atlas-control-new
    tar -xzf /tmp/atlas-control-update.tar.gz -C /tmp/atlas-control-new
    rsync -a --delete \
      --exclude=node_modules --exclude=web/node_modules \
      /tmp/atlas-control-new/atlas-control/ /opt/atlas-control/
    rm -rf /tmp/atlas-control-new /tmp/atlas-control-update.tar.gz
    cd /opt/atlas-control
    /opt/node20/bin/npm install --omit=dev --no-audit --no-fund --loglevel=error 2>&1 | tail -3
    systemctl restart atlas-control
    sleep 4
    systemctl is-active atlas-control
  '
"
echo "==> Done. Visit http://<box-ip>:3000"
