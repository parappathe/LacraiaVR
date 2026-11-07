// Os 3 mundos e as 12 fases da Lacraia do Céu. Sem navegador.
//
// Cada mundo tem um arco da cúpula onde a lacraia anda (em graus, centrado na frente do
// jogador): 160° no Jardim, 240° na Gruta e a volta inteira (360°) no Céu de Tempestade.
//
// Campos de cada fase:
//   mush     quantos cogumelos começam fincados na cúpula
//   waves    ondas de lacraias, uma depois da outra: { len (gomos), speed (casas por segundo),
//            heads (cabeças soltas que entram junto) }
//   spider / flea / scorp   [primeira aparição em s, intervalo médio em s] ou ausente
//   boss     'queen' (Rainha dos Vagalumes), 'weaver' (Tecelã de Cristal), 'dragon' (Dragão da
//            Tempestade); só na 4ª fase de cada mundo
//   par      [3 estrelas, 2 estrelas] em segundos de "tempo efetivo" (tempo + 20 s por vida
//            perdida), calibrados pelo robô (ver tests/run.js)

export const WORLDS = [
  { name: 'Jardim de Vagalumes', short: 'Jardim', arc: 160, theme: 0, hint: 'Aponte o estilingue e aperte o gatilho. Acertou um gomo, ele vira cogumelo.' },
  { name: 'Gruta de Cristal', short: 'Gruta', arc: 240, theme: 1, hint: 'A cúpula ficou mais larga: olhe para os lados. Escorpiões envenenam cogumelos.' },
  { name: 'Céu de Tempestade', short: 'Tempestade', arc: 360, theme: 2, hint: 'A lacraia dá a volta toda em você: siga o som da cabeça dela.' },
];

export const LEVELS = [
  // ---------- Mundo 1: Jardim de Vagalumes ----------
  { name: 'Primeira lacraia', world: 0, mush: 16, waves: [{ len: 10, speed: 5 }, { len: 10, speed: 5 }, { len: 12, speed: 5 }], par: [26, 60] },
  { name: 'Aranha no capim', world: 0, mush: 20, waves: [{ len: 12, speed: 5.5 }, { len: 12, speed: 5.5 }, { len: 10, speed: 5.5, heads: 2 }], spider: [6, 13], par: [28, 65] },
  { name: 'Chuva de pulgas', world: 0, mush: 18, waves: [{ len: 12, speed: 5.5 }, { len: 10, speed: 6, heads: 2 }, { len: 12, speed: 6, heads: 2 }], spider: [10, 16], flea: [5, 10], par: [30, 80] },
  { name: 'Rainha dos Vagalumes', world: 0, mush: 18, boss: 'queen', waves: [], spider: [12, 16], par: [30, 75] },
  // ---------- Mundo 2: Gruta de Cristal ----------
  { name: 'Eco na gruta', world: 1, mush: 26, waves: [{ len: 12, speed: 6 }, { len: 12, speed: 6 }, { len: 12, speed: 6, heads: 2 }], spider: [8, 14], par: [30, 70] },
  { name: 'Escorpião de vidro', world: 1, mush: 28, waves: [{ len: 12, speed: 6 }, { len: 10, speed: 6.5, heads: 2 }, { len: 12, speed: 6.5, heads: 2 }], spider: [12, 15], scorp: [6, 12], par: [30, 85] },
  { name: 'Cabeças soltas', world: 1, mush: 26, waves: [{ len: 8, speed: 6.5, heads: 4 }, { len: 10, speed: 6.5, heads: 3 }, { len: 10, speed: 7, heads: 3 }], flea: [6, 11], scorp: [10, 13], par: [30, 85] },
  { name: 'Tecelã de Cristal', world: 1, mush: 22, boss: 'weaver', waves: [{ len: 8, speed: 5.5 }], spider: [15, 18], par: [30, 70] },
  // ---------- Mundo 3: Céu de Tempestade ----------
  { name: 'Céu aberto', world: 2, mush: 34, waves: [{ len: 12, speed: 6.5 }, { len: 12, speed: 6.5, heads: 2 }, { len: 10, speed: 7, heads: 3 }], spider: [9, 14], par: [32, 85] },
  { name: 'Ventania', world: 2, mush: 36, waves: [{ len: 12, speed: 6.5 }, { len: 12, speed: 6.5, heads: 1 }, { len: 12, speed: 6.5, heads: 2 }], flea: [5, 9], scorp: [9, 12], par: [32, 90] },
  { name: 'Tudo ao mesmo tempo', world: 2, mush: 36, waves: [{ len: 14, speed: 6.5, heads: 1 }, { len: 12, speed: 6.5, heads: 2 }, { len: 12, speed: 7, heads: 2 }], spider: [10, 13], flea: [7, 11], scorp: [14, 14], par: [34, 110] },
  { name: 'Dragão da Tempestade', world: 2, mush: 30, boss: 'dragon', waves: [], spider: [14, 16], flea: [10, 14], par: [26, 60] },
];

export const LEVELS_PER_WORLD = 4;

export function starsFor(level, effTime) {
  const p = LEVELS[level].par;
  return effTime <= p[0] ? 3 : effTime <= p[1] ? 2 : 1;
}
