const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { iniciarServidor } = require("../apoio/servidorTeste");
const { criarClienteApi } = require("../apoio/api");

let servidor, url, api;
const fetchOriginal = globalThis.fetch;
let chamadasAzure = [];
let respostaAzure;

before(async () => {
  const iniciado = await iniciarServidor();
  servidor = iniciado.servidor;
  url = iniciado.url;
  api = criarClienteApi(url);

  globalThis.fetch = async (destino, opcoes) => {
    if (String(destino).includes("tts.speech.microsoft.com")) {
      chamadasAzure.push({ destino: String(destino), opcoes });
      return respostaAzure();
    }
    return fetchOriginal(destino, opcoes);
  };
});

after(() => {
  globalThis.fetch = fetchOriginal;
  delete process.env.AZURE_SPEECH_KEY;
  delete process.env.AZURE_SPEECH_REGION;
  servidor.close();
});

async function novaQuestao() {
  return (await api.chamar("/fases/1/questao")).dados;
}

function pedirAudio(corpo) {
  return fetchOriginal(`${url}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

test("sem chave da Azure configurada o TTS fica indisponível", async () => {
  assert.deepEqual((await api.chamar("/tts/status")).dados, { disponivel: false });

  const questao = await novaQuestao();
  const resposta = await pedirAudio({ texto: questao.enunciado, questionToken: questao.questionToken });
  assert.equal(resposta.status, 503);
});

test("com a chave configurada, devolve o mp3 da Azure e guarda em cache", async () => {
  process.env.AZURE_SPEECH_KEY = "chave-teste";
  process.env.AZURE_SPEECH_REGION = "brazilsouth";
  chamadasAzure = [];
  respostaAzure = () => new Response(Buffer.from("mp3-falso"), { status: 200 });

  assert.deepEqual((await api.chamar("/tts/status")).dados, { disponivel: true });

  const questao = await novaQuestao();
  const corpo = { texto: questao.enunciado, questionToken: questao.questionToken };
  const resposta = await pedirAudio(corpo);

  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get("content-type"), "audio/mpeg");
  assert.equal(Buffer.from(await resposta.arrayBuffer()).toString(), "mp3-falso");

  const [chamada] = chamadasAzure;
  assert.equal(chamada.destino, "https://brazilsouth.tts.speech.microsoft.com/cognitiveservices/v1");
  assert.equal(chamada.opcoes.headers["Ocp-Apim-Subscription-Key"], "chave-teste");
  assert.match(chamada.opcoes.body, /<voice name="pt-BR-AntonioNeural">/);
  assert.match(chamada.opcoes.body, /<prosody rate="\+8%" pitch="\+12%">/);

  await pedirAudio(corpo);
  assert.equal(chamadasAzure.length, 1, "segunda leitura do mesmo texto vem do cache");
});

test("escapa o texto no SSML", () => {
  const { montarSsml } = require("../../backend/routes/tts");
  const ssml = montarSsml(`Ana & Léo têm <3> "balas"`, "pt-BR-AntonioNeural");
  assert.match(ssml, /Ana &amp; Léo têm &lt;3&gt; &quot;balas&quot;/);
});

test("recusa texto que não é o enunciado da questão", async () => {
  chamadasAzure = [];
  const questao = await novaQuestao();

  const outro = await pedirAudio({ texto: "Qualquer texto aleatório", questionToken: questao.questionToken });
  assert.equal(outro.status, 400);

  const semToken = await pedirAudio({ texto: questao.enunciado });
  assert.equal(semToken.status, 400);

  const tokenAdulterado = await pedirAudio({
    texto: questao.enunciado,
    questionToken: questao.questionToken.replace(/.$/, (c) => (c === "A" ? "B" : "A")),
  });
  assert.equal(tokenAdulterado.status, 400);

  assert.equal(chamadasAzure.length, 0);
});

test("cota esgotada na Azure: responde 503 e pausa o TTS para o frontend usar a voz do navegador", async () => {
  chamadasAzure = [];
  respostaAzure = () => new Response("Quota exceeded", { status: 403 });

  const questao = await novaQuestao();
  const resposta = await pedirAudio({ texto: questao.enunciado, questionToken: questao.questionToken });
  assert.equal(resposta.status, 503);
  assert.deepEqual((await api.chamar("/tts/status")).dados, { disponivel: false });

  const outra = await novaQuestao();
  await pedirAudio({ texto: outra.enunciado, questionToken: outra.questionToken });
  assert.equal(chamadasAzure.length, 1, "não fica chamando a Azure enquanto está pausado");
});
