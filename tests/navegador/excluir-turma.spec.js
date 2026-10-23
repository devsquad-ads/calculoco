const { test, expect } = require("@playwright/test");
const { criarClienteApi } = require("../apoio/api");

test("professor exclui turma pelo dashboard e ela some da lista", async ({ page, baseURL }) => {
  const api = criarClienteApi(baseURL);
  const professor = await api.criarProfessor("Ana");
  await api.criarTurma(professor, "Turma que fica");
  const turma = await api.criarTurma(professor, "Turma que sai");

  await page.goto("/");
  await page.getByRole("button", { name: "Sou professor(a)" }).click();
  await page.locator("#prof-campo-usuario").fill(professor.usuario);
  await page.locator("#prof-campo-senha").fill(professor.senha);
  await page.locator("#prof-btn-confirmar").click();

  await expect(page.locator(".cartao-turma")).toHaveCount(2);
  await page.locator(".cartao-turma", { hasText: "Turma que sai" }).click();
  await expect(page.locator("#dash-nome-turma")).toHaveText("Turma que sai");

  // 1º: cancela a confirmação, nada acontece.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Excluir turma" }).click();
  await expect(page.locator("#tela-professor-dashboard")).toHaveClass(/ativa/);

  // 2º: confirma, volta para a lista sem a turma excluída.
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain(turma.codigo);
    dialog.accept();
  });
  await page.getByRole("button", { name: "Excluir turma" }).click();

  await expect(page.locator("#tela-professor-turmas")).toHaveClass(/ativa/);
  await expect(page.locator("#toast")).toContainText("excluída");
  await expect(page.locator(".cartao-turma")).toHaveCount(1);
  await expect(page.locator(".cartao-turma")).toContainText("Turma que fica");

  // O código da turma excluída deixa de funcionar para os alunos.
  const { status } = await api.chamar(`/turmas/${turma.codigo}`);
  expect(status).toBe(404);
});
