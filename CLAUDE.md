# LacraiaVR

Lacraia do Céu: tiro em VR para o Meta Quest 3 no navegador (WebXR), sem instalar nada. O jogador
fica parado no centro de uma cúpula de céu noturno; uma lacraia de gomos desce pela cúpula em faixas
ao redor dele, costurando entre cogumelos luminosos fincados no céu. **Cada mão tem um estilingue de
luz**: aponta e aperta o gatilho. Gomo acertado vira cogumelo e divide a lacraia em duas. 12 fases em
3 mundos (Jardim de Vagalumes 160°, Gruta de Cristal 240°, Céu de Tempestade 360°), a 4ª de cada
mundo é um chefe. Estrelas pelo tempo, modo Fliperama (as 12 seguidas) com recorde de 3 letras.
Também joga no PC com mouse e teclado. Tudo em português. Releitura original do gênero (nomes,
bichos, chefes e visual próprios).

## Como rodar / jogar

**No Quest:** abrir no navegador do óculos o endereço publicado (quando for publicado:
**https://parappathe.github.io/LacraiaVR/**) e apertar "Entrar em VR". Para atualizar o site:
commitar e rodar `python publicar.py LacraiaVR` na pasta `C:\claude code` (só quando o Eduardo pedir).

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8873` (o painel de
visualização usa `.claude/launch.json`). O `serve.py` manda o navegador não guardar cache;
`python serve.py --https` serve para abrir no Quest pela rede de casa (porta 8443).

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Mirar | Apontar o controle (ou a mão); um pontinho de luz mostra onde o tiro chega | Mouse (mira redonda na tela) |
| Atirar | Gatilho (ou pinça com a mão); segurar continua atirando no ritmo do estilingue | Clique esquerdo ou espaço (segurar continua) |
| Olhar em volta | Virar a cabeça e o corpo | A/D (ou setas) giram, W/S sobem/descem a vista; arrastar com o botão direito |
| Pausa | B ou Y | Esc ou P |
| Menu | Apontar com o controle e gatilho | Clique |
| FPS | Menu → FPS | Tecla F |

Na pausa do VR, "Recentralizar" põe a cabeça no centro da cúpula olhando para a frente. O controle
vibra a cada tiro, nas mordidas e nas pancadas dos chefes. A cabeça da lacraia faz "tic-tic" em áudio
3D no lugar dela (as duas cabeças mais baixas), então dá para achar pelo som, principalmente no 360°.

### Regras

- **Cúpula:** raio 4,5 m em volta da cabeça. Fileiras de 4° (da fileira 0, 46° para cima, até a
  linha vermelha da mordida, 10° para baixo), colunas de 6°. Arco: 162° no mundo 1, 240° no 2,
  360° no 3.
- **Lacraia:** anda uma casa por vez (5 a 7,5 casas/s). Bateu num cogumelo ou na borda do arco,
  desce uma fileira e inverte. No 360° não há borda: a cada volta, ao passar pela costura atrás do
  jogador, desce uma fileira. Cogumelo envenenado: a cabeça mergulha reto para baixo. Os gomos saem
  um a um de uma toca no alto.
- **Tiro:** 24 m/s, um a cada 0,3 s por mão. Acerta a coisa mais perto do ponto onde chega na cúpula.
  Gomo acertado vira cogumelo e a lacraia se divide (a parte de trás ganha cabeça). Cogumelo some com
  3 tiros.
- **Mordida:** cabeça que chega na linha vermelha morde: perde uma vida, todas as lacraias somem e
  voltam lá de cima 2,2 s depois com os mesmos gomos; os cogumelos envenenados saram.
- **Inimigos:** aranha (pula na faixa de baixo comendo cogumelos; se atravessar 120° em 9 s, morde e
  tira uma vida; vale 300/600/900 quanto mais baixa); pulga (cai reta deixando cogumelos, aguenta 2
  tiros); escorpião (atravessa uma fileira alta envenenando cogumelos, vale 1000).
- **Chefes:** Fase 4, **Rainha dos Vagalumes**: 14 gomos blindados (3 tiros cada, não se divide: o
  gomo quebrado some), cresce um gomo a cada 3 s até 16; a coroa (8 tiros) só racha com 4 gomos ou
  menos. Fase 8, **Tecelã de Cristal**: aranhona de cristal no alto, 30 de vida, só leva dano com os
  olhos abertos (2 s a cada 6 s); solta filhotes de lacraia a cada 7 s e fios de teia (casas que
  bloqueiam como cogumelo). Fase 12, **Dragão da Tempestade**: lacraia de 22 gomos no 360°; só a
  cabeça leva dano (24 tiros), a cauda quebra e encurta, o corpo é nuvem; a cada 4 tiros na cabeça ele
  some nas nuvens por 1,6 s e volta em outro lugar mais rápido; raios envenenam 2 cogumelos a cada 5 s.
- **Pontos:** cabeça 100, gomo 10, cogumelo 5, pulga 200, escorpião 1000, chefes dão bônus. No fim:
  bônus de vidas e de tempo.
- **Estrelas** pelo "tempo efetivo" (tempo + 20 s por vida perdida); limites em `par` de cada fase.
  Vencer libera a próxima.
- **Fliperama:** as 12 fases seguidas com as vidas que sobraram (+1 vida a cada chefe), pontos
  somados; no fim, se entrar nos 8 melhores, escolhe 3 letras (no PC dá para digitar).
- Progresso, recordes e opções no navegador (localStorage `lacraiavr.v1`).

Fases (em `js/levels.js`): Jardim: 1 Primeira lacraia, 2 Aranha no capim, 3 Chuva de pulgas,
4 Rainha dos Vagalumes. Gruta: 5 Eco na gruta, 6 Escorpião de vidro, 7 Cabeças soltas, 8 Tecelã de
Cristal. Tempestade: 9 Céu aberto, 10 Ventania, 11 Tudo ao mesmo tempo, 12 Dragão da Tempestade.

## Como testar

- `node tests/run.js` (ou `npm test`): grade da cúpula (arcos, colunas ida e volta), fases válidas,
  movimento da lacraia (anda, segue a cabeça, cogumelo e borda, costura do 360°, mergulho envenenado,
  previsão do caminho), estilingue (cadência, duas mãos, só com gatilho), acertos (gomo vira cogumelo
  e divide, cabeça, cogumelo com 3 tiros), mordida (perde vida, as lacraias voltam lá de cima, perder
  a fase, vencer), aranha (faixa de baixo, come cogumelos, morde se atravessar), pulga, escorpião,
  os três chefes e o **robô**: joga as 12 fases com 5 sementes, com limites humanos (reação de
  0,3 s, corpo gira até 150°/s, mão até 260°/s e só 75° para o lado, erro de mira de 1,6° e de 30%
  no quanto adiantar a mira, 0,45 s para firmar a mira a cada alvo novo, um alvo por vez) e tem que
  vencer todas com pelo menos 2 estrelas. Imprime o tempo efetivo por fase. Termina com "Tudo certo".
  Não toca som.
- No navegador (console): `dev.loadLevel(8)` abre a fase 8 (1 a 12, ignora o bloqueio),
  `dev.autoplay = true` faz o robô jogar, `dev.advance(20)` avança 20 s na hora, `dev.state()`
  mostra tela, fase, vidas, pontos, lacraias, inimigos e chefe, `dev.arcade()` começa o fliperama,
  `dev.snapshot()` devolve a imagem da tela (JPEG em data URL), `dev.resetSave()` apaga progresso e
  recordes. `window.lacraia` tem `game`, `save`, `sfx`, `robot`, `view` (para onde a câmera do PC
  olha), `startLevel`, `startArcade`, `goMenu`.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", HUD do PC, mira redonda do mouse |
| `js/vec.js` | Vetores 3D em arrays, azimute/elevação, aleatório com semente. Sem navegador |
| `js/sim.js` | Regras: `Game` (grade da cúpula, lacraias, cogumelos, tiros, aranha, pulga, escorpião, chefes, mordidas, estrelas e pontos), `headStep` e `predictSeg` (usados pelo robô). Sem navegador |
| `js/levels.js` | Os 3 mundos (arco de cada um) e as 12 fases (ondas, inimigos, limites de estrelas). Sem navegador |
| `js/robot.js` | Robô com limites humanos: escolhe o alvo mais perigoso, prevê para onde ele vai e mira com as duas mãos. Testes e `dev.autoplay`. Sem navegador |
| `js/main.js` | Liga tudo: render, VR (estilingues nos controles, mira, vibração, recentralizar), mouse/teclado, menus (fases, fliperama, recordes, letras), letreiro, eventos → sons e efeitos, `dev` |
| `js/scene.js` | Os 3 céus (texturas em canvas, capim e flores, cristais e estalagmites, nuvens e para-raios, relâmpago), linhas do arco e da mordida, letreiro do placar, gomos/cogumelos/teias instanciados, aranha, pulga, escorpião, coroa, Tecelã, cabeça do Dragão, tiros, estilingue, partículas |
| `js/ui.js` | Painel de menu 3D em canvas, quadradinhos de fase e placas de texto |
| `js/audio.js` | Sons sintetizados com áudio 3D (HRTF) e uma musiquinha por mundo |
| `js/save.js` | Progresso, recordes (8 melhores) e opções |
| `tests/run.js` | Testes |
| `serve.py` | Servidor local sem cache (porta 8873, `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas: metros; chão em y = 0, o jogador em x = 0, z = 0 olhando para -z. Centro da cúpula em
(0; 1,4; 0), raio 4,5 m. Azimute 0 = frente, 90 = direita; a costura do 360° fica atrás (±180°).

## Regras e convenções do projeto

- `vec.js`, `sim.js`, `levels.js` e `robot.js` não podem usar navegador nem Three.js: os testes
  rodam no Node.
- `scene.js` desenha tudo com as medidas de `DOME` do `sim.js` (`domePos`, `elOf`).
- Fase nova ou mudada: rodar `node tests/run.js` e conferir o tempo efetivo do robô impresso no fim;
  `par` tem que deixar o robô com 2 estrelas ou mais com folga (3 estrelas perto do tempo típico).
- Eventos do jogo (`game.events`) são a única ponte da lógica para som, vibração e efeitos.
- A física roda em passos fixos de 1/120 s; o desenho interpola o meio do passo da lacraia.

## Decisões

- Tudo acontece na superfície da cúpula, a 4,5 m: nada vem na direção do rosto (conforto). O jogador
  fica parado e a câmera do VR nunca é mexida pelo jogo.
- O tiro acerta pelo ponto onde chega na cúpula (não tem nada no caminho), com raio de acerto um
  pouco maior que o desenho; a mira de luz no VR mostra esse ponto.
- O arco cresce por mundo (160°, 240°, 360°) para o jogador ir aprendendo a virar; no 360° a lacraia
  desce a cada volta (a costura fica atrás) e o "tic-tic" da cabeça em áudio 3D ajuda a achá-la.
- Aranha que atravessa morde (tira vida) para ela ser uma ameaça de verdade, já que ela nunca chega
  perto do jogador.
- A Rainha não se divide (senão bastava acertar perto da cabeça); a coroa só racha com o corpo curto.
- O robô mira um alvo por vez e leva 0,45 s para firmar a mira a cada troca (sem isso ele matava
  tudo na saída da toca, rápido demais para servir de régua).
- Estrelas por tempo (com 20 s de multa por vida perdida), calibradas pelo robô.
- Desempenho de Quest: pixelRatio 1, foveação, gomos, pernas, olhos, cogumelos e teias em
  InstancedMesh, partículas num só `Points`, 2 luzes sem sombra, sem pós-processamento.
- Porta do servidor local 8873.

## Pendências / problemas conhecidos

- **Nada foi testado no Quest ainda.** Só o óculos verifica: se mirar com o controle a 4,5 m é
  preciso o bastante (raio de acerto de 25 cm), se a pinça das mãos atira bem, a posição do
  estilingue no controle, o conforto de olhar para cima (fileira 0 a 46°) e de virar 360°, se o
  áudio 3D da cabeça ajuda mesmo a achar a lacraia, recentralizar, vibração e FPS.
- No PC foi conferido que a página abre sem erro e que o robô joga as fases; sons e música só
  foram checados por não dar erro, ninguém ouviu ainda.
- A dificuldade foi calibrada pelo robô; gente de verdade deve levar mais tempo. Os limites de
  estrela estão em `par` de cada fase.
