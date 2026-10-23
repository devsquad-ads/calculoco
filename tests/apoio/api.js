// Helpers para montar professor/turma/aluno via API nos testes.

function criarClienteApi(url) {
  async function chamar(caminho, { method = "GET", corpo } = {}) {
    const resposta = await fetch(`${url}/api${caminho}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const dados = await resposta.json().catch(() => ({}));
    return { status: resposta.status, dados };
  }

  let contador = 0;

  async function criarProfessor(nome = "Prof Teste") {
    contador += 1;
    const usuario = `prof${Date.now()}${contador}`;
    const { dados } = await chamar("/professores/cadastro", {
      method: "POST",
      corpo: { nome, usuario, senha: "1234" },
    });
    return { ...dados.professor, senha: "1234" };
  }

  async function criarTurma(professor, nome_turma = "3º Ano B") {
    const { dados } = await chamar("/turmas", {
      method: "POST",
      corpo: { nome_turma, professor_id: professor.id },
    });
    return dados;
  }

  async function criarAluno(turma, nome_usuario = "joao", pin = "1111") {
    const { dados } = await chamar("/auth/cadastro", {
      method: "POST",
      corpo: { codigo_turma: turma.codigo, nome_usuario, pin },
    });
    return { ...dados.aluno, pin };
  }

  return { chamar, criarProfessor, criarTurma, criarAluno };
}

module.exports = { criarClienteApi };
