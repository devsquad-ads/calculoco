/**
 * Geração de perguntas contextualizadas para os 4 módulos do Calculoco.
 *
 * Cada módulo (1=adição, 2=subtração, 3=multiplicação, 4=divisão) tem
 * 5 níveis de dificuldade crescente: o nível 1 começa bem simples
 * (números de 1 algarismo) e a dificuldade sobe aos poucos até o nível 5.
 *
 * Cada pergunta também carrega um "contexto" (mercado, escola, fazenda...)
 * para que o frontend possa mostrar um cenário visual condizente com o
 * enunciado.
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

// Concordância singular/plural dos enunciados: quando a quantidade sorteada
// é 1, o substantivo (e o adjetivo/verbo que concorda com ele) precisam ir
// pro singular — "1 figurinha colada", nunca "1 figurinhas coladas".
function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

// Gera 3 distratores plausíveis, com um espalhamento proporcional ao
// tamanho da resposta correta (perguntas com números maiores também
// têm alternativas erradas mais "espalhadas").
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

/* ===================== MÓDULO 1 — ADIÇÃO ===================== */

// Progressão gradual: a soma máxima aproximadamente dobra a cada nível
// (9 → 19 → 35 → 60 → 100), em vez de saltar de números de 1 algarismo
// direto para somas de 2 algarismos com "vai um".
const NIVEIS_ADICAO = [
  { min1: 1, max1: 5, min2: 1, max2: 4 }, // nível 1: 1 algarismo, números baixos
  { min1: 3, max1: 10, min2: 2, max2: 9 },
  { min1: 8, max1: 20, min2: 5, max2: 15 },
  { min1: 15, max1: 35, min2: 10, max2: 25 },
  { min1: 25, max1: 60, min2: 15, max2: 40 },
];

const TEMPLATES_ADICAO = [
  {
    contexto: "casa",
    texto: (a, b) =>
      `Ana tem ${a} ${pluralizar(a, "figurinha colada", "figurinhas coladas")} no álbum. Ela ganhou mais ${b} ${pluralizar(b, "figurinha", "figurinhas")} do avô. Quantas figurinhas Ana tem agora?`,
  },
  {
    contexto: "fazenda",
    texto: (a, b) =>
      `Pedro colheu ${a} ${pluralizar(a, "laranja", "laranjas")} no pomar de manhã e mais ${b} à tarde. Quantas laranjas ele colheu ao todo?`,
  },
  {
    contexto: "escola",
    texto: (a, b) =>
      `Na caixa de lápis da sala há ${a} ${pluralizar(a, "lápis azul", "lápis azuis")} e ${b} ${pluralizar(b, "lápis verde", "lápis verdes")}. Quantos lápis há ao todo na caixa?`,
  },
  {
    contexto: "festa",
    texto: (a, b) =>
      `Lucas já tinha ${a} ${pluralizar(a, "carrinho", "carrinhos")} na estante e ganhou mais ${b} no aniversário. Com quantos carrinhos ele ficou?`,
  },
  {
    contexto: "mercado",
    texto: (a, b) =>
      `Joana tinha ${a} ${pluralizar(a, "bala guardada", "balas guardadas")} e comprou mais ${b} no mercadinho. Quantas balas ela tem agora?`,
  },
  {
    contexto: "aquario",
    texto: (a, b) =>
      `O aquário da escola tinha ${a} ${pluralizar(a, "peixinho", "peixinhos")}. A professora colocou mais ${b} ${pluralizar(b, "peixinho novo", "peixinhos novos")}. Quantos peixinhos há agora?`,
  },
];

function gerarAdicao(nivel) {
  const cfg = NIVEIS_ADICAO[nivel - 1];
  const a = numeroAleatorio(cfg.min1, cfg.max1);
  const b = numeroAleatorio(cfg.min2, cfg.max2);
  const template = escolher(TEMPLATES_ADICAO);
  return montarQuestao({
    enunciado: template.texto(a, b),
    correta: a + b,
    operacao: "adicao",
    contexto: template.contexto,
  });
}

/* ===================== MÓDULO 2 — SUBTRAÇÃO ===================== */

// Progressão gradual do minuendo (o subtraendo continua sorteado entre
// 1 e minuendo-1): 9 → 15 → 25 → 45 → 70.
const NIVEIS_SUBTRACAO = [
  { minA: 3, maxA: 9 }, // nível 1: 1 algarismo, números baixos
  { minA: 6, maxA: 15 },
  { minA: 12, maxA: 25 },
  { minA: 20, maxA: 45 },
  { minA: 35, maxA: 70 },
];

const TEMPLATES_SUBTRACAO = [
  {
    contexto: "mercado",
    texto: (a, b) =>
      `A quitanda tinha ${a} ${pluralizar(a, "maçã", "maçãs")}. ${
        b === 1 ? `Foi vendida ${b} maçã.` : `Foram vendidas ${b} maçãs.`
      } Quantas maçãs sobraram?`,
  },
  {
    contexto: "escola",
    texto: (a, b) =>
      `Na turma havia ${a} ${pluralizar(a, "aluno", "alunos")}. ${
        b === 1 ? `${b} aluno faltou hoje.` : `${b} alunos faltaram hoje.`
      } Quantos alunos vieram à aula?`,
  },
  {
    contexto: "festa",
    texto: (a, b) =>
      `Havia ${a} ${pluralizar(a, "balão solto", "balões soltos")} na festa. ${
        b === 1 ? `${b} balão estourou.` : `${b} balões estouraram.`
      } Quantos balões restaram?`,
  },
  {
    contexto: "fazenda",
    texto: (a, b) =>
      `O galinheiro tinha ${a} ${pluralizar(a, "galinha", "galinhas")}. O fazendeiro vendeu ${b} ${pluralizar(b, "galinha", "galinhas")}. Quantas galinhas restaram?`,
  },
  {
    contexto: "casa",
    texto: (a, b) =>
      `No pote havia ${a} ${pluralizar(a, "biscoito", "biscoitos")}. Rafael comeu ${b} ${pluralizar(b, "biscoito", "biscoitos")}. Quantos biscoitos sobraram no pote?`,
  },
  {
    contexto: "praia",
    texto: (a, b) =>
      `Na praia as crianças fizeram ${a} ${pluralizar(a, "castelo de areia", "castelos de areia")}. A maré levou ${b} ${pluralizar(b, "castelo", "castelos")}. Quantos castelos restaram?`,
  },
];

function gerarSubtracao(nivel) {
  const cfg = NIVEIS_SUBTRACAO[nivel - 1];
  const a = numeroAleatorio(cfg.minA, cfg.maxA);
  const b = numeroAleatorio(1, Math.max(1, a - 1));
  const template = escolher(TEMPLATES_SUBTRACAO);
  return montarQuestao({
    enunciado: template.texto(a, b),
    correta: a - b,
    operacao: "subtracao",
    contexto: template.contexto,
  });
}

/* ===================== MÓDULO 3 — MULTIPLICAÇÃO ===================== */

// Progressão gradual do produto máximo: 25 → 42 → 72 → 90 → 120.
const NIVEIS_MULTIPLICACAO = [
  { minA: 1, maxA: 5, minB: 1, maxB: 5 }, // nível 1: tabuada baixa (1 algarismo)
  { minA: 2, maxA: 7, minB: 2, maxB: 6 },
  { minA: 3, maxA: 9, minB: 3, maxB: 8 },
  { minA: 5, maxA: 10, minB: 4, maxB: 9 },
  { minA: 6, maxA: 12, minB: 5, maxB: 10 },
];

const TEMPLATES_MULTIPLICACAO = [
  {
    contexto: "escola",
    texto: (a, b) =>
      `A sala tem ${a} ${pluralizar(a, "fileira", "fileiras")} de carteiras, com ${b} ${pluralizar(b, "aluno", "alunos")} em cada fileira. Quantos alunos há na sala?`,
  },
  {
    contexto: "mercado",
    texto: (a, b) =>
      `O mercadinho recebeu ${a} ${pluralizar(a, "caixa", "caixas")} com ${b} ${pluralizar(b, "maçã", "maçãs")} em cada uma. Quantas maçãs chegaram ao todo?`,
  },
  {
    contexto: "festa",
    texto: (a, b) =>
      `Na festa há ${a} ${pluralizar(a, "mesa", "mesas")} com ${b} ${pluralizar(b, "convidado", "convidados")} em cada mesa. Quantos convidados há na festa?`,
  },
  {
    contexto: "fazenda",
    texto: (a, b) =>
      `O sítio tem ${a} ${pluralizar(a, "galinheiro", "galinheiros")}, cada um com ${b} ${pluralizar(b, "galinha", "galinhas")}. Quantas galinhas há no sítio ao todo?`,
  },
  {
    contexto: "parque",
    texto: (a, b) =>
      `No parque há ${a} ${pluralizar(a, "banco", "bancos")}, cada um com ${b} ${pluralizar(b, "criança sentada", "crianças sentadas")}. Quantas crianças há ao todo?`,
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

/* ===================== MÓDULO 4 — DIVISÃO ===================== */

// Progressão gradual do dividendo máximo: 25 → 36 → 72 → 90 → 120,
// espelhando a curva da multiplicação (sua operação inversa).
const NIVEIS_DIVISAO = [
  { minDiv: 1, maxDiv: 5, minQuo: 1, maxQuo: 5 }, // nível 1: divisões simples
  { minDiv: 2, maxDiv: 6, minQuo: 2, maxQuo: 6 },
  { minDiv: 2, maxDiv: 8, minQuo: 3, maxQuo: 9 },
  { minDiv: 3, maxDiv: 9, minQuo: 5, maxQuo: 10 },
  { minDiv: 4, maxDiv: 10, minQuo: 6, maxQuo: 12 },
];

const TEMPLATES_DIVISAO = [
  {
    contexto: "escola",
    texto: (dividendo, divisor) =>
      `A professora tem ${dividendo} ${pluralizar(dividendo, "figurinha", "figurinhas")} para dividir igualmente entre ${divisor} ${pluralizar(divisor, "aluno", "alunos")}. Quantas figurinhas cada aluno vai receber?`,
  },
  {
    contexto: "festa",
    texto: (dividendo, divisor) =>
      `Há ${dividendo} ${pluralizar(dividendo, "bala", "balas")} para dividir igualmente entre ${divisor} ${pluralizar(divisor, "criança", "crianças")} na festa. Quantas balas cada criança vai ganhar?`,
  },
  {
    contexto: "mercado",
    texto: (dividendo, divisor) =>
      `O feirante tem ${dividendo} ${pluralizar(dividendo, "laranja", "laranjas")} para colocar em ${divisor} ${pluralizar(divisor, "sacola", "sacolas")}, com a mesma quantidade em cada uma. Quantas laranjas vão em cada sacola?`,
  },
  {
    contexto: "fazenda",
    texto: (dividendo, divisor) =>
      `O fazendeiro colheu ${dividendo} ${pluralizar(dividendo, "ovo", "ovos")} e quer guardá-${pluralizar(dividendo, "lo", "los")} em ${divisor} ${pluralizar(divisor, "caixa", "caixas")}, com a mesma quantidade em cada uma. Quantos ovos vão em cada caixa?`,
  },
  {
    contexto: "parque",
    texto: (dividendo, divisor) =>
      `No parque, ${dividendo} ${pluralizar(dividendo, "criança", "crianças")} ${
        dividendo === 1 ? "vai" : "vão"
      } se dividir igualmente em ${divisor} ${pluralizar(divisor, "time", "times")} para jogar. Quantas crianças ficam em cada time?`,
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

// 4 módulos x 5 níveis cada = 20 fases jogáveis ao todo.
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
