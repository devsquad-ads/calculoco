/* ===================== CONFIGURAÇÃO E ESTADO ===================== */

const API_URL = "/api";
const CHAVE_ALUNO = "calculoco_aluno";
const CHAVE_PROFESSOR = "calculoco_professor";
const CHAVE_CONVIDADO = "calculoco_convidado";
const CHAVE_PROGRESSO_ALUNO = "calculoco_progresso_aluno";
// sessionStorage: tela em que a aba estava, para voltar nela ao recarregar
const CHAVE_TELA = "calculoco_tela";

// Os 4 módulos do jogo (1 para cada operação). Cada módulo tem 5 níveis
// de dificuldade crescente (fase_numero global = (modulo-1)*5 + nivel).
const MODULOS = [
  { numero: 1, titulo: "Ilha da Adição", icone: "+", cor: "var(--amarelo)", operacao: "Adição" },
  { numero: 2, titulo: "Mercado da Subtração", icone: "−", cor: "var(--rosa)", operacao: "Subtração" },
  { numero: 3, titulo: "Selva da Multiplicação", icone: "×", cor: "var(--verde)", operacao: "Multiplicação" },
  { numero: 4, titulo: "Vale da Divisão", icone: "÷", cor: "var(--azul-ceu)", operacao: "Divisão" },
];
const TOTAL_FASES = MODULOS.length * 5;

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
  aluno: null, // { id, nome_usuario, turma_id } ou { convidado: true }
  progresso: [], // [{ fase_numero, concluida, pontos }]
  professor: null, // { id, usuario, nome }
  turmasProfessor: null, // [{ id, codigo, nome_turma, total_alunos, criado_em }], null = carregando, "erro"
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
  const headers = { "Content-Type": "application/json", ...opcoes.headers };
  if (estado.professor?.token) headers.Authorization = `Bearer ${estado.professor.token}`;

  const resposta = await fetch(`${API_URL}${caminho}`, { ...opcoes, headers });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    // Sessão do professor expirou/invalidou: desloga e volta para o login.
    if (resposta.status === 401 && estado.professor?.token) encerrarSessaoProfessor();
    const erro = new Error(dados.erro || "Ocorreu um erro inesperado.");
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

function lerJson(armazenamento, chave) {
  try {
    return JSON.parse(armazenamento.getItem(chave));
  } catch {
    return null;
  }
}

/* ===================== NAVEGAÇÃO ENTRE TELAS ===================== */

function mostrarTela(id, telaSalva = null) {
  const alvo = document.getElementById(id);
  // Só mexe nas classes se a tela mudou, senão a animação de entrada
  // reexecuta e dá a impressão de "piscar" (ex.: trocar de fase no jogo).
  if (!alvo.classList.contains("ativa")) {
    document.querySelectorAll(".tela.ativa").forEach((t) => t.classList.remove("ativa"));
    alvo.classList.add("ativa");
  }
  document.body.classList.toggle("em-jogo", id === "tela-jogo");
  try {
    if (telaSalva) sessionStorage.setItem(CHAVE_TELA, JSON.stringify(telaSalva));
    else sessionStorage.removeItem(CHAVE_TELA);
  } catch {}
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

document.getElementById("btn-ir-creditos").addEventListener("click", () => {
  mostrarTela("tela-creditos");
});

document.getElementById("btn-voltar-creditos").addEventListener("click", () => {
  mostrarTela("tela-turma");
});

document.getElementById("btn-jogar-sem-login").addEventListener("click", entrarComoConvidado);

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
  estado.progresso = lerProgressoEmCache(aluno.id);
  salvarDadosConvidado({ ...lerDadosConvidado(), ativo: false });
  localStorage.setItem(
    CHAVE_ALUNO,
    JSON.stringify({ ...aluno, turma_codigo: estado.turma?.codigo, turma: estado.turma })
  );
}

function sairAluno() {
  if (alunoConvidado()) {
    salvarDadosConvidado({ ...lerDadosConvidado(), ativo: false });
  } else {
    localStorage.removeItem(CHAVE_ALUNO);
    localStorage.removeItem(CHAVE_PROGRESSO_ALUNO);
  }
  estado.aluno = null;
  estado.turma = null;
  estado.progresso = [];
  campoCodigoTurma.value = "";
  mostrarTela("tela-turma");
}

document.getElementById("btn-sair").addEventListener("click", sairAluno);

/* ===================== JOGO SEM LOGIN ===================== */

function lerDadosConvidado() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_CONVIDADO));
    return {
      ativo: !!dados?.ativo,
      progresso: Array.isArray(dados?.progresso) ? dados.progresso : [],
    };
  } catch {
    return { ativo: false, progresso: [] };
  }
}

function salvarDadosConvidado(dados) {
  try {
    localStorage.setItem(CHAVE_CONVIDADO, JSON.stringify(dados));
  } catch {
    mostrarToast("Não foi possível salvar o progresso neste aparelho.");
  }
}

function alunoConvidado() {
  return !!estado.aluno?.convidado;
}

async function entrarComoConvidado() {
  localStorage.removeItem(CHAVE_ALUNO);
  localStorage.removeItem(CHAVE_PROGRESSO_ALUNO);
  estado.turma = null;
  estado.aluno = { convidado: true };
  salvarDadosConvidado({ ...lerDadosConvidado(), ativo: true });
  await entrarNoMenu();
}

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
    definirProfessorLogado(resultado.professor, resultado.token);
    await entrarAreaProfessor();
  } catch (erro) {
    profAvisoAuth.textContent = erro.message;
  }
});

function definirProfessorLogado(professor, token) {
  estado.professor = { ...professor, token };
  localStorage.setItem(CHAVE_PROFESSOR, JSON.stringify(estado.professor));
}

function sairProfessor() {
  localStorage.removeItem(CHAVE_PROFESSOR);
  estado.professor = null;
  estado.turmasProfessor = null;
}

function encerrarSessaoProfessor() {
  sairProfessor();
  prepararTelaProfessorAuth();
  mostrarTela("tela-professor-auth");
  mostrarToast("Sua sessão expirou. Entre novamente.");
}

document.getElementById("prof-btn-sair").addEventListener("click", () => {
  sairProfessor();
  mostrarTela("tela-turma");
});

const profSaudacao = document.getElementById("prof-saudacao");
const listaTurmas = document.getElementById("lista-turmas");

async function entrarAreaProfessor() {
  profSaudacao.textContent = `Olá, ${estado.professor.nome}!`;
  avisoNovaTurma.textContent = "";
  formNovaTurma.reset();
  estado.turmasProfessor = null;
  renderizarListaTurmas();
  mostrarTela("tela-professor-turmas");
  await atualizarListaTurmas();
}

async function carregarTurmasProfessor() {
  try {
    const resultado = await chamarApi(`/professores/${estado.professor.id}/turmas`);
    estado.turmasProfessor = resultado.turmas || [];
  } catch {
    if (!estado.turmasProfessor) estado.turmasProfessor = "erro";
  }
}

async function atualizarListaTurmas() {
  await carregarTurmasProfessor();
  renderizarListaTurmas();
}

function renderizarListaTurmas() {
  listaTurmas.innerHTML = "";

  if (estado.turmasProfessor === null) {
    listaTurmas.innerHTML = '<p class="aviso-turmas-vazio">Carregando suas turmas...</p>';
    return;
  }
  if (estado.turmasProfessor === "erro") {
    listaTurmas.innerHTML =
      '<p class="aviso-turmas-vazio">Não foi possível carregar suas turmas. Tente novamente em instantes.</p>';
    return;
  }
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
    await atualizarListaTurmas();
  } catch (erro) {
    avisoNovaTurma.style.color = "var(--rosa)";
    avisoNovaTurma.textContent = erro.message;
  }
});

document.getElementById("btn-voltar-turmas").addEventListener("click", () => {
  mostrarTela("tela-professor-turmas");
  atualizarListaTurmas();
});

const dashNomeTurma = document.getElementById("dash-nome-turma");
const dashCodigoTurma = document.getElementById("dash-codigo-turma");
const corpoTabelaDesempenho = document.getElementById("corpo-tabela-desempenho");
const tabelaDesempenho = document.getElementById("tabela-desempenho");
const dashVazio = document.getElementById("dash-vazio");

let turmaDashboard = null;

async function abrirDashboardTurma(turma) {
  turmaDashboard = turma;
  dashNomeTurma.textContent = turma.nome_turma;
  dashCodigoTurma.textContent = `Código: ${turma.codigo}`;
  corpoTabelaDesempenho.innerHTML = "";
  tabelaDesempenho.classList.remove("oculto");
  dashVazio.classList.add("oculto");
  mostrarTela("tela-professor-dashboard", {
    tela: "dashboard",
    turma: { id: turma.id, codigo: turma.codigo, nome_turma: turma.nome_turma },
  });

  try {
    const resultado = await chamarApi(
      `/turmas/${turma.id}/desempenho?professor_id=${estado.professor.id}`
    );
    renderizarDesempenho(resultado.alunos || [], turma);
  } catch (erro) {
    tabelaDesempenho.classList.add("oculto");
    dashVazio.classList.remove("oculto");
    dashVazio.textContent = erro.message;
  }
}

function renderizarDesempenho(alunos, turma) {
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
          <td>
            <button type="button" class="btn-linha btn-linha-icone btn-redefinir-pin" data-aluno-id="${aluno.aluno_id}" data-aluno-nome="${aluno.nome_usuario}">
              <svg class="icone-inline" aria-hidden="true"><use href="#icone-refresh"></use></svg>
              Redefinir
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  corpoTabelaDesempenho.querySelectorAll(".btn-redefinir-pin").forEach((botao) => {
    botao.addEventListener("click", () =>
      redefinirPinAluno(botao.dataset.alunoId, botao.dataset.alunoNome, turma)
    );
  });
}

async function redefinirPinAluno(alunoId, nomeUsuario, turma) {
  const confirmado = window.confirm(
    `Redefinir a senha de "${nomeUsuario}"?\n\nA nova senha (PIN) dele passa a ser o código da turma: ${turma.codigo}`
  );
  if (!confirmado) return;

  try {
    await chamarApi(`/turmas/${turma.id}/alunos/${alunoId}/redefinir-pin`, {
      method: "POST",
      body: JSON.stringify({ professor_id: estado.professor.id }),
    });
    mostrarToast(`Senha de ${nomeUsuario} redefinida para ${turma.codigo}.`);
  } catch (erro) {
    mostrarToast(erro.message);
  }
}

document.getElementById("btn-excluir-turma").addEventListener("click", async () => {
  const turma = turmaDashboard;
  if (!turma) return;

  const confirmado = window.confirm(
    `Excluir a turma "${turma.nome_turma}"?\n\nEla vai sumir da sua lista e os alunos não vão mais conseguir entrar com o código ${turma.codigo}.`
  );
  if (!confirmado) return;

  try {
    await chamarApi(`/turmas/${turma.id}`, {
      method: "DELETE",
      body: JSON.stringify({ professor_id: estado.professor.id }),
    });
    mostrarToast(`Turma "${turma.nome_turma}" excluída.`);
    mostrarTela("tela-professor-turmas");
    await atualizarListaTurmas();
  } catch (erro) {
    mostrarToast(erro.message);
  }
});

/* ===================== TELA 3: MENU DE MÓDULOS E NÍVEIS ===================== */

const saudacao = document.getElementById("saudacao");
const gradeFases = document.getElementById("grade-fases");

async function entrarNoMenu() {
  await carregarProgresso();
  mostrarMenu();
}

function mostrarMenu() {
  saudacao.textContent = alunoConvidado() ? "Olá!" : `Olá, ${estado.aluno.nome_usuario}!`;
  document.getElementById("texto-btn-sair").textContent = alunoConvidado() ? "Início" : "Sair";
  renderizarGradeFases();
  mostrarTela("tela-menu");
}

async function carregarProgresso() {
  if (alunoConvidado()) {
    estado.progresso = lerDadosConvidado().progresso;
    return;
  }
  try {
    const resultado = await chamarApi(`/progresso/${estado.aluno.id}`);
    estado.progresso = resultado.progresso || [];
    localStorage.setItem(
      CHAVE_PROGRESSO_ALUNO,
      JSON.stringify({ aluno_id: estado.aluno.id, progresso: estado.progresso })
    );
  } catch {
    // sem rede: mantém o progresso que já estava carregado
  }
}

function lerProgressoEmCache(alunoId) {
  const cache = lerJson(localStorage, CHAVE_PROGRESSO_ALUNO);
  return cache?.aluno_id === alunoId && Array.isArray(cache.progresso) ? cache.progresso : [];
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

function voltarAoMenu() {
  pararFala();
  mostrarMenu();
}

document.getElementById("btn-voltar-menu").addEventListener("click", voltarAoMenu);

/* ===================== TUTORIAL (COMO JOGAR) ===================== */

const CHAVE_TUTORIAL_VISTO = "calculoco_tutorial_visto";

const PASSOS_TUTORIAL = [
  {
    titulo: "Escolha um nível",
    texto: "Cada módulo tem 5 níveis. Toque em um nível liberado para começar. O próximo abre quando você completa o anterior!",
    figura: '<svg aria-hidden="true"><use href="#icone-lock"></use></svg>',
  },
  {
    titulo: "Ouça a pergunta",
    texto: "Leia a pergunta no balão ou toque no botão de som para o Calculoco ler para você.",
    figura: '<svg aria-hidden="true"><use href="#icone-som"></use></svg>',
  },
  {
    titulo: "Toque na resposta",
    texto: "Faça a conta e toque na resposta certa. Errou? Sem problema, é só tentar de novo!",
    figura: '<svg aria-hidden="true"><use href="#icone-check"></use></svg>',
  },
  {
    titulo: "Ganhe estrelas",
    texto: "Acertando de primeira você ganha 20 estrelas. Na segunda tentativa, 10, e na terceira, 5.",
    figura: '<img class="estrela" src="img/estrela.png" alt="">',
  },
  {
    titulo: "Vamos jogar?",
    texto: "Complete todos os níveis de Adição, Subtração, Multiplicação e Divisão. Boa sorte!",
    figura: '<img class="mascote-tutorial" src="img/mascote/1.jpeg" alt="">',
  },
];

const dialogoTutorial = document.getElementById("dialogo-tutorial");
const btnComoJogar = document.getElementById("btn-como-jogar");
const btnTutorialVoltar = document.getElementById("btn-tutorial-voltar");
const btnTutorialProximo = document.getElementById("btn-tutorial-proximo");
let passoTutorial = 0;

function renderizarPassoTutorial() {
  const passo = PASSOS_TUTORIAL[passoTutorial];
  const ultimo = passoTutorial === PASSOS_TUTORIAL.length - 1;

  document.getElementById("figura-tutorial").innerHTML = passo.figura;
  document.getElementById("passo-tutorial").textContent =
    `Passo ${passoTutorial + 1} de ${PASSOS_TUTORIAL.length}`;
  document.getElementById("titulo-tutorial").textContent = passo.titulo;
  document.getElementById("texto-tutorial").textContent = passo.texto;
  document.getElementById("pontos-tutorial").innerHTML = PASSOS_TUTORIAL.map(
    (_, i) => `<span class="${i === passoTutorial ? "ativo" : ""}"></span>`
  ).join("");

  btnTutorialVoltar.classList.toggle("oculto", passoTutorial === 0);
  btnTutorialProximo.textContent = ultimo ? "Vamos jogar!" : "Próximo";
}

function abrirTutorial() {
  passoTutorial = 0;
  renderizarPassoTutorial();
  dialogoTutorial.showModal();
  btnComoJogar.classList.remove("destaque");
  try {
    localStorage.setItem(CHAVE_TUTORIAL_VISTO, "1");
  } catch {}
}

btnComoJogar.addEventListener("click", abrirTutorial);
document.getElementById("btn-fechar-tutorial").addEventListener("click", () => dialogoTutorial.close());

btnTutorialVoltar.addEventListener("click", () => {
  passoTutorial -= 1;
  renderizarPassoTutorial();
});

btnTutorialProximo.addEventListener("click", () => {
  if (passoTutorial === PASSOS_TUTORIAL.length - 1) {
    dialogoTutorial.close();
    return;
  }
  passoTutorial += 1;
  renderizarPassoTutorial();
});

// clique no fundo escuro fecha
dialogoTutorial.addEventListener("click", (e) => {
  if (e.target === dialogoTutorial) dialogoTutorial.close();
});

try {
  if (!localStorage.getItem(CHAVE_TUTORIAL_VISTO)) btnComoJogar.classList.add("destaque");
} catch {}

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
const acoesFimFase = document.getElementById("acoes-fim-fase");
const btnProximaFase = document.getElementById("btn-proxima-fase");
const textoProximaFase = document.getElementById("texto-proxima-fase");
const btnMenuFim = document.getElementById("btn-menu-fim");
const btnTentarNovamente = document.getElementById("btn-tentar-novamente");
const confeteContainer = document.getElementById("confete-container");
const cartaoPergunta = document.querySelector(".cartao-pergunta");

/* ===================== LEITURA EM VOZ ALTA (TTS) ===================== */

const btnOuvirEnunciado = document.getElementById("btn-ouvir-enunciado");
const sintetizadorVoz = window.speechSynthesis || null;
let vozPortugues = null;

const PREFERENCIAS_VOZ = [
  { busca: /(julio|antonio|nicolau|fabio|donato|valerio|humberto|macerio).*(natural|online)/i, pitch: 1.08, rate: 1.02 },
  { busca: /thalita.*(natural|online)/i, pitch: 1.12, rate: 1.06 },
  { busca: /francisca.*(natural|online)/i, pitch: 1.15, rate: 1.06 },
  { busca: /google.*portugu[eê]s.*brasil/i, pitch: 1.2, rate: 1.05 },
  { busca: /natural|neural|enhanced|premium|aprimorad/i, pitch: 1.1, rate: 1.05 },
];

// A voz principal vem do backend (Azure, igual para todo mundo). A voz do
// navegador só entra quando o servidor não tem TTS configurado ou a cota acabou.
let ttsServidorDisponivel = false;
let audioEmCache = { texto: null, buffer: null };
let fonteAudioFala = null;
let pedidoFala = 0;

function atualizarBotaoOuvir() {
  if (!btnOuvirEnunciado) return;
  btnOuvirEnunciado.classList.toggle("oculto", !ttsServidorDisponivel && !vozPortugues);
}

function escolherVozPortugues() {
  if (!sintetizadorVoz) return null;
  const vozes = sintetizadorVoz.getVoices().filter((v) => v.lang && v.lang.startsWith("pt"));
  if (!vozes.length) return null;
  const vozesBrasil = vozes.filter((v) => v.lang.replace("_", "-") === "pt-BR");
  const candidatas = vozesBrasil.length ? vozesBrasil : vozes;

  for (const preferencia of PREFERENCIAS_VOZ) {
    const voz = candidatas.find((v) => preferencia.busca.test(v.name));
    if (voz) return { voz, pitch: preferencia.pitch, rate: preferencia.rate };
  }

  return null;
}

function dividirEmFrases(texto) {
  return (texto.match(/[^.!?]+[.!?]*/g) || [texto]).map((f) => f.trim()).filter(Boolean);
}

if (sintetizadorVoz) {
  vozPortugues = escolherVozPortugues();
  // Em muitos navegadores a lista de vozes carrega de forma assíncrona.
  sintetizadorVoz.addEventListener("voiceschanged", () => {
    vozPortugues = escolherVozPortugues();
    atualizarBotaoOuvir();
  });
}
atualizarBotaoOuvir();

chamarApi("/tts/status")
  .then(({ disponivel }) => {
    ttsServidorDisponivel = !!disponivel;
    atualizarBotaoOuvir();
  })
  .catch(() => {});

function marcarFalando(falando) {
  btnOuvirEnunciado.classList.toggle("falando", falando);
  document.querySelector(".linha-mascote").classList.toggle("falando", falando);
  abaixarMusica(falando);
}

function pararFala() {
  pedidoFala += 1;
  if (fonteAudioFala) {
    fonteAudioFala.onended = null;
    try {
      fonteAudioFala.stop();
    } catch {}
    fonteAudioFala = null;
  }
  if (sintetizadorVoz) sintetizadorVoz.cancel();
  marcarFalando(false);
}

async function buscarAudioServidor(texto, questionToken) {
  if (!ttsServidorDisponivel) return null;
  if (audioEmCache.texto === texto) return audioEmCache.buffer;

  try {
    const resposta = await fetch(`${API_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, questionToken }),
    });
    if (!resposta.ok) {
      if (resposta.status === 503) {
        ttsServidorDisponivel = false;
        atualizarBotaoOuvir();
      }
      return null;
    }
    const buffer = await obterContextoAudio().decodeAudioData(await resposta.arrayBuffer());
    audioEmCache = { texto, buffer };
    return buffer;
  } catch {
    return null;
  }
}

function tocarAudio(buffer) {
  const contexto = obterContextoAudio();
  if (contexto.state === "suspended") contexto.resume();

  const fonte = contexto.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(contexto.destination);
  fonte.onended = () => {
    if (fonteAudioFala !== fonte) return;
    fonteAudioFala = null;
    marcarFalando(false);
  };
  fonteAudioFala = fonte;
  fonte.start();
}

function falarComNavegador(texto, pedido) {
  if (!vozPortugues) vozPortugues = escolherVozPortugues();
  if (!sintetizadorVoz || !vozPortugues) {
    marcarFalando(false);
    atualizarBotaoOuvir();
    mostrarToast("Não foi possível ler a pergunta agora.");
    return;
  }

  const ajuste = vozPortugues;
  const frases = dividirEmFrases(texto);
  const terminar = () => {
    if (pedido === pedidoFala) marcarFalando(false);
  };

  frases.forEach((frase, indice) => {
    const fala = new SpeechSynthesisUtterance(frase);
    const pergunta = frase.endsWith("?");
    fala.lang = "pt-BR";
    fala.voice = ajuste.voz;
    fala.rate = ajuste.rate;
    fala.pitch = Math.min(2, ajuste.pitch + (pergunta ? 0.08 : 0));
    fala.volume = 1;
    if (indice === frases.length - 1) fala.onend = terminar;
    fala.onerror = terminar;
    sintetizadorVoz.speak(fala);
  });
}

async function falarEnunciado() {
  const texto = estado.fase.enunciado;
  if (!texto) return;

  pararFala();
  const pedido = pedidoFala;
  marcarFalando(true);

  // iOS só libera o áudio se o contexto for retomado ainda dentro do clique
  try {
    const contexto = obterContextoAudio();
    if (contexto.state === "suspended") contexto.resume();
  } catch {}

  const buffer = await buscarAudioServidor(texto, estado.fase.questionToken);
  if (pedido !== pedidoFala) return;

  if (buffer) tocarAudio(buffer);
  else falarComNavegador(texto, pedido);
}

if (btnOuvirEnunciado) {
  btnOuvirEnunciado.addEventListener("click", falarEnunciado);
}

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
    pedaco.style.setProperty("--atraso", `${(Math.random() * 0.5).toFixed(2)}s`);
    pedaco.style.setProperty("--duracao", `${(3 + Math.random() * 1.8).toFixed(2)}s`);
    pedaco.style.setProperty("--rotacao", `${Math.round(Math.random() * 720 - 360)}deg`);
    pedaco.style.setProperty("--deriva", `${Math.round(Math.random() * 160 - 80)}px`);
    pedaco.addEventListener("animationend", () => pedaco.remove());
    confeteContainer.appendChild(pedaco);
  }
}

let audioCtxEfeitos;

// Sintetiza um "tim-tim-tim-tããã" (arpejo maior C-E-G-C) via Web Audio API —
// sem depender de nenhum arquivo de áudio externo.
function tocarSomComemoracao() {
  try {
    audioCtxEfeitos =
      audioCtxEfeitos || new (window.AudioContext || window.webkitAudioContext)();
    const contexto = audioCtxEfeitos;
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

// Sintetiza um "bum-bu" curto e grave para o feedback de resposta errada —
// duas notas descendentes e dissonantes, o suficiente para soar "errado"
// sem ser desagradável para uma criança ouvir várias vezes seguidas.
function tocarSomErro() {
  try {
    audioCtxEfeitos =
      audioCtxEfeitos || new (window.AudioContext || window.webkitAudioContext)();
    const contexto = audioCtxEfeitos;
    const agora = contexto.currentTime;
    const notas = [246.94, 196.0]; // B3 -> G3, descendente

    notas.forEach((frequencia, indice) => {
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();
      const inicio = agora + indice * 0.13;
      const fim = inicio + 0.22;

      oscilador.type = "sawtooth";
      oscilador.frequency.value = frequencia;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.linearRampToValueAtTime(0.16, inicio + 0.015);
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

/* ===================== MÚSICA AMBIENTE ===================== */

const CHAVE_MUSICA = "calculoco_musica";
const btnMusica = document.getElementById("btn-musica");

const ACORDES_MUSICA = [
  [261.63, 329.63, 392.0],
  [196.0, 246.94, 293.66],
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
];
const NOTAS_MELODIA = [523.25, 587.33, 659.25, 783.99, 880.0];
const PADRAO_ARPEJO = [0, 1, 2, 1, 0, 1, 2, 1];
const BATIDAS_POR_MINUTO = 104;
const DURACAO_TEMPO = 60 / BATIDAS_POR_MINUTO;
const DURACAO_ACORDE = DURACAO_TEMPO * 4;
const VOLUME_MUSICA = 0.07;

let musicaLigada = lerPreferenciaMusica();
let saidaMusica = null;
let timerMusica = null;
let proximoAcorde = 0;
let indiceAcorde = 0;

function lerPreferenciaMusica() {
  try {
    return localStorage.getItem(CHAVE_MUSICA) !== "0";
  } catch {
    return true;
  }
}

function salvarPreferenciaMusica() {
  try {
    localStorage.setItem(CHAVE_MUSICA, musicaLigada ? "1" : "0");
  } catch {}
}

function obterContextoAudio() {
  audioCtxEfeitos =
    audioCtxEfeitos || new (window.AudioContext || window.webkitAudioContext)();
  return audioCtxEfeitos;
}

function tocarNotaMusica(frequencia, inicio, duracao, volume, tipo, ataque = 0.02) {
  const contexto = audioCtxEfeitos;
  const oscilador = contexto.createOscillator();
  const ganho = contexto.createGain();

  oscilador.type = tipo;
  oscilador.frequency.value = frequencia;
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.linearRampToValueAtTime(volume, inicio + ataque);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);

  oscilador.connect(ganho);
  ganho.connect(saidaMusica.entrada);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracao + 0.05);
}

function agendarMusica() {
  if (!saidaMusica) return;
  const contexto = audioCtxEfeitos;

  while (proximoAcorde < contexto.currentTime + DURACAO_ACORDE) {
    const acorde = ACORDES_MUSICA[indiceAcorde % ACORDES_MUSICA.length];
    const inicio = proximoAcorde;

    acorde.forEach((frequencia) =>
      tocarNotaMusica(frequencia, inicio, DURACAO_ACORDE + 0.4, 0.06, "sine", 0.4)
    );

    tocarNotaMusica(acorde[0] / 2, inicio, DURACAO_TEMPO * 1.4, 0.32, "sine", 0.01);
    tocarNotaMusica(acorde[2] / 2, inicio + DURACAO_TEMPO * 2, DURACAO_TEMPO * 1.4, 0.26, "sine", 0.01);

    PADRAO_ARPEJO.forEach((indiceNota, passo) => {
      const nota = acorde[indiceNota] * 2;
      const volume = passo % 2 === 0 ? 0.09 : 0.06;
      tocarNotaMusica(nota, inicio + passo * (DURACAO_TEMPO / 2), 0.35, volume, "triangle", 0.008);
    });

    [0, 1.5, 2, 3].forEach((tempo) => {
      if (Math.random() < 0.55) {
        const nota = NOTAS_MELODIA[Math.floor(Math.random() * NOTAS_MELODIA.length)];
        tocarNotaMusica(nota, inicio + tempo * DURACAO_TEMPO, DURACAO_TEMPO * 1.2, 0.08, "sine", 0.02);
      }
    });

    proximoAcorde += DURACAO_ACORDE;
    indiceAcorde += 1;
  }
}

function iniciarMusica() {
  if (saidaMusica) return;
  let contexto;
  try {
    contexto = obterContextoAudio();
  } catch {
    return;
  }
  if (contexto.state === "suspended") contexto.resume();

  const filtro = contexto.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = 2200;

  const volume = contexto.createGain();
  volume.gain.setValueAtTime(0.0001, contexto.currentTime);
  volume.gain.linearRampToValueAtTime(VOLUME_MUSICA, contexto.currentTime + 2.5);

  filtro.connect(volume);
  volume.connect(contexto.destination);

  saidaMusica = { entrada: filtro, volume };
  proximoAcorde = contexto.currentTime + 0.1;
  agendarMusica();
  timerMusica = setInterval(agendarMusica, 1000);
}

function pararMusica() {
  if (!saidaMusica) return;
  const contexto = audioCtxEfeitos;
  const { volume } = saidaMusica;

  clearInterval(timerMusica);
  timerMusica = null;
  saidaMusica = null;

  volume.gain.cancelScheduledValues(contexto.currentTime);
  volume.gain.setValueAtTime(volume.gain.value, contexto.currentTime);
  volume.gain.linearRampToValueAtTime(0.0001, contexto.currentTime + 0.6);
  setTimeout(() => volume.disconnect(), 800);
}

function abaixarMusica(abaixar) {
  if (!saidaMusica) return;
  const contexto = audioCtxEfeitos;
  const alvo = abaixar ? VOLUME_MUSICA * 0.3 : VOLUME_MUSICA;
  saidaMusica.volume.gain.cancelScheduledValues(contexto.currentTime);
  saidaMusica.volume.gain.setTargetAtTime(alvo, contexto.currentTime, 0.25);
}

function atualizarBotaoMusica() {
  const rotulo = musicaLigada ? "Desligar música" : "Ligar música";
  btnMusica.classList.toggle("desligada", !musicaLigada);
  btnMusica.setAttribute("aria-pressed", String(musicaLigada));
  btnMusica.setAttribute("aria-label", rotulo);
  btnMusica.title = rotulo;
  btnMusica
    .querySelector("use")
    .setAttribute("href", musicaLigada ? "#icone-musica" : "#icone-musica-off");
}

btnMusica.addEventListener("click", () => {
  musicaLigada = !musicaLigada;
  salvarPreferenciaMusica();
  atualizarBotaoMusica();
  if (musicaLigada) iniciarMusica();
  else pararMusica();
});

function destravarMusica(evento) {
  if (btnMusica.contains(evento.target)) return;
  document.removeEventListener("pointerdown", destravarMusica, true);
  document.removeEventListener("keydown", destravarMusica, true);
  if (musicaLigada) iniciarMusica();
}

document.addEventListener("pointerdown", destravarMusica, true);
document.addEventListener("keydown", destravarMusica, true);

document.addEventListener("visibilitychange", () => {
  if (!audioCtxEfeitos) return;
  if (document.hidden) audioCtxEfeitos.suspend();
  else audioCtxEfeitos.resume();
});

atualizarBotaoMusica();

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

  document.getElementById("cenario-modulo").dataset.modulo = String(modulo.numero);
  mostrarTela("tela-jogo", { tela: "jogo", fase: numeroFase });
  pillFase.textContent = `${modulo.operacao} · Nível ${nivel} de 5`;
  await carregarPergunta();
}

let pedidoPergunta = 0;

async function carregarPergunta() {
  pararFala();
  estado.fase.respondida = false;
  estado.fase.tentativas += 1;
  const pedido = ++pedidoPergunta;

  textoFeedback.textContent = "";
  textoFeedback.className = "feedback";
  acoesFimFase.classList.add("oculto");
  btnTentarNovamente.classList.add("oculto");
  document.querySelectorAll(".btn-opcao").forEach((b) => (b.disabled = true));

  // Já tem pergunta na tela (trocou de fase / tentar de novo): mantém o card
  // esmaecido até a nova chegar, em vez de esvaziar e piscar "Carregando".
  if (opcoesResposta.children.length > 0) cartaoPergunta.classList.add("carregando");
  else textoEnunciado.textContent = "Carregando pergunta...";

  try {
    const questao = await chamarApi(`/fases/${estado.fase.numero}/questao`);
    if (pedido !== pedidoPergunta) return;
    estado.fase.questionToken = questao.questionToken;
    estado.fase.enunciado = questao.enunciado;
    sortearPoseMascote();
    textoEnunciado.textContent = questao.enunciado;
    aplicarCenario(questao.contexto);
    renderizarOpcoes(questao.opcoes);
  } catch (erro) {
    if (pedido !== pedidoPergunta) return;
    textoEnunciado.textContent = erro.message;
    opcoesResposta.innerHTML = "";
  } finally {
    if (pedido === pedidoPergunta) cartaoPergunta.classList.remove("carregando");
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
      mostrarAcoesFimFase();
    } else {
      botaoClicado.classList.add("errada");
      textoFeedback.textContent = "Não foi dessa vez, tente novamente.";
      textoFeedback.className = "feedback erro";
      tocarSomErro();
      btnTentarNovamente.classList.remove("oculto");
    }
  } catch (erro) {
    textoFeedback.textContent = erro.message;
    textoFeedback.className = "feedback erro";
    btnTentarNovamente.classList.remove("oculto");
  }
}

async function salvarProgressoFase(pontos) {
  if (alunoConvidado()) {
    const dados = lerDadosConvidado();
    const progresso = dados.progresso.filter((p) => p.fase_numero !== estado.fase.numero);
    progresso.push({ fase_numero: estado.fase.numero, concluida: true, pontos });
    progresso.sort((a, b) => a.fase_numero - b.fase_numero);
    salvarDadosConvidado({ ...dados, progresso });
    estado.progresso = progresso;
    return;
  }
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

function mostrarAcoesFimFase() {
  const proxima = estado.fase.numero + 1;
  const temProxima = proxima <= TOTAL_FASES;

  btnProximaFase.classList.toggle("oculto", !temProxima);
  if (temProxima) {
    const moduloProximo = MODULOS[Math.ceil(proxima / 5) - 1];
    textoProximaFase.textContent =
      moduloProximo === estado.fase.modulo ? "Próximo nível" : `Ir para ${moduloProximo.titulo}`;
  } else {
    textoFeedback.insertAdjacentHTML("beforeend", "<br>Você completou todas as fases!");
  }

  acoesFimFase.classList.remove("oculto");
  (temProxima ? btnProximaFase : btnMenuFim).focus();
}

btnTentarNovamente.addEventListener("click", carregarPergunta);
btnProximaFase.addEventListener("click", () => abrirFase(estado.fase.numero + 1));
btnMenuFim.addEventListener("click", voltarAoMenu);

/* ===================== INICIALIZAÇÃO ===================== */

// Escolhe a tela só com o que está no localStorage, sem esperar a API.
// A sessão do aluno é revalidada depois, em segundo plano.
function iniciar() {
  const telaSalva = lerJson(sessionStorage, CHAVE_TELA);
  const alunoSalvo = lerJson(localStorage, CHAVE_ALUNO);

  if (alunoSalvo?.id && alunoSalvo.turma_codigo) {
    estado.turma = alunoSalvo.turma || { codigo: alunoSalvo.turma_codigo };
    estado.aluno = { id: alunoSalvo.id, nome_usuario: alunoSalvo.nome_usuario, turma_id: alunoSalvo.turma_id };
    estado.progresso = lerProgressoEmCache(alunoSalvo.id);
    abrirTelaDoAluno(telaSalva);
    revalidarAluno(alunoSalvo);
    return;
  }
  localStorage.removeItem(CHAVE_ALUNO);

  if (lerDadosConvidado().ativo) {
    estado.aluno = { convidado: true };
    estado.progresso = lerDadosConvidado().progresso;
    abrirTelaDoAluno(telaSalva);
    return;
  }

  const professorSalvo = lerJson(localStorage, CHAVE_PROFESSOR);
  if (professorSalvo?.id) {
    estado.professor = professorSalvo;
    if (telaSalva?.tela === "dashboard" && telaSalva.turma?.id) {
      profSaudacao.textContent = `Olá, ${estado.professor.nome}!`;
      abrirDashboardTurma(telaSalva.turma);
      atualizarListaTurmas();
    } else {
      entrarAreaProfessor();
    }
    return;
  }
  localStorage.removeItem(CHAVE_PROFESSOR);

  mostrarTela("tela-turma");
}

function abrirTelaDoAluno(telaSalva) {
  const fase = telaSalva?.tela === "jogo" ? Number(telaSalva.fase) : null;
  if (fase >= 1 && fase <= TOTAL_FASES && faseDesbloqueada(fase)) {
    abrirFase(fase);
  } else {
    mostrarMenu();
  }
}

async function revalidarAluno(alunoSalvo) {
  try {
    const turma = await chamarApi(`/turmas/${alunoSalvo.turma_codigo}`);
    if (estado.aluno?.id !== alunoSalvo.id) return;
    estado.turma = turma;
    localStorage.setItem(CHAVE_ALUNO, JSON.stringify({ ...alunoSalvo, turma }));
  } catch (erro) {
    if (erro.status === 404 && estado.aluno?.id === alunoSalvo.id) {
      sairAluno();
      mostrarToast("Sua turma não está mais disponível. Fale com seu professor.");
    }
    return;
  }

  await carregarProgresso();
  if (estado.aluno?.id === alunoSalvo.id) renderizarGradeFases();
}

iniciar();
