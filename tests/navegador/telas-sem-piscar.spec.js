const { test, expect } = require("@playwright/test");
const { criarClienteApi } = require("../apoio/api");

// Registra toda tela que fica ativa, desde o carregamento da página.
async function gravarTelas(page) {
  await page.addInitScript(() => {
    window.__telas = [];
    new MutationObserver(() => {
      const ativa = document.querySelector(".tela.ativa")?.id;
      if (ativa && window.__telas.at(-1) !== ativa) window.__telas.push(ativa);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  });
}

async function atrasarApi(page, ms = 600) {
  await page.route("**/api/**", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    route.continue();
  });
}

async function salvarNoStorage(page, itens) {
  await page.goto("/");
  await page.evaluate((itens) => {
    localStorage.clear();
    sessionStorage.clear();
    for (const [chave, valor] of Object.entries(itens)) localStorage.setItem(chave, JSON.stringify(valor));
  }, itens);
}

test("aluno logado abre direto no menu, sem passar pela tela de login", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const turma = await api.criarTurma(await api.criarProfessor());
  const aluno = await api.criarAluno(turma);

  await salvarNoStorage(page, { calculoco_aluno: { ...aluno, turma_codigo: turma.codigo } });
  await gravarTelas(page);
  await atrasarApi(page);
  await page.reload();

  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
  await expect(page.locator("#saudacao")).toHaveText(`Olá, ${aluno.nome_usuario}!`);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__telas)).toEqual(["tela-menu"]);
});

test("menu usa o progresso em cache e atualiza quando a API responde", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const turma = await api.criarTurma(await api.criarProfessor());
  const aluno = await api.criarAluno(turma);
  await api.chamar("/progresso", {
    method: "POST",
    corpo: { aluno_id: aluno.id, fase_numero: 1, concluida: true, pontos: 20 },
  });

  await salvarNoStorage(page, {
    calculoco_aluno: { ...aluno, turma_codigo: turma.codigo },
    calculoco_progresso_aluno: { aluno_id: aluno.id, progresso: [] },
  });
  await atrasarApi(page);
  await page.reload();

  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
  await expect(page.locator('.nivel-btn[data-fase="2"]')).toBeDisabled();
  await expect(page.locator('.nivel-btn[data-fase="1"]')).toHaveClass(/concluido/, { timeout: 5000 });
  await expect(page.locator('.nivel-btn[data-fase="2"]')).toBeEnabled();
});

test("aluno de turma excluída é deslogado com aviso", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const professor = await api.criarProfessor();
  const turma = await api.criarTurma(professor);
  const aluno = await api.criarAluno(turma);
  await api.chamar(`/turmas/${turma.id}`, { method: "DELETE", token: professor.token });

  await salvarNoStorage(page, { calculoco_aluno: { ...aluno, turma_codigo: turma.codigo } });
  await page.reload();

  await expect(page.locator("#tela-turma")).toHaveClass(/ativa/);
  await expect(page.locator("#toast")).toContainText("não está mais disponível");
  expect(await page.evaluate(() => localStorage.getItem("calculoco_aluno"))).toBeNull();
});

test("sem rede, o aluno logado continua no menu", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const turma = await api.criarTurma(await api.criarProfessor());
  const aluno = await api.criarAluno(turma);

  await salvarNoStorage(page, { calculoco_aluno: { ...aluno, turma_codigo: turma.codigo } });
  await page.route("**/api/**", (route) => route.abort());
  await page.reload();

  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
  await page.waitForTimeout(500);
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
});

test("professor logado abre direto em Minhas turmas", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const professor = await api.criarProfessor("Bia");
  await api.criarTurma(professor, "5º Ano");

  await salvarNoStorage(page, { calculoco_professor: professor });
  await gravarTelas(page);
  await atrasarApi(page);
  await page.reload();

  await expect(page.locator("#tela-professor-turmas")).toHaveClass(/ativa/);
  await expect(page.locator("#lista-turmas")).toContainText("Carregando");
  await expect(page.locator(".cartao-turma")).toContainText("5º Ano");
  expect(await page.evaluate(() => window.__telas)).toEqual(["tela-professor-turmas"]);
});

test("visitante novo vê a tela inicial", async ({ page }) => {
  await salvarNoStorage(page, {});
  await page.reload();
  await expect(page.locator("#tela-turma")).toHaveClass(/ativa/);
});

test("recarregar durante o jogo volta para a mesma fase", async ({ page }) => {
  await salvarNoStorage(page, {
    calculoco_convidado: {
      ativo: true,
      progresso: [{ fase_numero: 1, concluida: true, pontos: 20 }],
    },
  });
  await page.reload();
  await page.locator('.nivel-btn[data-fase="2"]').click();
  await expect(page.locator("#pill-fase")).toHaveText("Adição · Nível 2 de 5");

  await gravarTelas(page);
  await page.reload();
  await expect(page.locator("#pill-fase")).toHaveText("Adição · Nível 2 de 5");
  expect(await page.evaluate(() => window.__telas)).toEqual(["tela-jogo"]);

  await page.locator("#btn-voltar-menu").click();
  await expect(page.locator("#texto-btn-sair")).toHaveText("Início");
  await page.reload();
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
});

test("recarregar no dashboard volta para o mesmo dashboard", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const professor = await api.criarProfessor();
  await api.criarTurma(professor, "Turma X");

  await salvarNoStorage(page, { calculoco_professor: professor });
  await page.reload();
  await page.locator(".cartao-turma", { hasText: "Turma X" }).click();
  await expect(page.locator("#dash-nome-turma")).toHaveText("Turma X");

  await page.reload();
  await expect(page.locator("#tela-professor-dashboard")).toHaveClass(/ativa/);
  await expect(page.locator("#dash-nome-turma")).toHaveText("Turma X");

  await page.locator("#btn-voltar-turmas").click();
  await expect(page.locator(".cartao-turma")).toHaveCount(1);
});
