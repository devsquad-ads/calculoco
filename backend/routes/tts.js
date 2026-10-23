const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { verificarToken } = require("../utils/token");

// Azure Speech no plano gratuito (F0): sem cobrança, quando a cota do mês
// acaba a Azure recusa as requisições e o frontend cai na voz do navegador.
const VOZ_PADRAO = "pt-BR-AntonioNeural";
const TAMANHO_MAXIMO = 500;
const MAX_CACHE = 200;

const cacheAudio = new Map();
let pausadoAte = 0;

function hashTexto(texto) {
  return crypto.createHash("sha256").update(texto).digest("base64url");
}

function configurado() {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

function disponivel() {
  return configurado() && Date.now() >= pausadoAte;
}

function escaparXml(texto) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Tom um pouco mais agudo e ritmo mais rápido deixam a voz mais jovem e animada.
function montarSsml(texto, voz) {
  return (
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">' +
    `<voice name="${voz}"><prosody rate="+8%" pitch="+12%">${escaparXml(texto)}</prosody></voice>` +
    "</speak>"
  );
}

async function sintetizar(texto, voz) {
  const resposta = await fetch(
    `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "calculoco",
      },
      body: montarSsml(texto, voz),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!resposta.ok) {
    // 401/403: chave inválida ou cota do F0 esgotada. 429/5xx: limite momentâneo.
    const longo = resposta.status === 401 || resposta.status === 403;
    pausadoAte = Date.now() + (longo ? 10 * 60 * 1000 : 30 * 1000);
    console.warn(`[tts] Azure respondeu ${resposta.status}, usando a voz do navegador por enquanto`);
    return null;
  }

  return Buffer.from(await resposta.arrayBuffer());
}

// GET /api/tts/status
router.get("/status", (req, res) => {
  res.json({ disponivel: disponivel() });
});

// POST /api/tts  { texto, questionToken }
// Só lê enunciados gerados pelo próprio backend (o hash do texto vai no
// token da questão), para ninguém gastar a cota com texto qualquer.
router.post("/", async (req, res) => {
  const { texto, questionToken } = req.body || {};

  if (!disponivel()) {
    return res.status(503).json({ erro: "Leitura em voz alta indisponível no momento." });
  }

  const payload = verificarToken(questionToken);
  if (
    typeof texto !== "string" ||
    texto.length > TAMANHO_MAXIMO ||
    !payload ||
    payload.h !== hashTexto(texto)
  ) {
    return res.status(400).json({ erro: "Texto inválido para leitura." });
  }

  const voz = process.env.AZURE_SPEECH_VOICE || VOZ_PADRAO;
  const chaveCache = hashTexto(`${voz}|${texto}`);
  let audio = cacheAudio.get(chaveCache);

  if (!audio) {
    try {
      audio = await sintetizar(texto, voz);
    } catch (erro) {
      console.warn(`[tts] falha ao chamar a Azure: ${erro.message}`);
      audio = null;
    }
    if (!audio) {
      return res.status(503).json({ erro: "Leitura em voz alta indisponível no momento." });
    }
    cacheAudio.set(chaveCache, audio);
    if (cacheAudio.size > MAX_CACHE) cacheAudio.delete(cacheAudio.keys().next().value);
  }

  res.set("Content-Type", "audio/mpeg");
  res.set("Cache-Control", "no-store");
  res.send(audio);
});

module.exports = router;
module.exports.hashTexto = hashTexto;
module.exports.montarSsml = montarSsml;
