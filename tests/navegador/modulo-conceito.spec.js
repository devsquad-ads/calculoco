const { test, expect } = require("@playwright/test");
const { estadoConvidado } = require("../apoio/convidado");

async function abrirMenu(page, progresso = []) {
  await page.addInitScript((e) => {
    localStorage.clear();
    localStorage.setItem("calculoco_musica", "0");
    localStorage.setItem("calculoco_convidado", JSON.stringify(e));
  }, estadoConvidado(progresso));
  await page.goto("/");
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
}

test("o desafio de conceitos aparece separado e já está liberado desde o início", async ({ page }) => {
  await abrirMenu(page);

  // Fica fora da grade dos 4 módulos, na sua própria seção.
  await expect(page.locator(".area-conceito .cartao-conceito")).toBeVisible();
  await expect(page.locator("#secao-conceito")).toContainText("Qual é a conta?");

  // A 1ª fase do conceito (21) está liberada mesmo sem concluir as operações.
  await expect(page.locator('.cartao-conceito .nivel-btn[data-fase="21"]')).toBeEnabled();
  await expect(page.locator('.cartao-conceito .nivel-btn[data-fase="22"]')).toBeDisabled();
  // Enquanto a subtração (fase 6) continua bloqueada.
  await expect(page.locator('.nivel-btn[data-fase="6"]')).toBeDisabled();
});

test("jogar o conceito: acerta, salva o progresso e desbloqueia o próximo nível", async ({ page }) => {
  await abrirMenu(page);
  await page.route("**/api/fases/*/verificar", (r) => r.fulfill({ json: { correta: true, correctIndex: 0 } }));

  await page.locator('.cartao-conceito .nivel-btn[data-fase="21"]').click();
  await expect(page.locator("#pill-fase")).toHaveText("Conceitos · Nível 1 de 5");
  await expect(page.locator(".btn-opcao")).toHaveCount(4);
  await page.locator(".btn-opcao").first().click();

  await expect(page.locator("#texto-feedback")).toContainText("acertou");
  await expect(page.locator("#btn-proxima-fase")).toHaveText(/Próximo nível/);
  await page.locator("#btn-proxima-fase").click();
  await expect(page.locator("#pill-fase")).toHaveText("Conceitos · Nível 2 de 5");

  await page.locator("#btn-voltar-menu").click();
  await expect(page.locator('.cartao-conceito .nivel-btn[data-fase="21"]')).toHaveClass(/concluido/);
  await expect(page.locator('.cartao-conceito .nivel-btn[data-fase="22"]')).toBeEnabled();
  await expect(page.locator("#placar-estrelas .badge-pontos")).toHaveText(/^20/);
});

test("terminar a última operação não empurra para o conceito", async ({ page }) => {
  // fases 1..19 concluídas; joga a 20 (última da divisão).
  const progresso = Array.from({ length: 19 }, (_, i) => ({ fase_numero: i + 1, concluida: true, pontos: 20 }));
  await abrirMenu(page, progresso);
  await page.route("**/api/fases/*/verificar", (r) => r.fulfill({ json: { correta: true, correctIndex: 0 } }));

  await page.locator('.nivel-btn[data-fase="20"]').click();
  await page.locator(".btn-opcao").first().click();
  await expect(page.locator("#btn-proxima-fase")).toBeHidden();
  await expect(page.locator("#texto-feedback")).toContainText("todas as operações");
});
