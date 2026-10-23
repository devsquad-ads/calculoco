// Supabase em memória para os testes. Cobre só o que o backend usa do
// query builder e as mesmas constraints unique do schema.sql.

const crypto = require("crypto");

const UNICOS = {
  professores: [["usuario"]],
  turmas: [["codigo"]],
  alunos: [["turma_id", "nome_usuario"]],
  progresso: [["aluno_id", "fase_numero"]],
};

const PADROES = {
  turmas: { excluida_em: null },
};

function criarSupabaseFalso() {
  const tabelas = { professores: [], turmas: [], alunos: [], progresso: [] };

  function projetar(linha, colunas) {
    if (!colunas || colunas.trim() === "*") return { ...linha };
    const resultado = {};
    colunas.split(",").map((c) => c.trim()).filter(Boolean).forEach((c) => {
      resultado[c] = linha[c];
    });
    return resultado;
  }

  function violaUnicidade(tabela, linha, ignorar) {
    return (UNICOS[tabela] || []).some((campos) =>
      tabelas[tabela].some(
        (outra) =>
          outra !== ignorar &&
          campos.every((c) => String(outra[c]).toLowerCase() === String(linha[c]).toLowerCase())
      )
    );
  }

  class Consulta {
    constructor(tabela) {
      this.tabela = tabela;
      this.filtros = [];
      this.operacao = "select";
      this.colunas = "*";
      this.ordem = null;
      this.modo = "lista";
    }

    select(colunas = "*") {
      this.colunas = colunas;
      if (this.operacao !== "select") this.retornar = true;
      return this;
    }
    insert(dados) { this.operacao = "insert"; this.dados = dados; return this; }
    update(dados) { this.operacao = "update"; this.dados = dados; return this; }
    upsert(dados, opcoes = {}) {
      this.operacao = "upsert";
      this.dados = dados;
      this.conflito = (opcoes.onConflict || "id").split(",").map((c) => c.trim());
      return this;
    }
    eq(campo, valor) { this.filtros.push((l) => l[campo] === valor); return this; }
    is(campo, valor) { this.filtros.push((l) => (l[campo] ?? null) === valor); return this; }
    ilike(campo, valor) {
      this.filtros.push((l) => String(l[campo]).toLowerCase() === String(valor).toLowerCase());
      return this;
    }
    in(campo, valores) { this.filtros.push((l) => valores.includes(l[campo])); return this; }
    order(campo, { ascending = true } = {}) { this.ordem = { campo, ascending }; return this; }
    single() { this.modo = "single"; return this; }
    maybeSingle() { this.modo = "maybeSingle"; return this; }

    filtradas() {
      return tabelas[this.tabela].filter((l) => this.filtros.every((f) => f(l)));
    }

    executar() {
      let linhas;

      if (this.operacao === "insert") {
        const nova = {
          id: crypto.randomUUID(),
          criado_em: new Date().toISOString(),
          ...PADROES[this.tabela],
          ...this.dados,
        };
        if (violaUnicidade(this.tabela, nova)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        tabelas[this.tabela].push(nova);
        linhas = [nova];
      } else if (this.operacao === "update") {
        linhas = this.filtradas();
        linhas.forEach((l) => Object.assign(l, this.dados));
      } else if (this.operacao === "upsert") {
        const existente = tabelas[this.tabela].find((l) =>
          this.conflito.every((c) => l[c] === this.dados[c])
        );
        if (existente) {
          Object.assign(existente, this.dados);
          linhas = [existente];
        } else {
          const nova = { id: crypto.randomUUID(), ...this.dados };
          tabelas[this.tabela].push(nova);
          linhas = [nova];
        }
      } else {
        linhas = this.filtradas();
      }

      if (this.ordem) {
        const { campo, ascending } = this.ordem;
        linhas = [...linhas].sort((a, b) =>
          (a[campo] > b[campo] ? 1 : a[campo] < b[campo] ? -1 : 0) * (ascending ? 1 : -1)
        );
      }

      if (this.operacao !== "select" && !this.retornar) return { data: null, error: null };

      const dados = linhas.map((l) => projetar(l, this.colunas));
      if (this.modo === "single") {
        if (dados.length !== 1) return { data: null, error: { message: "single: nenhuma ou várias linhas" } };
        return { data: dados[0], error: null };
      }
      if (this.modo === "maybeSingle") {
        if (dados.length > 1) return { data: null, error: { message: "maybeSingle: várias linhas" } };
        return { data: dados[0] || null, error: null };
      }
      return { data: dados, error: null };
    }

    then(resolver, rejeitar) {
      return Promise.resolve().then(() => this.executar()).then(resolver, rejeitar);
    }
  }

  return {
    tabelas,
    from: (tabela) => new Consulta(tabela),
  };
}

// Precisa rodar antes de carregar as rotas.
function instalarSupabaseFalso() {
  const path = require("path");
  const caminho = path.resolve(__dirname, "..", "..", "backend", "supabaseClient.js");
  const falso = criarSupabaseFalso();
  require.cache[caminho] = { id: caminho, filename: caminho, loaded: true, exports: falso };
  return falso;
}

module.exports = { criarSupabaseFalso, instalarSupabaseFalso };
