/* ===================== CONFIGURAÇÃO E ESTADO ===================== */

const API_URL = "/api";
const CHAVE_ALUNO = "calculoco_aluno";

// Os 4 módulos do jogo (1 para cada operação). Cada módulo tem 5 níveis
// de dificuldade crescente (fase_numero global = (modulo-1)*5 + nivel).
const MODULOS = [
  { numero: 1, titulo: "Ilha da Adição", icone: "➕", cor: "var(--amarelo)", operacao: "Adição" },
  { numero: 2, titulo: "Mercado da Subtração", icone: "➖", cor: "var(--rosa)", operacao: "Subtração" },
  { numero: 3, titulo: "Selva da Multiplicação", icone: "✖️", cor: "var(--verde)", operacao: "Multiplicação" },
  { numero: 4, titulo: "Vale da Divisão", icone: "➗", cor: "var(--azul-ceu)", operacao: "Divisão" },
];

// Emojis de cenário usados como decoração de fundo, escolhidos de acordo
// com o "contexto" que o backend devolve junto com cada pergunta.
const CENARIOS = {
  casa: ["🏠", "🛋️", "🪴", "🖼️"],
  fazenda: ["🚜", "🐔", "🌾", "🐷"],
  escola: ["📚", "✏️", "🎒", "🖍️"],
  festa: ["🎈", "🎉", "🎂", "🎊"],
  mercado: ["🛒", "🍎", "🍌", "🧺"],
  aquario: ["🐠", "🐟", "🫧", "🪸"],
  parque: ["🌳", "⚽", "🌼", "🦋"],
  praia: ["🏖️", "🌊", "🐚", "☀️"],
};

const estado = {
  turma: null, // { id, codigo, nome_turma, nome_professor }
  aluno: null, // { id, nome_usuario, turma_id }
  progresso: [], // [{ fase_numero, concluida, acertos, erros }]
  fase: {
    numero: null,
    modulo: null,
    nivel: null,
    questionToken: null,
    respondida: false,
    acertosSessao: 0,
    errosSessao: 0,
  },
};

/* ===================== HELPERS DE API ===================== */

async function chamarApi(caminho, opcoes = {}) {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || "Ocorreu um erro inesperado.");
  }
  return dados;
}

/* ===================== NAVEGAÇÃO ENTRE TELAS ===================== */

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");
}

let toastTimer;
function mostrarToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("mostrar");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("mostrar"), 2800);
}

/* ===================== TELA 1: CÓDIGO DA TURMA ===================== */

const formTurma = document.getElementById("form-turma");
const campoCodigoTurma = document.getElementById("campo-codigo-turma");
const avisoTurma = document.getElementById("aviso-turma");

formTurma.addEventListener("submit", async (e) => {
  e.preventDefault();
  avisoTurma.textContent = "";
  const codigo = campoCodigoTurma.value.trim();

  if (!/^\d{4}$/.test(codigo)) {
    avisoTurma.textContent = "Digite os 4 números do código da turma.";
    return;
  }

  try {
    const turma = await chamarApi(`/turmas/${codigo}`);
    estado.turma = turma;
    prepararTelaAuth();
    mostrarTela("tela-auth");
  } catch (erro) {
    avisoTurma.textContent = erro.message;
  }
});

const formNovaTurma = document.getElementById("form-nova-turma");
const avisoNovaTurma = document.getElementById("aviso-nova-turma");

formNovaTurma.addEventListener("submit", async (e) => {
  e.preventDefault();
  avisoNovaTurma.textContent = "";
  const nome_turma = document.getElementById("campo-nome-turma").value.trim();
  const nome_professor = document.getElementById("campo-nome-professor").value.trim();

  try {
    const turma = await chamarApi("/turmas", {
      method: "POST",
      body: JSON.stringify({ nome_turma, nome_professor }),
    });
    avisoNovaTurma.textContent = `Turma criada! Código: ${turma.codigo}`;
    avisoNovaTurma.style.color = "var(--verde-escuro)";
    formNovaTurma.reset();
  } catch (erro) {
    avisoNovaTurma.style.color = "var(--rosa)";
    avisoNovaTurma.textContent = erro.message;
  }
});

/* ===================== TELA 2: LOGIN / CADASTRO ===================== */

const tituloAuth = document.getElementById("titulo-auth");
const subAuth = document.getElementById("sub-auth");
const abaEntrar = document.getElementById("aba-entrar");
const abaCriar = document.getElementById("aba-criar");
const formAuth = document.getElementById("form-auth");
const campoUsuario = document.getElementById("campo-usuario");
const campoPin = document.getElementById("campo-pin");
const btnConfirmarAuth = document.getElementById("btn-confirmar-auth");
const avisoAuth = document.getElementById("aviso-auth");

let modoAuth = "entrar";

function prepararTelaAuth() {
  tituloAuth.textContent = `Turma: ${estado.turma.nome_turma}`;
  subAuth.textContent = "Entre com seu usuário ou crie uma conta nova";
  formAuth.reset();
  avisoAuth.textContent = "";
  definirModoAuth("entrar");
}

function definirModoAuth(modo) {
  modoAuth = modo;
  abaEntrar.classList.toggle("ativa", modo === "entrar");
  abaCriar.classList.toggle("ativa", modo === "criar");
  btnConfirmarAuth.textContent = modo === "entrar" ? "🐒 Entrar" : "🐒 Criar minha conta";
  avisoAuth.textContent = "";
}

abaEntrar.addEventListener("click", () => definirModoAuth("entrar"));
abaCriar.addEventListener("click", () => definirModoAuth("criar"));

document.getElementById("btn-trocar-turma").addEventListener("click", () => {
  estado.turma = null;
  campoCodigoTurma.value = "";
  mostrarTela("tela-turma");
});

formAuth.addEventListener("submit", async (e) => {
  e.preventDefault();
  avisoAuth.textContent = "";

  const nome_usuario = campoUsuario.value.trim();
  const pin = campoPin.value.trim();

  if (!/^\d{4}$/.test(pin)) {
    avisoAuth.textContent = "O PIN deve ter exatamente 4 números.";
    return;
  }

  const caminho = modoAuth === "entrar" ? "/auth/login" : "/auth/cadastro";

  try {
    const resultado = await chamarApi(caminho, {
      method: "POST",
      body: JSON.stringify({ codigo_turma: estado.turma.codigo, nome_usuario, pin }),
    });
    definirAlunoLogado(resultado.aluno);
    await entrarNoMenu();
  } catch (erro) {
    avisoAuth.textContent = erro.message;
  }
});

function definirAlunoLogado(aluno) {
  estado.aluno = aluno;
  localStorage.setItem(CHAVE_ALUNO, JSON.stringify({ ...aluno, turma_codigo: estado.turma?.codigo }));
}

document.getElementById("btn-sair").addEventListener("click", () => {
  localStorage.removeItem(CHAVE_ALUNO);
  estado.aluno = null;
  estado.turma = null;
  estado.progresso = [];
  campoCodigoTurma.value = "";
  mostrarTela("tela-turma");
});

/* ===================== TELA 3: MENU DE MÓDULOS E NÍVEIS ===================== */

const saudacao = document.getElementById("saudacao");
const gradeFases = document.getElementById("grade-fases");

async function entrarNoMenu() {
  saudacao.textContent = `Olá, ${estado.aluno.nome_usuario}! 👋`;
  await carregarProgresso();
  renderizarGradeFases();
  mostrarTela("tela-menu");
}

async function carregarProgresso() {
  try {
    const resultado = await chamarApi(`/progresso/${estado.aluno.id}`);
    estado.progresso = resultado.progresso || [];
  } catch {
    estado.progresso = [];
  }
}

function faseConcluida(numero) {
  return estado.progresso.some((p) => p.fase_numero === numero && p.concluida);
}

function faseDesbloqueada(numero) {
  if (numero === 1) return true;
  return faseConcluida(numero - 1);
}

function renderizarGradeFases() {
  gradeFases.innerHTML = "";

  MODULOS.forEach((modulo) => {
    const primeiraFase = (modulo.numero - 1) * 5 + 1;
    const moduloDesbloqueado = faseDesbloqueada(primeiraFase);

    const cartao = document.createElement("div");
    cartao.className = "cartao-modulo";
    if (!moduloDesbloqueado) cartao.classList.add("bloqueado");
    cartao.style.setProperty("--cor-modulo", modulo.cor);

    const niveisHtml = [1, 2, 3, 4, 5]
      .map((nivel) => {
        const fase = primeiraFase + nivel - 1;
        const desbloqueada = faseDesbloqueada(fase);
        const concluida = faseConcluida(fase);
        let classe = "nivel-btn";
        if (!desbloqueada) classe += " bloqueado";
        else if (concluida) classe += " concluido";
        const conteudo = !desbloqueada ? "🔒" : concluida ? "✅" : nivel;
        return `<button type="button" class="${classe}" data-fase="${fase}" ${
          !desbloqueada ? "disabled" : ""
        } aria-label="Nível ${nivel}">${conteudo}</button>`;
      })
      .join("");

    cartao.innerHTML = `
      <div class="cabecalho-modulo">
        <span class="bolha-modulo">${moduloDesbloqueado ? modulo.icone : "🔒"}</span>
        <div>
          <div class="nome-modulo">${modulo.titulo}</div>
          <div class="operacao-modulo">${modulo.operacao}</div>
        </div>
      </div>
      <div class="niveis-modulo">${niveisHtml}</div>
    `;

    cartao.querySelectorAll(".nivel-btn").forEach((botao) => {
      botao.addEventListener("click", () => {
        if (botao.disabled) {
          mostrarToast("Complete o nível anterior para desbloquear este 🔓");
          return;
        }
        abrirFase(Number(botao.dataset.fase));
      });
    });

    gradeFases.appendChild(cartao);
  });
}

document.getElementById("btn-voltar-menu").addEventListener("click", () => {
  mostrarTela("tela-menu");
});

/* ===================== TELA 4: JOGO ===================== */

const areaJogo = document.getElementById("area-jogo");
const cenarioDecor = document.getElementById("cenario-decor");
const pillFase = document.getElementById("pill-fase");
const textoEnunciado = document.getElementById("texto-enunciado");
const opcoesResposta = document.getElementById("opcoes-resposta");
const textoFeedback = document.getElementById("texto-feedback");
const btnContinuarJogo = document.getElementById("btn-continuar-jogo");
const btnTentarNovamente = document.getElementById("btn-tentar-novamente");

function aplicarCenario(contexto) {
  const temaAnterior = [...areaJogo.classList].find((c) => c.startsWith("tema-"));
  if (temaAnterior) areaJogo.classList.remove(temaAnterior);
  areaJogo.classList.add(`tema-${contexto || "casa"}`);

  const emojis = CENARIOS[contexto] || CENARIOS.casa;
  cenarioDecor.innerHTML = emojis
    .map((emoji, indice) => `<span class="decor decor-${indice + 1}">${emoji}</span>`)
    .join("");
}

async function abrirFase(numeroFase) {
  const modulo = MODULOS.find(
    (m) => numeroFase > (m.numero - 1) * 5 && numeroFase <= m.numero * 5
  );
  const nivel = numeroFase - (modulo.numero - 1) * 5;

  estado.fase = {
    numero: numeroFase,
    modulo,
    nivel,
    questionToken: null,
    respondida: false,
    acertosSessao: 0,
    errosSessao: 0,
  };

  mostrarTela("tela-jogo");
  pillFase.textContent = `${modulo.operacao} · Nível ${nivel} de 5`;
  await carregarPergunta();
}

async function carregarPergunta() {
  textoEnunciado.textContent = "Carregando pergunta...";
  opcoesResposta.innerHTML = "";
  textoFeedback.textContent = "";
  textoFeedback.className = "feedback";
  btnContinuarJogo.classList.add("oculto");
  btnTentarNovamente.classList.add("oculto");
  estado.fase.respondida = false;

  try {
    const questao = await chamarApi(`/fases/${estado.fase.numero}/questao`);
    estado.fase.questionToken = questao.questionToken;
    textoEnunciado.textContent = questao.enunciado;
    aplicarCenario(questao.contexto);
    renderizarOpcoes(questao.opcoes);
  } catch (erro) {
    textoEnunciado.textContent = erro.message;
  }
}

function renderizarOpcoes(opcoes) {
  opcoesResposta.innerHTML = "";
  opcoes.forEach((valor, indice) => {
    const botao = document.createElement("button");
    botao.className = "btn-opcao";
    botao.textContent = valor;
    botao.dataset.indice = String(indice);
    botao.addEventListener("click", () => responder(indice, botao));
    opcoesResposta.appendChild(botao);
  });
}

async function responder(indiceEscolhido, botaoClicado) {
  if (estado.fase.respondida) return;
  estado.fase.respondida = true;

  document.querySelectorAll(".btn-opcao").forEach((b) => (b.disabled = true));

  try {
    const resultado = await chamarApi(`/fases/${estado.fase.numero}/verificar`, {
      method: "POST",
      body: JSON.stringify({ questionToken: estado.fase.questionToken, resposta: indiceEscolhido }),
    });

    const botoes = document.querySelectorAll(".btn-opcao");
    botoes[resultado.correctIndex].classList.add("correta");

    if (resultado.correta) {
      textoFeedback.textContent = "🎉 Muito bem, você acertou!";
      textoFeedback.className = "feedback ok";
      estado.fase.acertosSessao += 1;
      await salvarProgressoFase(true);
      btnContinuarJogo.classList.remove("oculto");
    } else {
      botaoClicado.classList.add("errada");
      textoFeedback.textContent = "😅 Não foi dessa vez, tente novamente!";
      textoFeedback.className = "feedback erro";
      estado.fase.errosSessao += 1;
      await salvarProgressoFase(false);
      btnTentarNovamente.classList.remove("oculto");
    }
  } catch (erro) {
    textoFeedback.textContent = erro.message;
    textoFeedback.className = "feedback erro";
    btnTentarNovamente.classList.remove("oculto");
  }
}

async function salvarProgressoFase(concluida) {
  try {
    await chamarApi("/progresso", {
      method: "POST",
      body: JSON.stringify({
        aluno_id: estado.aluno.id,
        fase_numero: estado.fase.numero,
        concluida,
        acertos: estado.fase.acertosSessao,
        erros: estado.fase.errosSessao,
      }),
    });
    await carregarProgresso();
  } catch {
    // Falha silenciosa: o aluno ainda vê o feedback na tela mesmo
    // que a gravação do progresso tenha falhado temporariamente.
  }
}

btnTentarNovamente.addEventListener("click", carregarPergunta);
btnContinuarJogo.addEventListener("click", async () => {
  renderizarGradeFases();
  mostrarTela("tela-menu");
});

/* ===================== INICIALIZAÇÃO ===================== */

(async function iniciar() {
  const salvo = localStorage.getItem(CHAVE_ALUNO);
  if (!salvo) {
    mostrarTela("tela-turma");
    return;
  }

  try {
    const aluno = JSON.parse(salvo);
    const turma = await chamarApi(`/turmas/${aluno.turma_codigo}`);
    estado.turma = turma;
    estado.aluno = { id: aluno.id, nome_usuario: aluno.nome_usuario, turma_id: aluno.turma_id };
    await entrarNoMenu();
  } catch {
    localStorage.removeItem(CHAVE_ALUNO);
    mostrarTela("tela-turma");
  }
})();
