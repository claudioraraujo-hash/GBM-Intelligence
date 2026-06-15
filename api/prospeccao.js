// GBM Intelligence — Prospecção por CNAE
// Fonte: brasilaberto.com.br API (CNPJ público)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { cnae, pagina = "1", uf = "" } = req.query;
  if (!cnae) return res.status(400).json({ error: "Informe o CNAE." });

  const cnaeClean = cnae.replace(/\D/g, "").slice(0, 7);
  const page = parseInt(pagina) || 1;

  try {
    // Brasil Aberto API — busca por CNAE, só ativas
    const params = new URLSearchParams({
      cnae: cnaeClean,
      situacao_cadastral: "ATIVA",
      pagina: page,
      ...(uf ? { uf } : {}),
    });

    const r = await fetch(`https://brasilaberto.com/api/v1/cnpj?${params}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "GBM-Intelligence/1.0",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) {
      // Fallback: ReceitaWS
      return await buscarReceitaWS(cnaeClean, page, uf, res);
    }

    const d = await r.json();
    const empresas = (d.data || d.results || d.empresas || []).map(e => ({
      cnpj: e.cnpj || e.nu_cnpj,
      razaoSocial: e.razao_social || e.no_razao_social,
      nomeFantasia: e.nome_fantasia || e.no_nome_fantasia || "",
      situacao: e.situacao_cadastral || e.ds_situacao_cadastral || "ATIVA",
      dataAbertura: e.data_inicio_atividade || e.dt_inicio_atividade,
      capitalSocial: parseFloat(e.capital_social || e.vl_capital_social || "0"),
      cnae: e.cnae_fiscal || e.cd_cnae_fiscal,
      cnaeDesc: e.cnae_fiscal_descricao || e.ds_cnae_fiscal || "",
      cidade: e.municipio || e.no_municipio || e.cidade,
      uf: e.uf || e.sg_uf,
      cep: e.cep,
      telefone: e.ddd_telefone_1 ? (e.ddd_telefone_1 + e.telefone_1) : (e.telefone || ""),
      email: e.email || "",
      logradouro: e.logradouro || "",
    }));

    return res.status(200).json({
      cnae: cnaeClean,
      pagina: page,
      total: d.total || d.count || empresas.length,
      empresas,
      fonte: "Brasil Aberto API",
    });

  } catch {
    return await buscarReceitaWS(cnaeClean, page, uf, res);
  }
}

async function buscarReceitaWS(cnae, page, uf, res) {
  try {
    // Fallback: API ReceitaWS
    const params = new URLSearchParams({
      cnae_fiscal: cnae,
      situacao_cadastral: "ATIVA",
      pagina: page,
      ...(uf ? { uf } : {}),
    });

    const r = await fetch(`https://www.receitaws.com.br/v1/cnpj/busca?${params}`, {
      headers: { "Accept": "application/json", "User-Agent": "GBM-Intelligence/1.0" },
      signal: AbortSignal.timeout(12000),
    });

    if (!r.ok) {
      // Segundo fallback: CNPJ.ws busca
      return await buscarCNPJws(cnae, page, uf, res);
    }

    const d = await r.json();
    return res.status(200).json({
      cnae, pagina: page, total: d.total || 0,
      empresas: (d.data || []).map(e => ({
        cnpj: e.cnpj, razaoSocial: e.nome, nomeFantasia: e.fantasia || "",
        situacao: e.situacao || "ATIVA", dataAbertura: e.abertura,
        capitalSocial: parseFloat((e.capital_social||"0").replace(/[R$\s.]/g,"").replace(",",".")) || 0,
        cnae: e.atividade_principal?.[0]?.code || cnae,
        cnaeDesc: e.atividade_principal?.[0]?.text || "",
        cidade: e.municipio, uf: e.uf, cep: e.cep,
        telefone: e.telefone || "", email: e.email || "",
        logradouro: e.logradouro || "",
      })),
      fonte: "ReceitaWS",
    });
  } catch {
    return await buscarCNPJws(cnae, page, uf, res);
  }
}

async function buscarCNPJws(cnae, page, uf, res) {
  try {
    const params = new URLSearchParams({
      cnae, situacao: "ATIVA", pagina: page,
      ...(uf ? { uf } : {}),
    });
    const r = await fetch(`https://publica.cnpj.ws/cnpjs?${params}`, {
      headers: { "Accept": "application/json", "User-Agent": "GBM-Intelligence/1.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`CNPJ.ws: ${r.status}`);
    const d = await r.json();
    return res.status(200).json({
      cnae, pagina: page, total: d.total || 0,
      empresas: (d.data || []).map(e => ({
        cnpj: e.cnpj?.raw || e.cnpj,
        razaoSocial: e.razao_social,
        nomeFantasia: e.nome_fantasia || "",
        situacao: e.situacao_cadastral?.nome || "ATIVA",
        dataAbertura: e.estabelecimento?.data_inicio_atividade,
        capitalSocial: parseFloat(e.capital_social || "0"),
        cnae: e.estabelecimento?.atividade_principal?.subclasse || cnae,
        cnaeDesc: e.estabelecimento?.atividade_principal?.descricao || "",
        cidade: e.estabelecimento?.cidade?.nome,
        uf: e.estabelecimento?.estado?.sigla,
        cep: e.estabelecimento?.cep,
        telefone: e.estabelecimento?.ddd1 ? e.estabelecimento.ddd1 + e.estabelecimento.telefone1 : "",
        email: e.estabelecimento?.email || "",
        logradouro: e.estabelecimento?.logradouro || "",
      })),
      fonte: "CNPJ.ws",
    });
  } catch(e) {
    return res.status(500).json({ error: "Nenhuma fonte disponível no momento. Tente novamente.", detail: e.message });
  }
}
