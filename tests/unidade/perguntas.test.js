const { test } = require("node:test");
const assert = require("node:assert/strict");
const { gerarQuestao } = require("../../backend/utils/perguntas");

const AMOSTRAS = 400;

// Contextos permitidos por módulo (devem casar com o cenário/tema do módulo).
const CONTEXTOS = {
  1: new Set(["praia", "aquario"]),
  2: new Set(["mercado", "casa"]),
  3: new Set(["parque", "fazenda"]),
  4: new Set(["parque", "fazenda"]),
};

// Faixa esperada da resposta por módulo/nível (reflete as faixas do gerador).
const LIMITES = {
  1: [[2, 12], [8, 22], [18, 36], [30, 60], [50, 100]],
  3: [[4, 25], [6, 36], [12, 64], [24, 81], [42, 120]],
  4: [[2, 5], [2, 6], [3, 8], [4, 9], [6, 12]],
};
const SUB_MAX_MINUENDO = [9, 16, 26, 42, 65];

function amostrar(modulo, nivel) {
  return Array.from({ length: AMOSTRAS }, () => {
    const q = gerarQuestao(modulo, nivel);
    return { ...q, resposta: Number(q.opcoes[q.correctIndex]) };
  });
}

test("cada questão é bem formada: 4 opções distintas e um índice correto válido", () => {
  for (let modulo = 1; modulo <= 4; modulo++) {
    for (let nivel = 1; nivel <= 5; nivel++) {
      for (const q of amostrar(modulo, nivel)) {
        assert.equal(q.opcoes.length, 4);
        assert.equal(new Set(q.opcoes).size, 4, `opções repetidas: ${q.opcoes}`);
        assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
        assert.ok(Number.isInteger(q.resposta) && q.resposta >= 0);
        assert.ok(q.enunciado.trim().length > 0);
      }
    }
  }
});

test("cada módulo só usa contextos coerentes com o seu tema", () => {
  for (let modulo = 1; modulo <= 4; modulo++) {
    for (let nivel = 1; nivel <= 5; nivel++) {
      for (const q of amostrar(modulo, nivel)) {
        assert.ok(
          CONTEXTOS[modulo].has(q.contexto),
          `módulo ${modulo} usou contexto fora do tema: ${q.contexto}`
        );
      }
    }
  }
});

test("o Mercado da Subtração não fala de aluno, professor nem escola", () => {
  for (let nivel = 1; nivel <= 5; nivel++) {
    for (const q of amostrar(2, nivel)) {
      assert.doesNotMatch(
        q.enunciado,
        /aluno|professor|escola|turma|sala de aula/i,
        `enunciado fora do tema de mercado: "${q.enunciado}"`
      );
    }
  }
});

test("nunca aparece concordância '1 ...s' (plural com quantidade 1)", () => {
  for (let modulo = 1; modulo <= 4; modulo++) {
    for (let nivel = 1; nivel <= 5; nivel++) {
      for (const q of amostrar(modulo, nivel)) {
        assert.doesNotMatch(
          q.enunciado,
          /\b1 [a-zà-ú]+s\b/i,
          `plural indevido com 1: "${q.enunciado}"`
        );
      }
    }
  }
});

test("dentro de cada nível, as respostas ficam na faixa esperada (sem saltos bruscos)", () => {
  for (const modulo of [1, 3, 4]) {
    for (let nivel = 1; nivel <= 5; nivel++) {
      const [min, max] = LIMITES[modulo][nivel - 1];
      for (const { resposta } of amostrar(modulo, nivel)) {
        assert.ok(
          resposta >= min && resposta <= max,
          `módulo ${modulo} nível ${nivel}: resposta ${resposta} fora de [${min}, ${max}]`
        );
      }
    }
  }
});

test("subtração: resultado positivo e coerente com o minuendo do nível", () => {
  for (let nivel = 1; nivel <= 5; nivel++) {
    for (const { resposta } of amostrar(2, nivel)) {
      assert.ok(resposta >= 1, "subtração não pode dar zero ou negativo");
      assert.ok(resposta < SUB_MAX_MINUENDO[nivel - 1], "resposta maior que o minuendo do nível");
    }
  }
});

test("a dificuldade sobe de forma gradual a cada nível (média crescente)", () => {
  for (let modulo = 1; modulo <= 4; modulo++) {
    const medias = [];
    for (let nivel = 1; nivel <= 5; nivel++) {
      const amostras = amostrar(modulo, nivel);
      medias.push(amostras.reduce((s, q) => s + q.resposta, 0) / amostras.length);
    }
    for (let i = 1; i < medias.length; i++) {
      assert.ok(
        medias[i] > medias[i - 1],
        `módulo ${modulo}: nível ${i + 1} (média ${medias[i].toFixed(1)}) não é mais difícil que o ${i} (${medias[i - 1].toFixed(1)})`
      );
    }
  }
});
