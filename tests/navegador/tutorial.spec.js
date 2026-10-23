const { test, expect } = require("@playwright/test");

async function abrirMenuConvidado(page, extras = {}) {
  await page.addInitScript((extras) => {
    if (sessionStorage.getItem("__iniciado")) return;
    sessionStorage.setItem("__iniciado", "1");
    localStorage.clear();
    localStorage.setItem("calculoco_convidado", JSON.stringify({ ativo: true, progresso: [] }));
    for (const [chave, valor] of Object.entries(extras)) localStorage.setItem(chave, valor);
  }, extras);
  await page.goto("/");
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
}

test("tutorial não abre sozinho e o botão chama atenção só na primeira vez", async ({ page }) => {
  await abrirMenuConvidado(page);

  await expect(page.locator("#dialogo-tutorial")).not.toBeVisible();
  await expect(page.locator("#btn-como-jogar")).toHaveClass(/destaque/);

  await page.getByRole("button", { name: "Como jogar" }).click();
  await expect(page.locator("#dialogo-tutorial")).toBeVisible();
  await expect(page.locator("#btn-como-jogar")).not.toHaveClass(/destaque/);

  await page.locator("#btn-fechar-tutorial").click();
  await page.reload();
  await expect(page.locator("#btn-como-jogar")).not.toHaveClass(/destaque/);
});

test("navega por todos os passos e fecha no último", async ({ page }) => {
  await abrirMenuConvidado(page);
  await page.getByRole("button", { name: "Como jogar" }).click();

  const dialogo = page.locator("#dialogo-tutorial");
  await expect(dialogo.locator("#passo-tutorial")).toHaveText("Passo 1 de 5");
  await expect(page.locator("#btn-tutorial-voltar")).toBeHidden();

  await page.locator("#btn-tutorial-proximo").click();
  await expect(dialogo.locator("#titulo-tutorial")).toHaveText("Ouça a pergunta");
  await page.locator("#btn-tutorial-voltar").click();
  await expect(dialogo.locator("#passo-tutorial")).toHaveText("Passo 1 de 5");

  for (let i = 0; i < 4; i++) await page.locator("#btn-tutorial-proximo").click();
  await expect(dialogo.locator("#passo-tutorial")).toHaveText("Passo 5 de 5");
  await expect(page.locator("#btn-tutorial-proximo")).toHaveText("Vamos jogar!");

  await page.locator("#btn-tutorial-proximo").click();
  await expect(dialogo).not.toBeVisible();
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
});

test("fecha com Esc e com clique fora, e reabre no passo 1", async ({ page }) => {
  await abrirMenuConvidado(page, { calculoco_tutorial_visto: "1" });
  const dialogo = page.locator("#dialogo-tutorial");

  await page.getByRole("button", { name: "Como jogar" }).click();
  await page.locator("#btn-tutorial-proximo").click();
  await page.keyboard.press("Escape");
  await expect(dialogo).not.toBeVisible();

  await page.getByRole("button", { name: "Como jogar" }).click();
  await expect(dialogo.locator("#passo-tutorial")).toHaveText("Passo 1 de 5");
  await page.mouse.click(5, 5);
  await expect(dialogo).not.toBeVisible();
});

test("botão cabe no topo em tela de celular", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abrirMenuConvidado(page);
  await expect(page.locator("#btn-como-jogar")).toBeInViewport();
  await page.getByRole("button", { name: "Como jogar" }).click();
});
