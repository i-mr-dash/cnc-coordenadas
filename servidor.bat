@echo off
REM Sobe o jogo em http://localhost:8123 e, via Tailscale, em
REM https://dashlap.tail3712ea.ts.net:8123 (acessivel do iPad/iPhone no tailnet)
cd /d "%~dp0"
echo Servindo "CNC Coordenadas" na porta 8123...
echo   PC   : http://localhost:8123
echo   iPad : https://dashlap.tail3712ea.ts.net:8123
python serve.py 8123
