const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.QUESTION_SECRET = "segredo-de-teste";
const { assinarQuestao, verificarToken } = require("../../backend/routes/../utils/token");

test("o token devolve o payload original para o backend", () => {
  const token = assinarQuestao({ correctIndex: 2, operacao: "Adição", fase: 1, h: "abc" });
  assert.deepEqual(
    (({ correctIndex, operacao, fase, h }) => ({ correctIndex, operacao, fase, h }))(
      verificarToken(token)
    ),
    { correctIndex: 2, operacao: "Adição", fase: 1, h: "abc" }
  );
});

test("o índice correto não aparece em texto aberto no token", () => {
  const token = assinarQuestao({ correctIndex: 3, operacao: "Divisão", fase: 20, h: "x" });
  const aberto = token
    .split(".")
    .map((p) => Buffer.from(p, "base64url").toString("latin1"))
    .join("");
  assert.ok(!aberto.includes("correctIndex"), "não deve expor a chave do payload");
  assert.ok(!aberto.includes("Divisão"), "não deve expor o conteúdo do payload");
});

test("token adulterado é recusado", () => {
  const token = assinarQuestao({ correctIndex: 1, operacao: "Soma", fase: 1, h: "x" });
  const [iv, texto, tag] = token.split(".");
  const trocado = texto[0] === "A" ? "B" : "A";
  assert.equal(verificarToken(`${iv}.${trocado}${texto.slice(1)}.${tag}`), null);
  assert.equal(verificarToken("qualquer-coisa"), null);
  assert.equal(verificarToken(""), null);
});

test("token expirado é recusado", () => {
  const original = Date.now;
  const token = assinarQuestao({ correctIndex: 0, operacao: "Soma", fase: 1, h: "x" });
  try {
    Date.now = () => original() + 6 * 60 * 1000; // 6 min depois (validade é 5)
    assert.equal(verificarToken(token), null);
  } finally {
    Date.now = original;
  }
});
