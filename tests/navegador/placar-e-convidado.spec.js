const { test, expect } = require("@playwright/test");
const { seloConvidado: selo, estadoConvidado } = require("../apoio/convidado");

async function entrarComoConvidado(page, estado) {
  await page.addInitScript((e) => {
    localStorage.clear();
    localStorage.setItem("calculoco_musica", "0");
    if (e) localStorage.setItem("calculoco_convidado", JSON.stringify(e));
  }, estado);
  await page.goto("/");
}

test("o menu mostra o total de estrelas do aluno", async ({ page }) => {
  const progresso = [
    { fase_numero: 1, concluida: true, pontos: 20 },
    { fase_numero: 2, concluida: true, pontos: 10 },
  ];
  await entrarComoConvidado(page, estadoConvidado(progresso));
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
  await expect(page.locator("#placar-estrelas")).toContainText("Suas estrelas:");
  await expect(page.locator("#placar-estrelas .badge-pontos")).toHaveText(/^30/);
});

test("progresso de convidado adulterado no localStorage é ignorado", async ({ page }) => {
  // Alguém editou os pontos à mão, sem recalcular o selo.
  const adulterado = {
    ativo: true,
    progresso: [{ fase_numero: 1, concluida: true, pontos: 9999 }],
    selo: selo([{ fase_numero: 1, concluida: true, pontos: 20 }]),
  };
  await entrarComoConvidado(page, adulterado);
  await expect(page.locator("#tela-menu")).toHaveClass(/ativa/);
  // Selo não bate: progresso descartado, placar zera e só a fase 1 fica liberada.
  await expect(page.locator("#placar-estrelas .badge-pontos")).toHaveText(/^0/);
  await expect(page.locator('.nivel-btn[data-fase="2"]')).toBeDisabled();
});

test("refazer um nível não diminui o recorde e mostra mensagem coerente", async ({ page }) => {
  // Fase 1 já concluída com 20; fase 2 liberada.
  const progresso = [{ fase_numero: 1, concluida: true, pontos: 20 }];
  await entrarComoConvidado(page, estadoConvidado(progresso));

  // Força errar uma vez (p/ cair na 2ª tentativa = 10 pts) e depois acertar.
  let acertos = 0;
  await page.route("**/api/fases/*/verificar", (r) => {
    acertos += 1;
    r.fulfill({ json: { correta: acertos >= 2, correctIndex: 0 } });
  });

  await page.locator('.nivel-btn[data-fase="1"]').click();
  await page.locator(".btn-opcao").first().click(); // erra
  await expect(page.locator("#btn-tentar-novamente")).toBeVisible();
  await page.locator("#btn-tentar-novamente").click();
  await expect(page.locator(".btn-opcao")).toHaveCount(4);
  await page.locator(".btn-opcao").first().click(); // acerta (2ª tentativa = 10)

  // Recorde era 20; refez com 10 → mantém 20 e avisa que o recorde continua.
  await expect(page.locator("#texto-feedback")).toContainText("recorde continua");
  await page.locator("#btn-menu-fim").click();
  await expect(page.locator("#placar-estrelas .badge-pontos")).toHaveText(/^20/);
});
