const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { TOTAL_FASES } = require("../utils/perguntas");

function gerarCodigo() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// POST /api/turmas  { nome_turma, professor_id }
// Cadastro de turma. Exige um professor autenticado (professor_id vem do
// login em /api/professores/login ou /cadastro). Gera um código único de 4 dígitos.
router.post("/", async (req, res) => {
  const { professor_id } = req.body;
  const nomeTurmaLimpo = String(req.body.nome_turma || "").trim();

  if (!nomeTurmaLimpo || !professor_id) {
    return res
      .status(400)
      .json({ erro: "Informe o nome da turma e faça login como professor." });
  }

  const { data: professor, error: erroProfessor } = await supabase
    .from("professores")
    .select("id, nome")
    .eq("id", professor_id)
    .maybeSingle();

  if (erroProfessor) return res.status(500).json({ erro: erroProfessor.message });
  if (!professor) {
    return res.status(404).json({ erro: "Professor não encontrado. Faça login novamente." });
  }

  let codigo;
  let jaExiste = true;
  let tentativas = 0;

  while (jaExiste && tentativas < 10) {
    codigo = gerarCodigo();
    const { data } = await supabase
      .from("turmas")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    jaExiste = !!data;
    tentativas++;
  }

  if (jaExiste) {
    return res
      .status(500)
      .json({ erro: "Não foi possível gerar um código único. Tente novamente." });
  }

  const { data, error } = await supabase
    .from("turmas")
    .insert({ codigo, nome_turma: nomeTurmaLimpo, nome_professor: professor.nome, professor_id })
    .select()
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  res.status(201).json(data);
});

// GET /api/turmas/:codigo
// Usado pela tela inicial do aluno para validar o código digitado.
router.get("/:codigo", async (req, res) => {
  const { codigo } = req.params;

  const { data, error } = await supabase
    .from("turmas")
    .select("id, codigo, nome_turma, nome_professor")
    .eq("codigo", codigo)
    .maybeSingle();

  if (error) return res.status(500).json({ erro: error.message });
  if (!data) return res.status(404).json({ erro: "Código de turma não encontrado." });

  res.json(data);
});

// GET /api/turmas/:turma_id/desempenho?professor_id=...
// Dashboard do professor: lista os alunos da turma com um resumo do
// progresso de cada um. Só o professor dono da turma pode acessar.
router.get("/:turma_id/desempenho", async (req, res) => {
  const { turma_id } = req.params;
  const { professor_id } = req.query;

  const { data: turma, error: erroTurma } = await supabase
    .from("turmas")
    .select("id, codigo, nome_turma, professor_id")
    .eq("id", turma_id)
    .maybeSingle();

  if (erroTurma) return res.status(500).json({ erro: erroTurma.message });
  if (!turma) return res.status(404).json({ erro: "Turma não encontrada." });

  if (!professor_id || turma.professor_id !== professor_id) {
    return res.status(403).json({ erro: "Você não tem permissão para ver esta turma." });
  }

  const { data: alunos, error: erroAlunos } = await supabase
    .from("alunos")
    .select("id, nome_usuario")
    .eq("turma_id", turma_id)
    .order("nome_usuario", { ascending: true });

  if (erroAlunos) return res.status(500).json({ erro: erroAlunos.message });

  const alunoIds = (alunos || []).map((a) => a.id);
  const progressoPorAluno = {};

  if (alunoIds.length) {
    const { data: progresso, error: erroProgresso } = await supabase
      .from("progresso")
      .select("aluno_id, fase_numero, concluida, acertos, erros")
      .in("aluno_id", alunoIds);

    if (erroProgresso) return res.status(500).json({ erro: erroProgresso.message });

    (progresso || []).forEach((linha) => {
      if (!progressoPorAluno[linha.aluno_id]) progressoPorAluno[linha.aluno_id] = [];
      progressoPorAluno[linha.aluno_id].push(linha);
    });
  }

  const desempenho = (alunos || []).map((aluno) => {
    const linhas = progressoPorAluno[aluno.id] || [];
    const fasesConcluidas = linhas.filter((l) => l.concluida).length;
    const totalAcertos = linhas.reduce((soma, l) => soma + (l.acertos || 0), 0);
    const totalErros = linhas.reduce((soma, l) => soma + (l.erros || 0), 0);
    const totalRespostas = totalAcertos + totalErros;
    const percentualAcerto =
      totalRespostas > 0 ? Math.round((totalAcertos / totalRespostas) * 100) : null;

    return {
      aluno_id: aluno.id,
      nome_usuario: aluno.nome_usuario,
      fases_concluidas: fasesConcluidas,
      total_fases: TOTAL_FASES,
      acertos: totalAcertos,
      erros: totalErros,
      percentual_acerto: percentualAcerto,
    };
  });

  res.json({
    turma: { id: turma.id, codigo: turma.codigo, nome_turma: turma.nome_turma },
    alunos: desempenho,
  });
});

module.exports = router;
