const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");

function gerarCodigo() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// POST /api/turmas  { nome_turma, nome_professor }
// Cadastro de turma pelo professor. Gera um código único de 4 dígitos.
router.post("/", async (req, res) => {
  const { nome_turma, nome_professor } = req.body;

  if (!nome_turma || !nome_professor) {
    return res
      .status(400)
      .json({ erro: "Informe nome_turma e nome_professor." });
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
    .insert({ codigo, nome_turma, nome_professor })
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

module.exports = router;
