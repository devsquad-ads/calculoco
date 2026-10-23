const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { iniciarServidor } = require("../apoio/servidorTeste");
const { criarClienteApi } = require("../apoio/api");

let servidor, api;

before(async () => {
  const iniciado = await iniciarServidor();
  servidor = iniciado.servidor;
  api = criarClienteApi(iniciado.url);
});

after(() => servidor.close());

async function salvar(aluno, fase, pontos, concluida = true) {
  return api.chamar("/progresso", {
    method: "POST",
    corpo: { aluno_id: aluno.id, fase_numero: fase, concluida, pontos },
  });
}

async function pontosDaFase(aluno, fase) {
  const { dados } = await api.chamar(`/progresso/${aluno.id}`);
  return dados.progresso.find((p) => p.fase_numero === fase);
}

test("refazer um nível com pontuação menor mantém a maior (não diminui)", async () => {
  const prof = await api.criarProfessor();
  const turma = await api.criarTurma(prof);
  const aluno = await api.criarAluno(turma);

  await salvar(aluno, 1, 20); // acertou de primeira
  await salvar(aluno, 1, 5); // refez e foi pior
  assert.equal((await pontosDaFase(aluno, 1)).pontos, 20);

  await salvar(aluno, 1, 10); // refez, melhor que 5 mas pior que 20
  assert.equal((await pontosDaFase(aluno, 1)).pontos, 20);
});

test("refazer melhor sobe a pontuação", async () => {
  const prof = await api.criarProfessor();
  const turma = await api.criarTurma(prof);
  const aluno = await api.criarAluno(turma);

  await salvar(aluno, 1, 5);
  await salvar(aluno, 1, 20);
  assert.equal((await pontosDaFase(aluno, 1)).pontos, 20);
});

test("uma fase concluída não volta a ficar não-concluída", async () => {
  const prof = await api.criarProfessor();
  const turma = await api.criarTurma(prof);
  const aluno = await api.criarAluno(turma);

  await salvar(aluno, 1, 20, true);
  await salvar(aluno, 1, 0, false);
  assert.equal((await pontosDaFase(aluno, 1)).concluida, true);
});
