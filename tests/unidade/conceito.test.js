const { test } = require("node:test");
const assert = require("node:assert/strict");
const { gerarQuestao, TOTAL_FASES } = require("../../backend/utils/perguntas");

const OPERACOES = ["Adição", "Subtração", "Multiplicação", "Divisão"];
const AMOSTRAS = 300;

test("o jogo agora tem 25 fases (20 operações + 5 conceitos)", () => {
  assert.equal(TOTAL_FASES, 25);
});

test("o módulo de conceitos gera perguntas bem formadas em todos os níveis", () => {
  for (let nivel = 1; nivel <= 5; nivel++) {
    for (let i = 0; i < AMOSTRAS; i++) {
      const q = gerarQuestao(5, nivel);
      assert.equal(q.operacao, "conceito");
      assert.equal(q.opcoes.length, 4);
      assert.equal(new Set(q.opcoes).size, 4, `opções repetidas: ${q.opcoes}`);
      assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
      assert.ok(q.enunciado.trim().length > 0);
      // a resposta correta é sempre uma das opções mostradas
      assert.ok(q.opcoes[q.correctIndex]);
    }
  }
});

test("as perguntas de conceito não pedem para calcular (sem números como resposta)", () => {
  for (let nivel = 1; nivel <= 5; nivel++) {
    for (let i = 0; i < AMOSTRAS; i++) {
      const q = gerarQuestao(5, nivel);
      for (const opcao of q.opcoes) {
        assert.ok(Number.isNaN(Number(opcao)), `opção numérica inesperada: "${opcao}"`);
      }
    }
  }
});

test("quando a resposta é uma operação, as 4 opções são exatamente as 4 operações", () => {
  for (let nivel = 1; nivel <= 5; nivel++) {
    for (let i = 0; i < AMOSTRAS; i++) {
      const q = gerarQuestao(5, nivel);
      const ehOperacao = OPERACOES.includes(q.opcoes[q.correctIndex]);
      if (ehOperacao) {
        assert.deepEqual([...q.opcoes].sort(), [...OPERACOES].sort());
      }
    }
  }
});

test("o contexto das perguntas de conceito é sempre um contexto válido", () => {
  const validos = new Set(["casa", "fazenda", "escola", "festa", "mercado", "aquario", "parque", "praia"]);
  for (let nivel = 1; nivel <= 5; nivel++) {
    for (let i = 0; i < AMOSTRAS; i++) {
      assert.ok(validos.has(gerarQuestao(5, nivel).contexto));
    }
  }
});
