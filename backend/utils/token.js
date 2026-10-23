/**
 * Protege a questão enviada ao navegador. O payload (índice correto, fase,
 * hash do enunciado) é criptografado com AES-256-GCM usando uma chave
 * derivada de QUESTION_SECRET, então o cliente não consegue ler a resposta
 * certa nem forjar um token. Continua sem estado (nada é guardado no
 * servidor), o que é necessário para rodar como função serverless.
 */

const crypto = require("crypto");

const SEGREDO = process.env.QUESTION_SECRET || "troque_este_segredo_no_env";
const VALIDADE_MS = 5 * 60 * 1000; // 5 minutos
const chave = crypto.createHash("sha256").update(SEGREDO).digest();

function assinarQuestao(payload) {
  const dados = JSON.stringify({ ...payload, exp: Date.now() + VALIDADE_MS });
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const texto = Buffer.concat([cifra.update(dados, "utf8"), cifra.final()]);
  return [iv, texto, cifra.getAuthTag()].map((b) => b.toString("base64url")).join(".");
}

function verificarToken(token) {
  if (typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  try {
    const [iv, texto, tag] = partes.map((p) => Buffer.from(p, "base64url"));
    const decifra = crypto.createDecipheriv("aes-256-gcm", chave, iv);
    decifra.setAuthTag(tag);
    const aberto = Buffer.concat([decifra.update(texto), decifra.final()]).toString("utf8");
    const payload = JSON.parse(aberto);
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { assinarQuestao, verificarToken };
