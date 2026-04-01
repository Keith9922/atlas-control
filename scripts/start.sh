#!/bin/bash
#
# Atlas Control Center 启动脚本
#

set -e

echo "========================================"
echo "  Atlas Control Center 启动脚本"
echo "========================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装 Node.js"
    echo "请先安装 Node.js 18+: https://nodejs.org/"
    exit 1
fi

# 检查端口
PORT=${1:-3000}

echo "端口: $PORT"

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

# 构建前端
echo "构建前端..."
cd web && npm install && npm run build && cd ..

# 启动服务
echo "启动服务..."
PORT=$PORT npm start
