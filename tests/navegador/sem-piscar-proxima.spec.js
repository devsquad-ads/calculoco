const { test, expect } = require("@playwright/test");

async function jogar(page, correta) {
  await page.route("**/api/fases/*/verificar", (r) => r.fulfill({ json: { correta, correctIndex: 0 } }));
  await page.addInitScript(() => {
    localStorage.setItem("calculoco_convidado", JSON.stringify({ ativo: true, progresso: [] }));
    localStorage.setItem("calculoco_musica", "0");
  });
  await page.goto("/");
}

test("avançar de fase não reexecuta a animação de tela nem mostra 'Carregando'", async ({ page }) => {
  await jogar(page, true);
  // atrasa a questão para flagrar qualquer estado intermediário visível
  await page.route("**/api/fases/*/questao", async (r) => {
    await new Promise((s) => setTimeout(s, 300));
    r.continue();
  });

  await page.locator('.nivel-btn[data-fase="1"]').click();
  await expect(page.locator(".btn-opcao")).toHaveCount(4);

  // observa reinícios de animação da tela de jogo e o texto "Carregando"
  await page.evaluate(() => {
    window.__anim = 0;
    window.__carregouVisivel = false;
    document.getElementById("tela-jogo").addEventListener("animationstart", () => (window.__anim += 1));
  });

  await page.locator(".btn-opcao").first().click();
  await expect(page.locator("#btn-proxima-fase")).toBeVisible();

  const enunciadoAntes = await page.locator("#texto-enunciado").textContent();
  await page.locator("#btn-proxima-fase").click();

  // durante o carregamento o card fica esmaecido, com a pergunta anterior ainda visível
  await expect(page.locator(".cartao-pergunta")).toHaveClass(/carregando/);
  await expect(page.locator("#texto-enunciado")).toHaveText(enunciadoAntes);
  await expect(page.locator("#tela-jogo")).toHaveClass(/ativa/);

  await expect(page.locator(".cartao-pergunta")).not.toHaveClass(/carregando/, { timeout: 3000 });
  await expect(page.locator("#pill-fase")).toHaveText("Adição · Nível 2 de 5");
  await expect(page.locator("#texto-enunciado")).not.toHaveText("Carregando pergunta...");
  expect(await page.evaluate(() => window.__anim)).toBe(0);
});
