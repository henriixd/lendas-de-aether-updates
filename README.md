# Lendas de Aether — atualizações

Esta pasta é servida pelo GitHub Pages em `https://henriixd.github.io/lendas-de-aether-updates/`.
O jogo (APK e PC) lê `update.json` ao abrir; se o `build` daqui for maior que o dele,
mostra "Nova versão disponível" e baixa só os arquivos que mudaram (lista em `files.txt`).

Para publicar uma versão nova: no projeto do jogo rode
`python3 tools/make_update.py <build> <versão> --notes "..." --out <esta pasta>` e envie as mudanças.
