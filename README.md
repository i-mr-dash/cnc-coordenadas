# CNC Coordenadas — O Jogo

Jogo de treino para preencher tabelas de coordenadas de torno CNC (absolutas, incrementais e G-code),
com progressão estilo Angry Birds: 15 fases + Modo Infinito, estrelas, XP, patentes, moedas, loja e tutorial dinâmico.

## Como rodar

No PC: dê duplo clique em `servidor.bat` (ou rode `python -m http.server 8123` na pasta) e abra `http://localhost:8123`.

No iPad/iPhone (mesma tailnet, com o PC ligado e o servidor rodando):

**https://dashlap.tail3712ea.ts.net:8123**

O proxy do Tailscale já está configurado (`tailscale serve --https=8123`, visível só dentro da tailnet — não é Funnel).
Para desligar: `tailscale serve --https=8123 off`.

### Atalho na tela de início do iPad
Abra o link no Safari → botão Compartilhar → **Adicionar à Tela de Início**. O jogo abre em tela cheia,
sem barra do navegador (manifest + `apple-mobile-web-app-capable`), com ícone próprio e respeitando as safe areas.

## Convenções técnicas usadas

- `X` = **diâmetro** (nunca raio)
- `Z0` = face direita acabada (zero-peça `W`)
- `Z` negativo = para dentro da peça
- Chanfro `C x45°` → entra em `ø − 2C`, avança `C` em Z
- Raio `R` → consome `R` no raio (`2R` no diâmetro) e `R` em Z

## Progressão

| Fase | Desbloqueia |
|---|---|
| 2 | Loja |
| 3 | Tema Blueprint |
| 5 | Assistente Δ (mostra o ponto anterior) |
| 8 | Revelar célula (40 🪙) |
| 12 | Tema Neon |
| 15 | Modo Infinito (peças aleatórias) |

Estrelas: 3★ acertando de primeira sem dica paga · 2★ com poucas tentativas/dicas · 1★ concluindo.
Revelar célula limita a 2★ (1★ da terceira em diante); "ver a resposta" ou pedir dica sem ficha, 1★.
O CHEFE (fase 15) exige 23★ acumuladas.
Após 3 tentativas erradas o botão **Explicar** libera o passo a passo ponto a ponto.
Fase repetida rende 30% da recompensa.

## Ajuda que o jogo dá

- **Dica adaptativa**: lê o que você digitou, acha a primeira célula errada e diagnostica o erro clássico
  (raio no lugar do diâmetro, sinal de Z, X trocado com Z, incremental na coluna absoluta, chanfro contado
  de um lado só, G0/G1 trocado). Nível 1 é sempre grátis; aprofundar gasta 💡.
- **Meu perfil**: desenha em tracejado o contorno que os SEUS números formam, sobre a peça correta.
- **Relatório de erro**: aponta qual coluna concentra os erros e qual padrão se repete.
- Backup do progresso em Manual → Exportar/Importar save.

## Arquivos

- `index.html` — estrutura das telas (mapa, jogo, loja, manual, modais, tutorial)
- `css/style.css` — temas (steel, blueprint, neon, impressão) e layout
- `js/levels.js` — dados das fases + gerador do Modo Infinito
- `js/game.js` — motor: tabela, verificação, dicas, recompensas, desenho técnico em canvas, tutorial

Progresso salvo em `localStorage` (chave `cncgame_v1`).
