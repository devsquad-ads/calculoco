/**
 * Sessão do professor. No login/cadastro o backend emite um token assinado
 * (HMAC-SHA256) com o id do professor; o navegador o guarda e reenvia no
 * header Authorization. As rotas protegidas tiram o professor_id do token,
 * em vez de confiar no id que o cliente manda no corpo da requisição — assim
 * ninguém acessa turmas de outro professor só por saber o UUID dele.
 */

const crypto = require("crypto");

const SEGREDO =
  process.env.SESSION_SECRET || process.env.QUESTION_SECRET || "troque_este_segredo_no_env";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function assinarSessao(payload) {
  const dados = { ...payload, exp: Date.now() + VALIDADE_MS };
  const base = Buffer.from(JSON.stringify(dados)).toString("base64url");
  const assinatura = crypto.createHmac("sha256", SEGREDO).update(base).digest("base64url");
  return `${base}.${assinatura}`;
}

function verificarSessao(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [base, assinatura] = token.split(".");

  const esperado = crypto.createHmac("sha256", SEGREDO).update(base).digest("base64url");
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

// Middleware: exige um token de professor válido e expõe req.professorId.
function exigirProfessor(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verificarSessao(token);

  if (!payload || !payload.professor_id) {
    return res.status(401).json({ erro: "Sessão expirada. Entre como professor novamente." });
  }
  req.professorId = payload.professor_id;
  next();
}

module.exports = { assinarSessao, verificarSessao, exigirProfessor };
