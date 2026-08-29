/**
 * A resposta correta de cada pergunta nunca é enviada "em aberto" ao
 * navegador. Em vez disso, assinamos um token (HMAC-SHA256) contendo o
 * índice correto e um prazo de expiração. O cliente devolve esse token
 * junto com a resposta escolhida, e o backend valida a assinatura antes
 * de confirmar se acertou ou errou.
 */

const crypto = require("crypto");

const SEGREDO = process.env.QUESTION_SECRET || "troque_este_segredo_no_env";
const VALIDADE_MS = 5 * 60 * 1000; // 5 minutos

function assinarQuestao(payload) {
  const dados = { ...payload, exp: Date.now() + VALIDADE_MS };
  const base = Buffer.from(JSON.stringify(dados)).toString("base64url");
  const assinatura = crypto
    .createHmac("sha256", SEGREDO)
    .update(base)
    .digest("base64url");
  return `${base}.${assinatura}`;
}

function verificarToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [base, assinatura] = token.split(".");

  const esperado = crypto
    .createHmac("sha256", SEGREDO)
    .update(base)
    .digest("base64url");

  if (
    esperado.length !== assinatura.length ||
    !crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(assinatura))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(base, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { assinarQuestao, verificarToken };
