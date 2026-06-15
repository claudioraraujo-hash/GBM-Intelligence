// GBM Intelligence — Prospecção por CNAE
// Fonte: Casa dos Dados (casadosdados.com.br)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { cnae, pagina = "1" } = req.query;
  if (!cnae) return res.status(400).json({ error: "Informe o CNAE." });

  const CASADOSDADOS_KEY = process.env.CASA_DADOS_API_KEY || "";
  if (!CASADOSDADOS_KEY) return res.status(500).json({ error: "CASA_DADOS_API_KEY não configurada." });

  const cnaeClean = cnae.replace(/\D/g, "");
  const page = parseInt(pagina) || 1;

  // Formata CNAE para o padrão da Casa dos Dados: 2443100 → 24.43-1/00
  const fmtCnae = (c) => {
    if (c.length === 7) {
      return `${c.slice(0,2)}.${c.slice(2,4)}-${c.slice(4,5)}/${c.slice(5,7)}`;
    }
    return c;
  };

  try {
    const body = {
      query: {
        atividade_principal: [{ code: fmtCnae(cnaeClean) }],
        situacao_cadastral: "ATIVA",
      },
      page,
    };

    const r = await fetch("https://api.casadosdados.com.br/v2/public/cnpj/pesquisa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${CASADOSDADOS_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Casa dos Dados ${r.status}: ${err.slice(0, 150)}`);
    }

    const d = await r.json();

    const empresas = (d.data?.cnpj || []).map(e => ({
      cnpj: e.cnpj,
      razaoSocial: e.razao_social,
      nomeFantasia: e.nome_fantasia || "",
      situacao: e.descricao_situacao_cadastral || "ATIVA",
      dataAbertura: e.data_inicio_atividade,
      capitalSocial: parseFloat(e.capital_social || "0"),
      cnae: e.cnae_fiscal,
      cnaeDesc: e.cnae_fiscal_descricao || "",
      cidade: e.municipio,
      uf: e.uf,
      cep: e.cep,
      telefone: e.ddd_telefone_1 ? e.ddd_telefone_1 + e.telefone_1 : "",
      email: e.email || "",
      logradouro: [e.tipo_logradouro, e.logradouro, e.numero].filter(Boolean).join(" "),
    }));

    return res.status(200).json({
      cnae: cnaeClean,
      cnaeFormatado: fmtCnae(cnaeClean),
      pagina: page,
      total: d.data?.count || empresas.length,
      totalPaginas: d.data?.last_page || 1,
      empresas,
      fonte: "Casa dos Dados",
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message || "Falha ao buscar empresas.",
    });
  }
}
