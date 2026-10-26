const { test, expect } = require("@playwright/test");
const { criarClienteApi } = require("../apoio/api");

const LARGURAS = [320, 360, 414, 540, 768, 1024, 1280];
const ALTURA = 760;

// Em cada largura: não pode haver rolagem horizontal e nenhum elemento pode
// ultrapassar a viewport. Devolve a lista de elementos que estouram (se houver).
async function auditar(page, nome) {
  const problemas = [];
  for (const largura of LARGURAS) {
    await page.setViewportSize({ width: largura, height: ALTURA });
    await page.waitForTimeout(80);
    const resultado = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const estouros = [];
      for (const el of document.querySelectorAll(".tela.ativa *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > w + 1 || r.left < -1) {
          estouros.push(
            `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} ` +
              `[${Math.round(r.left)}..${Math.round(r.right)} / ${w}]`
          );
        }
      }
      return {
        scrollW: document.documentElement.scrollWidth,
        clientW: w,
        estouros: [...new Set(estouros)].slice(0, 8),
      };
    });
    if (resultado.scrollW > resultado.clientW + 1) {
      problemas.push(`${nome} @${largura}px: rolagem horizontal (${resultado.scrollW}>${resultado.clientW})`);
    }
    for (const e of resultado.estouros) problemas.push(`${nome} @${largura}px: estoura ${e}`);
  }
  return problemas;
}

test("responsividade de todas as telas, de 320px a 1280px", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const professor = await api.criarProfessor("Professora Teste");
  const turma = await api.criarTurma(professor, "3º Ano B da Manhã");
  const aluno = await api.criarAluno(turma, "mariana-eduarda-cavalcanti", "1111");
  // Conclui as 20 fases das operações para liberar o desafio de conceitos no audit.
  for (let fase = 1; fase <= 20; fase++) {
    await api.chamar("/progresso", {
      method: "POST",
      corpo: { aluno_id: aluno.id, fase_numero: fase, concluida: true, pontos: 20 },
    });
  }

  const todos = [];

  await page.goto("/");
  await expect(page.locator("#tela-turma")).toHaveClass(/ativa/);
  todos.push(...(await auditar(page, "tela-turma")));

  await page.getByRole("button", { name: "Créditos" }).click();
  todos.push(...(await auditar(page, "tela-creditos")));
  await page.getByRole("button", { name: "Voltar" }).click();

  await page.getByRole("button", { name: "Sou professor(a)" }).click();
  todos.push(...(await auditar(page, "tela-professor-auth")));

  await page.locator("#prof-campo-usuario").fill(professor.usuario);
  await page.locator("#prof-campo-senha").fill(professor.senha);
  await page.locator("#prof-btn-confirmar").click();
  await expect(page.locator(".cartao-turma")).toHaveCount(1);
  todos.push(...(await auditar(page, "tela-professor-turmas")));

  await page.locator(".cartao-turma").click();
  await expect(page.locator("#tela-professor-dashboard")).toHaveClass(/ativa/);
  await expect(page.locator("#corpo-tabela-desempenho tr")).toHaveCount(1);
  todos.push(...(await auditar(page, "tela-professor-dashboard")));

  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.locator("#campo-codigo-turma").fill(turma.codigo);
  await page.getByRole("button", { name: "Entrar na turma" }).click();
  await expect(page.locator("#tela-auth")).toHaveClass(/ativa/);
  todos.push(...(await auditar(page, "tela-auth")));

  await page.locator("#campo-usuario").fill(aluno.nome_usuario);
  await page.locator("#campo-pin").fill("1111");
  await page.locator("#btn-confirmar-auth").click();
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
  todos.push(...(await auditar(page, "tela-menu")));

  await page.getByRole("button", { name: "Como jogar" }).click();
  await expect(page.locator("#dialogo-tutorial")).toBeVisible();
  for (const largura of LARGURAS) {
    await page.setViewportSize({ width: largura, height: ALTURA });
    await page.waitForTimeout(60);
    const r = await page.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth,
      dlg: document.getElementById("dialogo-tutorial").getBoundingClientRect(),
    }));
    if (r.s > r.c + 1) todos.push(`tutorial @${largura}px: rolagem horizontal (${r.s}>${r.c})`);
    if (r.dlg.right > r.c + 1 || r.dlg.left < -1) todos.push(`tutorial @${largura}px: dialog estoura`);
  }
  await page.locator("#btn-fechar-tutorial").click();

  await page.locator('.nivel-btn[data-fase="2"]').click();
  await expect(page.locator(".btn-opcao")).toHaveCount(4);
  todos.push(...(await auditar(page, "tela-jogo")));

  // Desafio de conceitos: opções são palavras longas ("Multiplicação").
  await page.locator("#btn-voltar-menu").click();
  await page.locator('.cartao-conceito .nivel-btn[data-fase="21"]').click();
  await expect(page.locator(".btn-opcao")).toHaveCount(4);
  todos.push(...(await auditar(page, "tela-jogo-conceito")));

  if (todos.length) console.log("PROBLEMAS DE RESPONSIVIDADE:\n" + todos.join("\n"));
  expect(todos, todos.join("\n")).toHaveLength(0);
});
