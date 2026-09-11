/* ===================== CONFIGURAÇÃO E ESTADO ===================== */

const API_URL = "/api";
const CHAVE_ALUNO = "calculoco_aluno";
const CHAVE_PROFESSOR = "calculoco_professor";

// Os 4 módulos do jogo (1 para cada operação). Cada módulo tem 5 níveis
// de dificuldade crescente (fase_numero global = (modulo-1)*5 + nivel).
const MODULOS = [
  { numero: 1, titulo: "Ilha da Adição", icone: "+", cor: "var(--amarelo)", operacao: "Adição" },
  { numero: 2, titulo: "Mercado da Subtração", icone: "−", cor: "var(--rosa)", operacao: "Subtração" },
  { numero: 3, titulo: "Selva da Multiplicação", icone: "×", cor: "var(--verde)", operacao: "Multiplicação" },
  { numero: 4, titulo: "Vale da Divisão", icone: "÷", cor: "var(--azul-ceu)", operacao: "Divisão" },
];

// Contextos de cenário reconhecidos: cada um tem um ícone de linha próprio
// (definido em index.html, símbolo "icone-<contexto>") usado como decoração
// de fundo na tela de jogo, escolhido conforme o "contexto" que o backend
// devolve junto com cada pergunta.
const CONTEXTOS_VALIDOS = [
  "casa", "fazenda", "escola", "festa", "mercado", "aquario", "parque", "praia",
];

// Pontuação por tentativa até acertar: quanto antes o aluno acerta, mais
// pontos ganha na fase. Da 4ª tentativa em diante não pontua mais.
const PONTOS_POR_TENTATIVA = [20, 10, 5];

function calcularPontos(tentativa) {
  return PONTOS_POR_TENTATIVA[tentativa - 1] || 0;
}

// Marcação reutilizada em qualquer lugar que mostre pontuação (feedback do
// jogo, dashboard do professor): número + ícone de estrela, no lugar de
// só um número solto.
function pontosComEstrela(pontos) {
  return `<span class="badge-pontos">${pontos} <img class="icone-estrela" src="img/estrela.png" alt="pontos"></span>`;
}

const estado = {
  turma: null, // { id, codigo, nome_turma, nome_professor }
  aluno: null, // { id, nome_usuario, turma_id }
  progresso: [], // [{ fase_numero, concluida, pontos }]
  professor: null, // { id, usuario, nome }
  turmasProfessor: [], // [{ id, codigo, nome_turma, total_alunos, criado_em }]
  fase: {
    numero: null,
    modulo: null,
    nivel: null,
    questionToken: null,
    respondida: false,
    tentativas: 0,
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

document.getElementById("btn-ir-professor").addEventListener("click", () => {
  prepararTelaProfessorAuth();
  mostrarTela("tela-professor-auth");
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
  btnConfirmarAuth.textContent = modo === "entrar" ? "Entrar" : "Criar minha conta";
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

/* ===================== ÁREA DO PROFESSOR ===================== */

const tituloProfessorAuth = document.querySelector("#tela-professor-auth h1");
const subProfessorAuth = document.querySelector("#tela-professor-auth .sub");
const profAbaEntrar = document.getElementById("prof-aba-entrar");
const profAbaCriar = document.getElementById("prof-aba-criar");
const formProfessorAuth = document.getElementById("form-professor-auth");
const profCampoNome = document.getElementById("prof-campo-nome");
const profCampoUsuario = document.getElementById("prof-campo-usuario");
const profCampoSenha = document.getElementById("prof-campo-senha");
const profBtnConfirmar = document.getElementById("prof-btn-confirmar");
const profAvisoAuth = document.getElementById("prof-aviso-auth");

let modoProfessorAuth = "entrar";

function prepararTelaProfessorAuth() {
  formProfessorAuth.reset();
  profAvisoAuth.textContent = "";
  definirModoProfessorAuth("entrar");
}

function definirModoProfessorAuth(modo) {
  modoProfessorAuth = modo;
  profAbaEntrar.classList.toggle("ativa", modo === "entrar");
  profAbaCriar.classList.toggle("ativa", modo === "criar");
  profCampoNome.classList.toggle("oculto", modo !== "criar");
  profBtnConfirmar.textContent = modo === "entrar" ? "Entrar" : "Criar minha conta";
  profAvisoAuth.textContent = "";
}

profAbaEntrar.addEventListener("click", () => definirModoProfessorAuth("entrar"));
profAbaCriar.addEventListener("click", () => definirModoProfessorAuth("criar"));

document.getElementById("btn-voltar-tela-turma").addEventListener("click", () => {
  mostrarTela("tela-turma");
});

formProfessorAuth.addEventListener("submit", async (e) => {
  e.preventDefault();
  profAvisoAuth.textContent = "";

  const usuario = profCampoUsuario.value.trim();
  const senha = profCampoSenha.value;
  const nome = profCampoNome.value.trim();

  if (modoProfessorAuth === "criar" && !nome) {
    profAvisoAuth.textContent = "Informe seu nome completo.";
    return;
  }

  const caminho = modoProfessorAuth === "entrar" ? "/professores/login" : "/professores/cadastro";
  const corpo =
    modoProfessorAuth === "entrar" ? { usuario, senha } : { usuario, senha, nome };

  try {
    const resultado = await chamarApi(caminho, {
      method: "POST",
      body: JSON.stringify(corpo),
    });
    definirProfessorLogado(resultado.professor);
    await entrarAreaProfessor();
  } catch (erro) {
    profAvisoAuth.textContent = erro.message;
  }
});

function definirProfessorLogado(professor) {
  estado.professor = professor;
  localStorage.setItem(CHAVE_PROFESSOR, JSON.stringify(professor));
}

document.getElementById("prof-btn-sair").addEventListener("click", () => {
  localStorage.removeItem(CHAVE_PROFESSOR);
  estado.professor = null;
  estado.turmasProfessor = [];
  mostrarTela("tela-turma");
});

const profSaudacao = document.getElementById("prof-saudacao");
const listaTurmas = document.getElementById("lista-turmas");

async function entrarAreaProfessor() {
  profSaudacao.textContent = `Olá, ${estado.professor.nome}!`;
  avisoNovaTurma.textContent = "";
  formNovaTurma.reset();
  await carregarTurmasProfessor();
  renderizarListaTurmas();
  mostrarTela("tela-professor-turmas");
}

async function carregarTurmasProfessor() {
  try {
    const resultado = await chamarApi(`/professores/${estado.professor.id}/turmas`);
    estado.turmasProfessor = resultado.turmas || [];
  } catch {
    estado.turmasProfessor = [];
  }
}

function renderizarListaTurmas() {
  listaTurmas.innerHTML = "";

  if (estado.turmasProfessor.length === 0) {
    listaTurmas.innerHTML =
      '<p class="aviso-turmas-vazio">Você ainda não criou nenhuma turma. Use o formulário acima para criar a primeira!</p>';
    return;
  }

  estado.turmasProfessor.forEach((turma) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "cartao-turma";
    card.innerHTML = `
      <div class="nome-turma">${turma.nome_turma}</div>
      <span class="codigo-turma">Código: ${turma.codigo}</span>
      <div class="total-alunos">${turma.total_alunos} aluno${turma.total_alunos === 1 ? "" : "s"}</div>
    `;
    card.addEventListener("click", () => abrirDashboardTurma(turma));
    listaTurmas.appendChild(card);
  });
}

formNovaTurma.addEventListener("submit", async (e) => {
  e.preventDefault();
  avisoNovaTurma.textContent = "";
  const nome_turma = document.getElementById("campo-nome-turma").value.trim();

  try {
    const turma = await chamarApi("/turmas", {
      method: "POST",
      body: JSON.stringify({ nome_turma, professor_id: estado.professor.id }),
    });
    avisoNovaTurma.style.color = "var(--verde-escuro)";
    avisoNovaTurma.textContent = `Turma criada! Código: ${turma.codigo}`;
    formNovaTurma.reset();
    await carregarTurmasProfessor();
    renderizarListaTurmas();
  } catch (erro) {
    avisoNovaTurma.style.color = "var(--rosa)";
    avisoNovaTurma.textContent = erro.message;
  }
});

document.getElementById("btn-voltar-turmas").addEventListener("click", async () => {
  await carregarTurmasProfessor();
  renderizarListaTurmas();
  mostrarTela("tela-professor-turmas");
});

const dashNomeTurma = document.getElementById("dash-nome-turma");
const dashCodigoTurma = document.getElementById("dash-codigo-turma");
const corpoTabelaDesempenho = document.getElementById("corpo-tabela-desempenho");
const tabelaDesempenho = document.getElementById("tabela-desempenho");
const dashVazio = document.getElementById("dash-vazio");

async function abrirDashboardTurma(turma) {
  dashNomeTurma.textContent = turma.nome_turma;
  dashCodigoTurma.textContent = `Código: ${turma.codigo}`;
  corpoTabelaDesempenho.innerHTML = "";
  tabelaDesempenho.classList.remove("oculto");
  dashVazio.classList.add("oculto");
  mostrarTela("tela-professor-dashboard");

  try {
    const resultado = await chamarApi(
      `/turmas/${turma.id}/desempenho?professor_id=${estado.professor.id}`
    );
    renderizarDesempenho(resultado.alunos || []);
  } catch (erro) {
    tabelaDesempenho.classList.add("oculto");
    dashVazio.classList.remove("oculto");
    dashVazio.textContent = erro.message;
  }
}

function renderizarDesempenho(alunos) {
  if (alunos.length === 0) {
    tabelaDesempenho.classList.add("oculto");
    dashVazio.classList.remove("oculto");
    dashVazio.textContent = "Ainda não há alunos cadastrados nesta turma.";
    return;
  }

  corpoTabelaDesempenho.innerHTML = alunos
    .map((aluno) => {
      const percentualProgresso = Math.round((aluno.fases_concluidas / aluno.total_fases) * 100);

      return `
        <tr>
          <td>${aluno.nome_usuario}</td>
          <td>
            <div class="barra-progresso-wrap">
              <div class="barra-progresso">
                <div class="barra-progresso-preenchida" style="width:${percentualProgresso}%"></div>
              </div>
              <span class="barra-progresso-texto">${aluno.fases_concluidas}/${aluno.total_fases}</span>
            </div>
          </td>
          <td>${pontosComEstrela(aluno.pontuacao_total)}</td>
        </tr>
      `;
    })
    .join("");
}

/* ===================== TELA 3: MENU DE MÓDULOS E NÍVEIS ===================== */

const saudacao = document.getElementById("saudacao");
const gradeFases = document.getElementById("grade-fases");

async function entrarNoMenu() {
  saudacao.textContent = `Olá, ${estado.aluno.nome_usuario}!`;
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
        const conteudo = !desbloqueada
          ? '<svg class="icone-inline"><use href="#icone-lock"></use></svg>'
          : concluida
          ? '<svg class="icone-inline"><use href="#icone-check"></use></svg>'
          : nivel;
        return `<button type="button" class="${classe}" data-fase="${fase}" ${
          !desbloqueada ? "disabled" : ""
        } aria-label="Nível ${nivel}">${conteudo}</button>`;
      })
      .join("");

    const iconeModulo = moduloDesbloqueado
      ? modulo.icone
      : '<svg class="icone-inline"><use href="#icone-lock"></use></svg>';

    cartao.innerHTML = `
      <div class="cabecalho-modulo">
        <span class="bolha-modulo">${iconeModulo}</span>
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
          mostrarToast("Complete o nível anterior para desbloquear este nível.");
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
const imgMascote = document.getElementById("img-mascote");
const pillFase = document.getElementById("pill-fase");

// Fotos do mascote (sempre o mesmo personagem, em poses diferentes), sorteadas
// a cada pergunta para dar a impressão de que ele está "vivo" enquanto fala.
const FOTOS_MASCOTE = [
  "img/mascote/1.jpeg",
  "img/mascote/2.jpeg",
  "img/mascote/3.jpeg",
  "img/mascote/4.jpeg",
];

function sortearPoseMascote() {
  const indice = Math.floor(Math.random() * FOTOS_MASCOTE.length);
  imgMascote.src = FOTOS_MASCOTE[indice];
}
const textoEnunciado = document.getElementById("texto-enunciado");
const opcoesResposta = document.getElementById("opcoes-resposta");
const textoFeedback = document.getElementById("texto-feedback");
const btnContinuarJogo = document.getElementById("btn-continuar-jogo");
const btnTentarNovamente = document.getElementById("btn-tentar-novamente");
const confeteContainer = document.getElementById("confete-container");

/* ===================== CONFETE E SOM DE COMEMORAÇÃO ===================== */

const CORES_CONFETE = [
  "var(--amarelo)", "var(--laranja)", "var(--rosa)",
  "var(--verde)", "var(--azul-ceu)", "var(--roxo)",
];

function dispararConfete() {
  if (!confeteContainer) return;

  const quantidade = 55;
  for (let i = 0; i < quantidade; i++) {
    const pedaco = document.createElement("span");
    pedaco.className = "confete";
    pedaco.style.left = `${Math.random() * 100}%`;
    pedaco.style.setProperty("--cor", CORES_CONFETE[Math.floor(Math.random() * CORES_CONFETE.length)]);
    pedaco.style.setProperty("--atraso", `${(Math.random() * 0.3).toFixed(2)}s`);
    pedaco.style.setProperty("--duracao", `${(1.6 + Math.random() * 0.9).toFixed(2)}s`);
    pedaco.style.setProperty("--rotacao", `${Math.round(Math.random() * 720 - 360)}deg`);
    pedaco.style.setProperty("--deriva", `${Math.round(Math.random() * 160 - 80)}px`);
    pedaco.addEventListener("animationend", () => pedaco.remove());
    confeteContainer.appendChild(pedaco);
  }
}

let audioCtxComemoracao;

// Sintetiza um "tim-tim-tim-tããã" (arpejo maior C-E-G-C) via Web Audio API —
// sem depender de nenhum arquivo de áudio externo.
function tocarSomComemoracao() {
  try {
    audioCtxComemoracao =
      audioCtxComemoracao || new (window.AudioContext || window.webkitAudioContext)();
    const contexto = audioCtxComemoracao;
    const agora = contexto.currentTime;
    const notas = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notas.forEach((frequencia, indice) => {
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      const inicio = agora + indice * 0.11;
      const fim = inicio + 0.24;

      oscilador.type = "triangle";
      oscilador.frequency.value = frequencia;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.linearRampToValueAtTime(0.25, inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, fim);

      oscilador.connect(ganho);
      ganho.connect(contexto.destination);
      oscilador.start(inicio);
      oscilador.stop(fim + 0.02);
    });
  } catch {
    // Web Audio indisponível neste navegador — segue sem som.
  }
}

function aplicarCenario(contexto) {
  const tema = CONTEXTOS_VALIDOS.includes(contexto) ? contexto : "casa";

  const temaAnterior = [...areaJogo.classList].find((c) => c.startsWith("tema-"));
  if (temaAnterior) areaJogo.classList.remove(temaAnterior);
  areaJogo.classList.add(`tema-${tema}`);

  cenarioDecor.innerHTML = [1, 2, 3, 4]
    .map(
      (indice) =>
        `<svg class="decor decor-${indice}"><use href="#icone-${tema}"></use></svg>`
    )
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
    tentativas: 0,
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
  estado.fase.tentativas += 1;
  sortearPoseMascote();

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
      const pontosGanhos = calcularPontos(estado.fase.tentativas);
      textoFeedback.innerHTML =
        pontosGanhos > 0
          ? `Muito bem, você acertou! ${pontosComEstrela(`+${pontosGanhos}`)}`
          : "Muito bem, você acertou!";
      textoFeedback.className = "feedback ok";
      dispararConfete();
      tocarSomComemoracao();
      await salvarProgressoFase(pontosGanhos);
      btnContinuarJogo.classList.remove("oculto");
    } else {
      botaoClicado.classList.add("errada");
      textoFeedback.textContent = "Não foi dessa vez, tente novamente.";
      textoFeedback.className = "feedback erro";
      btnTentarNovamente.classList.remove("oculto");
    }
  } catch (erro) {
    textoFeedback.textContent = erro.message;
    textoFeedback.className = "feedback erro";
    btnTentarNovamente.classList.remove("oculto");
  }
}

async function salvarProgressoFase(pontos) {
  try {
    await chamarApi("/progresso", {
      method: "POST",
      body: JSON.stringify({
        aluno_id: estado.aluno.id,
        fase_numero: estado.fase.numero,
        concluida: true,
        pontos,
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
  const alunoSalvo = localStorage.getItem(CHAVE_ALUNO);
  if (alunoSalvo) {
    try {
      const aluno = JSON.parse(alunoSalvo);
      const turma = await chamarApi(`/turmas/${aluno.turma_codigo}`);
      estado.turma = turma;
      estado.aluno = { id: aluno.id, nome_usuario: aluno.nome_usuario, turma_id: aluno.turma_id };
      await entrarNoMenu();
      return;
    } catch {
      localStorage.removeItem(CHAVE_ALUNO);
    }
  }

  const professorSalvo = localStorage.getItem(CHAVE_PROFESSOR);
  if (professorSalvo) {
    try {
      estado.professor = JSON.parse(professorSalvo);
      await entrarAreaProfessor();
      return;
    } catch {
      localStorage.removeItem(CHAVE_PROFESSOR);
    }
  }

  mostrarTela("tela-turma");
})();
