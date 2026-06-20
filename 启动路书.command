#!/bin/zsh
# 双击这个文件即可启动“路书”。关掉这个窗口工具就停了。
cd "$(dirname "$0")"
echo "路书正在启动……浏览器会自动打开。用完直接关掉本窗口即可。"
exec node server.js
