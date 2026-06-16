// GBM Intelligence — Prospecção por CNAE
// Fonte: Casa dos Dados v5 (api.casadosdados.com.br)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { cnae, pagina = "1" } = req.query;
  if (!cnae) return res.status(400).json({ error: "Informe o CNAE." });

  const API_KEY = process.env.CASA_DADOS_API_KEY || "";
  if (!API_KEY) return res.status(500).json({ error: "CASA_DADOS_API_KEY não configurada." });

  const cnaeClean = cnae.replace(/\D/g, "");
  const page = parseInt(pagina) || 1;

  try {
    const body = {
      codigo_atividade_principal: [cnaeClean],
      situacao_cadastral: ["ATIVA"],
    };

    const r = await fetch(`https://api.casadosdados.com.br/v5/cnpj/pesquisa?page=${page}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Casa dos Dados ${r.status}: ${err.slice(0, 200)}`);
    }

    const d = await r.json();
    // API retorna { total, cnpjs: [...] }
    const lista = d.cnpjs || d.data?.cnpj || d.cnpj || d.data || [];

    const empresas = lista.map(e => ({
      cnpj: e.cnpj,
      razaoSocial: e.razao_social,
      nomeFantasia: e.nome_fantasia || "",
      situacao: e.situacao_cadastral?.situacao_atual || e.situacao_cadastral || "ATIVA",
      dataAbertura: e.situacao_cadastral?.data || e.data_inicio_atividade || null,
      cnae: e.cnae_fiscal || cnaeClean,
    }));

    return res.status(200).json({
      cnae: cnaeClean,
      pagina: page,
      total: d.total || d.count || empresas.length,
      totalPaginas: Math.ceil((d.total || empresas.length) / 20) || 1,
      empresas,
      fonte: "Casa dos Dados",
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha ao buscar empresas." });
  }
}
