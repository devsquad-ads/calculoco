const { test, expect } = require("@playwright/test");

// WAV de 0,3 s de silêncio, suficiente para o decodeAudioData do navegador.
function wavSilencioso(segundos = 0.3, taxa = 8000) {
  const amostras = Math.round(segundos * taxa);
  const buffer = Buffer.alloc(44 + amostras * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + amostras * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(taxa, 24);
  buffer.writeUInt32LE(taxa * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(amostras * 2, 40);
  return buffer;
}

// speechSynthesis falsa, com uma voz "natural" em pt-BR, que só registra o que falou.
async function simularVozNavegador(page) {
  await page.addInitScript(() => {
    window.__falas = [];
    const voz = { name: "Microsoft Antonio Online (Natural)", lang: "pt-BR" };
    class FalaFalsa {
      constructor(texto) { this.text = texto; }
    }
    window.SpeechSynthesisUtterance = FalaFalsa;
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [voz],
        addEventListener() {},
        cancel() {},
        speak(fala) {
          window.__falas.push({ texto: fala.text, voz: fala.voice?.name });
          setTimeout(() => fala.onend && fala.onend(), 50);
        },
      },
    });
  });
}

async function entrarNoJogo(page) {
  await page.addInitScript(() => {
    localStorage.setItem("calculoco_convidado", JSON.stringify({ ativo: true, progresso: [] }));
    localStorage.setItem("calculoco_musica", "0");
  });
  await page.goto("/");
  await page.locator('.nivel-btn[data-fase="1"]').click();
  await expect(page.locator(".btn-opcao")).toHaveCount(4);
}

test("lê o enunciado com o áudio do servidor (voz igual para todos)", async ({ page }) => {
  const pedidos = [];
  await page.route("**/api/tts/status", (r) => r.fulfill({ json: { disponivel: true } }));
  await page.route("**/api/tts", (r) => {
    pedidos.push(r.request().postDataJSON());
    r.fulfill({ status: 200, contentType: "audio/mpeg", body: wavSilencioso() });
  });
  await simularVozNavegador(page);
  await entrarNoJogo(page);

  const enunciado = await page.locator("#texto-enunciado").textContent();
  const botao = page.locator("#btn-ouvir-enunciado");
  await expect(botao).toBeVisible();

  await botao.click();
  await expect(botao).toHaveClass(/falando/);
  await expect(page.locator(".linha-mascote")).toHaveClass(/falando/);
  await expect(botao).not.toHaveClass(/falando/, { timeout: 3000 });

  expect(pedidos).toHaveLength(1);
  expect(pedidos[0].texto).toBe(enunciado);
  expect(pedidos[0].questionToken).toBeTruthy();
  expect(await page.evaluate(() => window.__falas)).toEqual([]);

  // Ouvir de novo a mesma pergunta não gasta outra requisição.
  await botao.click();
  await expect(botao).not.toHaveClass(/falando/, { timeout: 3000 });
  expect(pedidos).toHaveLength(1);
});

test("se a cota acabar, usa a voz do navegador", async ({ page }) => {
  await page.route("**/api/tts/status", (r) => r.fulfill({ json: { disponivel: true } }));
  await page.route("**/api/tts", (r) => r.fulfill({ status: 503, json: { erro: "indisponível" } }));
  await simularVozNavegador(page);
  await entrarNoJogo(page);

  await page.locator("#btn-ouvir-enunciado").click();
  await expect.poll(() => page.evaluate(() => window.__falas.length)).toBeGreaterThan(0);

  const falas = await page.evaluate(() => window.__falas);
  expect(falas[0].voz).toBe("Microsoft Antonio Online (Natural)");
  await expect(page.locator("#btn-ouvir-enunciado")).not.toHaveClass(/falando/);
});

test("sem TTS no servidor e sem voz boa no navegador, esconde o botão", async ({ page }) => {
  await page.route("**/api/tts/status", (r) => r.fulfill({ json: { disponivel: false } }));
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: { getVoices: () => [], addEventListener() {}, cancel() {}, speak() {} },
    });
  });
  await entrarNoJogo(page);
  await expect(page.locator("#btn-ouvir-enunciado")).toBeHidden();
});

test("trocar de pergunta durante a leitura interrompe a fala", async ({ page }) => {
  await page.route("**/api/tts/status", (r) => r.fulfill({ json: { disponivel: true } }));
  await page.route("**/api/tts", (r) =>
    r.fulfill({ status: 200, contentType: "audio/mpeg", body: wavSilencioso(3) })
  );
  await page.route("**/api/fases/*/verificar", (r) => r.fulfill({ json: { correta: false, correctIndex: 0 } }));
  await entrarNoJogo(page);

  const botao = page.locator("#btn-ouvir-enunciado");
  await botao.click();
  await expect(botao).toHaveClass(/falando/);

  await page.locator(".btn-opcao").nth(1).click();
  await page.locator("#btn-tentar-novamente").click();
  await expect(botao).not.toHaveClass(/falando/);
});
