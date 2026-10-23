const { test, expect } = require("@playwright/test");
const { estadoConvidado } = require("../apoio/convidado");

// Fixa o resultado da verificação (a alternativa certa é sorteada).
async function simularResposta(page, correta) {
  await page.route("**/api/fases/*/verificar", (route) =>
    route.fulfill({ json: { correta, correctIndex: 0 } })
  );
}

async function jogarSemLogin(page, progresso = []) {
  await page.addInitScript((dados) => {
    localStorage.setItem("calculoco_convidado", JSON.stringify(dados));
  }, estadoConvidado(progresso));
  await page.goto("/");
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
}

async function acertarPergunta(page) {
  await expect(page.locator(".btn-opcao")).toHaveCount(4);
  await page.locator(".btn-opcao").first().click();
}

test("ao acertar, mostra 'Próximo nível' e vai direto para a fase seguinte", async ({ page }) => {
  await simularResposta(page, true);
  await jogarSemLogin(page);

  await page.locator('.nivel-btn[data-fase="1"]').click();
  await expect(page.locator("#pill-fase")).toHaveText("Adição · Nível 1 de 5");
  await acertarPergunta(page);

  const proxima = page.locator("#btn-proxima-fase");
  await expect(proxima).toBeVisible();
  await expect(proxima).toHaveText(/Próximo nível/);
  await expect(page.locator("#btn-menu-fim")).toBeVisible();

  await proxima.click();
  await expect(page.locator("#tela-jogo")).toHaveClass(/ativa/);
  await expect(page.locator("#pill-fase")).toHaveText("Adição · Nível 2 de 5");
  await expect(proxima).toBeHidden();
});

test("no último nível do módulo, o botão leva para o próximo módulo", async ({ page }) => {
  await simularResposta(page, true);
  const concluidas = [1, 2, 3, 4].map((n) => ({ fase_numero: n, concluida: true, pontos: 20 }));
  await jogarSemLogin(page, concluidas);

  await page.locator('.nivel-btn[data-fase="5"]').click();
  await acertarPergunta(page);

  await expect(page.locator("#btn-proxima-fase")).toHaveText(/Ir para Mercado da Subtração/);
  await page.locator("#btn-proxima-fase").click();
  await expect(page.locator("#pill-fase")).toHaveText("Subtração · Nível 1 de 5");
});

test("na última fase das operações só aparece a volta ao menu", async ({ page }) => {
  await simularResposta(page, true);
  const concluidas = Array.from({ length: 19 }, (_, i) => ({
    fase_numero: i + 1, concluida: true, pontos: 20,
  }));
  await jogarSemLogin(page, concluidas);

  await page.locator('.nivel-btn[data-fase="20"]').click();
  await acertarPergunta(page);

  await expect(page.locator("#btn-proxima-fase")).toBeHidden();
  await expect(page.locator("#texto-feedback")).toContainText("todas as operações");
  await page.locator("#btn-menu-fim").click();
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
  await expect(page.locator('.nivel-btn[data-fase="20"]')).toHaveClass(/concluido/);
});

test("ao errar, não mostra o botão de próxima fase", async ({ page }) => {
  await simularResposta(page, false);
  await jogarSemLogin(page);

  await page.locator('.nivel-btn[data-fase="1"]').click();
  await acertarPergunta(page);

  await expect(page.locator("#btn-tentar-novamente")).toBeVisible();
  await expect(page.locator("#acoes-fim-fase")).toBeHidden();
});

test("voltar pelo topo depois de acertar atualiza o menu com o nível concluído", async ({ page }) => {
  await simularResposta(page, true);
  await jogarSemLogin(page);

  await page.locator('.nivel-btn[data-fase="1"]').click();
  await acertarPergunta(page);
  await expect(page.locator("#acoes-fim-fase")).toBeVisible();

  await page.locator("#btn-voltar-menu").click();
  await expect(page.locator('.nivel-btn[data-fase="1"]')).toHaveClass(/concluido/);
  await expect(page.locator('.nivel-btn[data-fase="2"]')).toBeEnabled();
});
