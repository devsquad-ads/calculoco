const express = require("express");
const router = express.Router();
const { gerarQuestao } = require("../utils/perguntas");
const { assinarQuestao, verificarToken } = require("../utils/token");

// 4 módulos (adição, subtração, multiplicação, divisão) x 5 níveis cada.
// fase 1-5 = adição níveis 1-5, fase 6-10 = subtração níveis 1-5, etc.
const TOTAL_FASES = 20;

function decompoeFase(numero) {
  const modulo = Math.ceil(numero / 5);
  const nivel = numero - (modulo - 1) * 5;
  return { modulo, nivel };
}

// GET /api/fases/:numero/questao
router.get("/:numero/questao", (req, res) => {
  const numero = parseInt(req.params.numero, 10);

  if (!Number.isInteger(numero) || numero < 1 || numero > TOTAL_FASES) {
    return res.status(404).json({
      erro: "Esta fase ainda está em construção. Volte em breve!",
    });
  }

  const { modulo, nivel } = decompoeFase(numero);
  const questao = gerarQuestao(modulo, nivel);

  if (!questao) {
    return res.status(404).json({ erro: "Fase inválida." });
  }

  const { enunciado, opcoes, correctIndex, operacao, contexto } = questao;
  const questionToken = assinarQuestao({ correctIndex, operacao, fase: numero });

  res.json({ enunciado, opcoes, contexto, questionToken });
});

// POST /api/fases/:numero/verificar  { questionToken, resposta }
router.post("/:numero/verificar", (req, res) => {
  const { questionToken, resposta } = req.body;

  const payload = verificarToken(questionToken);
  if (!payload) {
    return res.status(400).json({
      erro: "Questão expirada ou inválida. Peça uma nova pergunta.",
    });
  }

  const correta = payload.correctIndex === resposta;
  res.json({ correta, correctIndex: payload.correctIndex });
});

module.exports = router;
