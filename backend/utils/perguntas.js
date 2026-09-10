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

const NIVEIS_ADICAO = [
  { min1: 1, max1: 5, min2: 1, max2: 4 }, // nível 1: 1 algarismo, números baixos
  { min1: 1, max1: 9, min2: 1, max2: 9 },
  { min1: 10, max1: 30, min2: 5, max2: 20 },
  { min1: 20, max1: 60, min2: 10, max2: 40 },
  { min1: 30, max1: 99, min2: 20, max2: 70 },
];

const TEMPLATES_ADICAO = [
  { contexto: "casa", texto: (a, b) => `Ana tem ${a} figurinhas coladas no álbum. Ela ganhou mais ${b} figurinhas do avô. Quantas figurinhas Ana tem agora?` },
  { contexto: "fazenda", texto: (a, b) => `Pedro colheu ${a} laranjas no pomar de manhã e mais ${b} à tarde. Quantas laranjas ele colheu ao todo?` },
  { contexto: "escola", texto: (a, b) => `Na caixa de lápis da sala há ${a} lápis azuis e ${b} lápis verdes. Quantos lápis há ao todo na caixa?` },
  { contexto: "festa", texto: (a, b) => `Lucas já tinha ${a} carrinhos na estante e ganhou mais ${b} no aniversário. Com quantos carrinhos ele ficou?` },
  { contexto: "mercado", texto: (a, b) => `Joana tinha ${a} balas guardadas e comprou mais ${b} no mercadinho. Quantas balas ela tem agora?` },
  { contexto: "aquario", texto: (a, b) => `O aquário da escola tinha ${a} peixinhos. A professora colocou mais ${b} peixinhos novos. Quantos peixinhos há agora?` },
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

const NIVEIS_SUBTRACAO = [
  { minA: 3, maxA: 9 }, // nível 1: 1 algarismo, números baixos
  { minA: 10, maxA: 20 },
  { minA: 20, maxA: 40 },
  { minA: 40, maxA: 70 },
  { minA: 60, maxA: 99 },
];

const TEMPLATES_SUBTRACAO = [
  { contexto: "mercado", texto: (a, b) => `A quitanda tinha ${a} maçãs. Foram vendidas ${b} maçãs. Quantas maçãs sobraram?` },
  { contexto: "escola", texto: (a, b) => `Na turma havia ${a} alunos. ${b} alunos faltaram hoje. Quantos alunos vieram à aula?` },
  { contexto: "festa", texto: (a, b) => `Havia ${a} balões soltos na festa. ${b} balões estouraram. Quantos balões restaram?` },
  { contexto: "fazenda", texto: (a, b) => `O galinheiro tinha ${a} galinhas. O fazendeiro vendeu ${b} galinhas. Quantas galinhas restaram?` },
  { contexto: "casa", texto: (a, b) => `No pote havia ${a} biscoitos. Rafael comeu ${b} biscoitos. Quantos biscoitos sobraram no pote?` },
  { contexto: "praia", texto: (a, b) => `Na praia as crianças fizeram ${a} castelos de areia. A maré levou ${b} castelos. Quantos castelos restaram?` },
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

const NIVEIS_MULTIPLICACAO = [
  { minA: 1, maxA: 5, minB: 1, maxB: 5 }, // nível 1: tabuada baixa (1 algarismo)
  { minA: 2, maxA: 9, minB: 2, maxB: 9 },
  { minA: 5, maxA: 12, minB: 2, maxB: 9 },
  { minA: 10, maxA: 15, minB: 5, maxB: 9 },
  { minA: 10, maxA: 20, minB: 6, maxB: 12 },
];

const TEMPLATES_MULTIPLICACAO = [
  { contexto: "escola", texto: (a, b) => `A sala tem ${a} fileiras de carteiras, com ${b} alunos em cada fileira. Quantos alunos há na sala?` },
  { contexto: "mercado", texto: (a, b) => `O mercadinho recebeu ${a} caixas com ${b} maçãs em cada uma. Quantas maçãs chegaram ao todo?` },
  { contexto: "festa", texto: (a, b) => `Na festa há ${a} mesas com ${b} convidados em cada mesa. Quantos convidados há na festa?` },
  { contexto: "fazenda", texto: (a, b) => `O sítio tem ${a} galinheiros, cada um com ${b} galinhas. Quantas galinhas há no sítio ao todo?` },
  { contexto: "parque", texto: (a, b) => `No parque há ${a} bancos, cada um com ${b} crianças sentadas. Quantas crianças há ao todo?` },
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

const NIVEIS_DIVISAO = [
  { minDiv: 1, maxDiv: 5, minQuo: 1, maxQuo: 5 }, // nível 1: divisões simples
  { minDiv: 2, maxDiv: 9, minQuo: 2, maxQuo: 9 },
  { minDiv: 2, maxDiv: 9, minQuo: 5, maxQuo: 12 },
  { minDiv: 2, maxDiv: 12, minQuo: 5, maxQuo: 15 },
  { minDiv: 2, maxDiv: 12, minQuo: 10, maxQuo: 20 },
];

const TEMPLATES_DIVISAO = [
  { contexto: "escola", texto: (dividendo, divisor) => `A professora tem ${dividendo} figurinhas para dividir igualmente entre ${divisor} alunos. Quantas figurinhas cada aluno vai receber?` },
  { contexto: "festa", texto: (dividendo, divisor) => `Há ${dividendo} balas para dividir igualmente entre ${divisor} crianças na festa. Quantas balas cada criança vai ganhar?` },
  { contexto: "mercado", texto: (dividendo, divisor) => `O feirante tem ${dividendo} laranjas para colocar em ${divisor} sacolas, com a mesma quantidade em cada uma. Quantas laranjas vão em cada sacola?` },
  { contexto: "fazenda", texto: (dividendo, divisor) => `O fazendeiro colheu ${dividendo} ovos e quer guardá-los em ${divisor} caixas, todas com a mesma quantidade. Quantos ovos vão em cada caixa?` },
  { contexto: "parque", texto: (dividendo, divisor) => `No parque, ${dividendo} crianças vão se dividir igualmente em ${divisor} times para jogar. Quantas crianças ficam em cada time?` },
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
