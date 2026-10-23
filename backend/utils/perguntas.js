/**
 * Geração de perguntas contextualizadas para os 4 módulos do Calculoco.
 *
 * Cada módulo tem um tema fixo (igual ao cenário de fundo da fase), e os
 * enunciados daquele módulo só usam contextos que combinam com o tema:
 *   1 = Adição        → Ilha    (praia, aquário)
 *   2 = Subtração     → Mercado (mercado, casa/cozinha)
 *   3 = Multiplicação → Selva   (parque, fazenda)
 *   4 = Divisão       → Vale    (parque, fazenda)
 *
 * Cada módulo tem 5 níveis de dificuldade crescente. As faixas são estreitas
 * e os dois números ficam na mesma ordem de grandeza, então as perguntas de
 * um mesmo nível têm dificuldade parecida (sem pular de 2+3 para 58+40) e a
 * escada entre os níveis sobe de forma suave.
 */

function numeroAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function escolher(lista) {
  return lista[numeroAleatorio(0, lista.length - 1)];
}

// Concordância singular/plural: quando a quantidade é 1, usa o singular.
function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

// Gera 3 distratores plausíveis, com espalhamento proporcional ao tamanho
// da resposta correta.
function gerarDistratores(correta) {
  const espalhamento = Math.min(20, Math.max(2, Math.round(correta * 0.25)));
  const candidatos = new Set();
  const baseOffsets = [];
  for (let i = 1; i <= espalhamento; i++) baseOffsets.push(i, -i);

  for (const offset of embaralhar(baseOffsets)) {
    const valor = correta + offset;
    if (valor >= 0 && valor !== correta) candidatos.add(valor);
    if (candidatos.size === 3) break;
  }

  let extra = espalhamento + 1;
  while (candidatos.size < 3) {
    const valor = correta + extra;
    if (valor >= 0 && valor !== correta) candidatos.add(valor);
    extra++;
  }

  return [...candidatos];
}

function montarQuestao({ enunciado, correta, operacao, contexto }) {
  const distratores = gerarDistratores(correta);
  const valores = embaralhar([correta, ...distratores]);
  const correctIndex = valores.indexOf(correta);
  return {
    enunciado,
    operacao,
    contexto,
    opcoes: valores.map(String),
    correctIndex,
  };
}

/* ===================== MÓDULO 1 — ADIÇÃO (ILHA) ===================== */

// Os dois números saem da mesma faixa, então têm tamanho parecido.
// Somas por nível: ~2–12, 8–22, 18–36, 30–60, 50–100.
const NIVEIS_ADICAO = [
  { min: 1, max: 6 },
  { min: 4, max: 11 },
  { min: 9, max: 18 },
  { min: 15, max: 30 },
  { min: 25, max: 50 },
];

const TEMPLATES_ADICAO = [
  {
    contexto: "praia",
    texto: (a, b) =>
      `Clara juntou ${a} ${pluralizar(a, "concha", "conchas")} de manhã e mais ${b} à tarde na praia. Quantas conchas ela tem agora?`,
  },
  {
    contexto: "praia",
    texto: (a, b) =>
      `Havia ${a} ${pluralizar(a, "caranguejo", "caranguejos")} na areia e chegaram mais ${b}. Quantos caranguejos há agora?`,
  },
  {
    contexto: "aquario",
    texto: (a, b) =>
      `No aquário havia ${a} ${pluralizar(a, "peixinho", "peixinhos")} e o mergulhador soltou mais ${b}. Quantos peixinhos há agora?`,
  },
  {
    contexto: "praia",
    texto: (a, b) =>
      `Caíram ${a} ${pluralizar(a, "coco", "cocos")} de um coqueiro e ${b} de outro. Quantos cocos caíram ao todo?`,
  },
  {
    contexto: "praia",
    texto: (a, b) =>
      `Havia ${a} ${pluralizar(a, "barquinho", "barquinhos")} no mar e chegaram mais ${b}. Quantos barquinhos há no mar agora?`,
  },
  {
    contexto: "aquario",
    texto: (a, b) =>
      `Pedro viu ${a} ${pluralizar(a, "estrela-do-mar", "estrelas-do-mar")} perto das pedras e mais ${b} na areia. Quantas estrelas-do-mar ele viu ao todo?`,
  },
];

function gerarAdicao(nivel) {
  const cfg = NIVEIS_ADICAO[nivel - 1];
  const a = numeroAleatorio(cfg.min, cfg.max);
  const b = numeroAleatorio(cfg.min, cfg.max);
  const template = escolher(TEMPLATES_ADICAO);
  return montarQuestao({
    enunciado: template.texto(a, b),
    correta: a + b,
    operacao: "adicao",
    contexto: template.contexto,
  });
}

/* ===================== MÓDULO 2 — SUBTRAÇÃO (MERCADO) ===================== */

// Minuendo por faixa; o subtraendo fica entre ~20% e ~80% dele, para o
// resultado não ser trivial (nem quase o total, nem quase zero).
const NIVEIS_SUBTRACAO = [
  { min: 5, max: 9 },
  { min: 9, max: 16 },
  { min: 15, max: 26 },
  { min: 24, max: 42 },
  { min: 38, max: 65 },
];

const TEMPLATES_SUBTRACAO = [
  {
    contexto: "mercado",
    texto: (a, b) =>
      `A banca tinha ${a} ${pluralizar(a, "maçã", "maçãs")} e o feirante vendeu ${b} ${pluralizar(b, "maçã", "maçãs")}. Quantas maçãs sobraram?`,
  },
  {
    contexto: "mercado",
    texto: (a, b) =>
      `Na prateleira havia ${a} ${pluralizar(a, "banana", "bananas")} e um cliente levou ${b}. Quantas bananas ficaram?`,
  },
  {
    contexto: "mercado",
    texto: (a, b) =>
      `A padaria assou ${a} ${pluralizar(a, "pão", "pães")} e vendeu ${b}. Quantos pães sobraram?`,
  },
  {
    contexto: "mercado",
    texto: (a, b) =>
      `O caixote tinha ${a} ${pluralizar(a, "ovo", "ovos")} e o feirante vendeu ${b}. Quantos ovos restaram no caixote?`,
  },
  {
    contexto: "casa",
    texto: (a, b) =>
      `Mamãe comprou ${a} ${pluralizar(a, "tomate", "tomates")} no mercado e usou ${b} no almoço. Quantos tomates sobraram?`,
  },
  {
    contexto: "mercado",
    texto: (a, b) =>
      `A quitanda tinha ${a} ${pluralizar(a, "laranja", "laranjas")} e vendeu ${b}. Quantas laranjas sobraram?`,
  },
];

function gerarSubtracao(nivel) {
  const cfg = NIVEIS_SUBTRACAO[nivel - 1];
  const a = numeroAleatorio(cfg.min, cfg.max);
  const bMin = Math.max(1, Math.round(a * 0.2));
  const bMax = Math.max(bMin, Math.min(a - 1, Math.round(a * 0.8)));
  const b = numeroAleatorio(bMin, bMax);
  const template = escolher(TEMPLATES_SUBTRACAO);
  return montarQuestao({
    enunciado: template.texto(a, b),
    correta: a - b,
    operacao: "subtracao",
    contexto: template.contexto,
  });
}

/* ===================== MÓDULO 3 — MULTIPLICAÇÃO (SELVA) ===================== */

// Produtos por nível: ~4–25, 6–36, 12–64, 24–81, 42–120.
const NIVEIS_MULTIPLICACAO = [
  { minA: 2, maxA: 5, minB: 2, maxB: 5 },
  { minA: 2, maxA: 6, minB: 3, maxB: 6 },
  { minA: 3, maxA: 8, minB: 4, maxB: 8 },
  { minA: 4, maxA: 9, minB: 6, maxB: 9 },
  { minA: 6, maxA: 12, minB: 7, maxB: 10 },
];

const TEMPLATES_MULTIPLICACAO = [
  {
    contexto: "parque",
    texto: (a, b) =>
      `Na selva há ${a} ${pluralizar(a, "cacho de banana", "cachos de banana")} com ${b} ${pluralizar(b, "banana", "bananas")} em cada um. Quantas bananas há ao todo?`,
  },
  {
    contexto: "parque",
    texto: (a, b) =>
      `Há ${a} ${pluralizar(a, "árvore", "árvores")} com ${b} ${pluralizar(b, "macaco", "macacos")} brincando em cada uma. Quantos macacos há ao todo?`,
  },
  {
    contexto: "parque",
    texto: (a, b) =>
      `Vi ${a} ${pluralizar(a, "galho", "galhos")} com ${b} ${pluralizar(b, "tucano", "tucanos")} pousados em cada galho. Quantos tucanos há ao todo?`,
  },
  {
    contexto: "fazenda",
    texto: (a, b) =>
      `Na trilha há ${a} ${pluralizar(a, "poça", "poças")} com ${b} ${pluralizar(b, "sapinho", "sapinhos")} em cada uma. Quantos sapinhos há ao todo?`,
  },
  {
    contexto: "parque",
    texto: (a, b) =>
      `Há ${a} ${pluralizar(a, "arbusto", "arbustos")} com ${b} ${pluralizar(b, "flor", "flores")} em cada um. Quantas flores há ao todo?`,
  },
  {
    contexto: "fazenda",
    texto: (a, b) =>
      `Encontrei ${a} ${pluralizar(a, "ninho", "ninhos")} com ${b} ${pluralizar(b, "passarinho", "passarinhos")} em cada ninho. Quantos passarinhos há ao todo?`,
  },
];

function gerarMultiplicacao(nivel) {
  const cfg = NIVEIS_MULTIPLICACAO[nivel - 1];
  const a = numeroAleatorio(cfg.minA, cfg.maxA);
  const b = numeroAleatorio(cfg.minB, cfg.maxB);
  const template = escolher(TEMPLATES_MULTIPLICACAO);
  return montarQuestao({
    enunciado: template.texto(a, b),
    correta: a * b,
    operacao: "multiplicacao",
    contexto: template.contexto,
  });
}

/* ===================== MÓDULO 4 — DIVISÃO (VALE) ===================== */

// Dividendo = divisor × quociente (divisão exata). Quociente (a resposta)
// cresce de forma suave: ~2–5, 2–6, 3–8, 4–9, 6–12.
const NIVEIS_DIVISAO = [
  { minDiv: 2, maxDiv: 5, minQuo: 2, maxQuo: 5 },
  { minDiv: 2, maxDiv: 6, minQuo: 2, maxQuo: 6 },
  { minDiv: 3, maxDiv: 7, minQuo: 3, maxQuo: 8 },
  { minDiv: 4, maxDiv: 9, minQuo: 4, maxQuo: 9 },
  { minDiv: 5, maxDiv: 10, minQuo: 6, maxQuo: 12 },
];

const TEMPLATES_DIVISAO = [
  {
    contexto: "parque",
    texto: (dividendo, divisor) =>
      `Há ${dividendo} ${pluralizar(dividendo, "maçã", "maçãs")} para dividir igualmente entre ${divisor} ${pluralizar(divisor, "cesta", "cestas")} no piquenique. Quantas maçãs vão em cada cesta?`,
  },
  {
    contexto: "fazenda",
    texto: (dividendo, divisor) =>
      `O fazendeiro colheu ${dividendo} ${pluralizar(dividendo, "ovo", "ovos")} e quer guardá-${pluralizar(dividendo, "lo", "los")} em ${divisor} ${pluralizar(divisor, "caixa", "caixas")}, com a mesma quantidade em cada uma. Quantos ovos vão em cada caixa?`,
  },
  {
    contexto: "parque",
    texto: (dividendo, divisor) =>
      `${dividendo} ${pluralizar(dividendo, "criança", "crianças")} ${
        dividendo === 1 ? "vai" : "vão"
      } se dividir igualmente em ${divisor} ${pluralizar(divisor, "time", "times")} para jogar no campo. Quantas crianças ficam em cada time?`,
  },
  {
    contexto: "fazenda",
    texto: (dividendo, divisor) =>
      `Há ${dividendo} ${pluralizar(dividendo, "cenoura", "cenouras")} para repartir igualmente entre ${divisor} ${pluralizar(divisor, "coelho", "coelhos")}. Quantas cenouras cada coelho vai receber?`,
  },
  {
    contexto: "parque",
    texto: (dividendo, divisor) =>
      `O guia tem ${dividendo} ${pluralizar(dividendo, "lanche", "lanches")} para dividir igualmente entre ${divisor} ${pluralizar(divisor, "barraca", "barracas")}. Quantos lanches vão em cada barraca?`,
  },
];

function gerarDivisao(nivel) {
  const cfg = NIVEIS_DIVISAO[nivel - 1];
  const divisor = numeroAleatorio(cfg.minDiv, cfg.maxDiv);
  const quociente = numeroAleatorio(cfg.minQuo, cfg.maxQuo);
  const dividendo = divisor * quociente;
  const template = escolher(TEMPLATES_DIVISAO);
  return montarQuestao({
    enunciado: template.texto(dividendo, divisor),
    correta: quociente,
    operacao: "divisao",
    contexto: template.contexto,
  });
}

/* ===================== SELETOR POR MÓDULO ===================== */

const GERADORES_POR_MODULO = {
  1: gerarAdicao,
  2: gerarSubtracao,
  3: gerarMultiplicacao,
  4: gerarDivisao,
};

const TOTAL_MODULOS = 4;
const NIVEIS_POR_MODULO = 5;
const TOTAL_FASES = TOTAL_MODULOS * NIVEIS_POR_MODULO;

// modulo: 1 (adição) a 4 (divisão) · nivel: 1 a 5
function gerarQuestao(modulo, nivel) {
  const gerador = GERADORES_POR_MODULO[modulo];
  if (!gerador || nivel < 1 || nivel > 5) return null;
  return gerador(nivel);
}

module.exports = { gerarQuestao, TOTAL_FASES, NIVEIS_POR_MODULO };
