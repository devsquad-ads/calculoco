const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { iniciarServidor } = require("../apoio/servidorTeste");
const { criarClienteApi } = require("../apoio/api");

let servidor, supabase, api;

before(async () => {
  const iniciado = await iniciarServidor();
  servidor = iniciado.servidor;
  supabase = iniciado.supabase;
  api = criarClienteApi(iniciado.url);
});

after(() => servidor.close());

test("professor exclui a própria turma só de forma lógica (a linha continua no banco)", async () => {
  const professor = await api.criarProfessor();
  const turma = await api.criarTurma(professor);
  const aluno = await api.criarAluno(turma);

  const { status, dados } = await api.chamar(`/turmas/${turma.id}`, {
    method: "DELETE",
    corpo: { professor_id: professor.id },
  });

  assert.equal(status, 200);
  assert.deepEqual(dados, { ok: true });

  const linha = supabase.tabelas.turmas.find((t) => t.id === turma.id);
  assert.ok(linha, "a turma não pode ser apagada do banco");
  assert.ok(linha.excluida_em, "excluida_em deve ser preenchido");
  assert.ok(supabase.tabelas.alunos.some((a) => a.id === aluno.id), "alunos continuam salvos");
});

test("turma excluída some da lista do professor, mas as outras continuam", async () => {
  const professor = await api.criarProfessor();
  const fica = await api.criarTurma(professor, "Fica");
  const sai = await api.criarTurma(professor, "Sai");

  await api.chamar(`/turmas/${sai.id}`, { method: "DELETE", corpo: { professor_id: professor.id } });

  const { dados } = await api.chamar(`/professores/${professor.id}/turmas`);
  assert.deepEqual(dados.turmas.map((t) => t.id), [fica.id]);
});

test("código de turma excluída não serve mais para entrar, logar nem se cadastrar", async () => {
  const professor = await api.criarProfessor();
  const turma = await api.criarTurma(professor);
  const aluno = await api.criarAluno(turma, "maria", "2222");

  await api.chamar(`/turmas/${turma.id}`, { method: "DELETE", corpo: { professor_id: professor.id } });

  assert.equal((await api.chamar(`/turmas/${turma.codigo}`)).status, 404);

  const login = await api.chamar("/auth/login", {
    method: "POST",
    corpo: { codigo_turma: turma.codigo, nome_usuario: aluno.nome_usuario, pin: "2222" },
  });
  assert.equal(login.status, 404);

  const cadastro = await api.chamar("/auth/cadastro", {
    method: "POST",
    corpo: { codigo_turma: turma.codigo, nome_usuario: "novo", pin: "3333" },
  });
  assert.equal(cadastro.status, 404);
});

test("dashboard e redefinição de PIN não funcionam em turma excluída", async () => {
  const professor = await api.criarProfessor();
  const turma = await api.criarTurma(professor);
  const aluno = await api.criarAluno(turma);

  await api.chamar(`/turmas/${turma.id}`, { method: "DELETE", corpo: { professor_id: professor.id } });

  const dash = await api.chamar(`/turmas/${turma.id}/desempenho?professor_id=${professor.id}`);
  assert.equal(dash.status, 404);

  const pin = await api.chamar(`/turmas/${turma.id}/alunos/${aluno.id}/redefinir-pin`, {
    method: "POST",
    corpo: { professor_id: professor.id },
  });
  assert.equal(pin.status, 404);
});

test("outro professor não pode excluir a turma", async () => {
  const dono = await api.criarProfessor();
  const intruso = await api.criarProfessor();
  const turma = await api.criarTurma(dono);

  const semId = await api.chamar(`/turmas/${turma.id}`, { method: "DELETE", corpo: {} });
  assert.equal(semId.status, 403);

  const outro = await api.chamar(`/turmas/${turma.id}`, {
    method: "DELETE",
    corpo: { professor_id: intruso.id },
  });
  assert.equal(outro.status, 403);

  const linha = supabase.tabelas.turmas.find((t) => t.id === turma.id);
  assert.equal(linha.excluida_em, null);
});

test("excluir de novo uma turma já excluída responde 404", async () => {
  const professor = await api.criarProfessor();
  const turma = await api.criarTurma(professor);
  const corpo = { professor_id: professor.id };

  await api.chamar(`/turmas/${turma.id}`, { method: "DELETE", corpo });
  const segunda = await api.chamar(`/turmas/${turma.id}`, { method: "DELETE", corpo });
  assert.equal(segunda.status, 404);
});

test("código de turma excluída não é reaproveitado por uma turma nova", async () => {
  const professor = await api.criarProfessor();
  const turma = await api.criarTurma(professor);
  await api.chamar(`/turmas/${turma.id}`, { method: "DELETE", corpo: { professor_id: professor.id } });

  const original = Math.random;
  const codigoRepetido = (Number(turma.codigo) - 1000) / 9000 + 1e-9;
  let chamadas = 0;
  // 1º sorteio cai no código da turma excluída
  Math.random = () => (chamadas++ === 0 ? codigoRepetido : original());
  try {
    const nova = await api.criarTurma(professor, "Nova");
    assert.notEqual(nova.codigo, turma.codigo);
  } finally {
    Math.random = original;
  }
});
