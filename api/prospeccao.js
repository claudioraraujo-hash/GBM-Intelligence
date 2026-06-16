// GBM Intelligence — Prospecção por CNAE
// Fonte: Casa dos Dados v5 (tipo_resultado=completo)

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
      pagina: page,
      limite: 20,
    };

    const r = await fetch(`https://api.casadosdados.com.br/v5/cnpj/pesquisa?tipo_resultado=completo`, {
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
    const lista = d.cnpjs || d.data?.cnpj || d.cnpj || d.data || [];

    const empresas = lista.map(e => {
      const tel = (e.contato_telefonico && e.contato_telefonico[0])
        ? (e.contato_telefonico[0].ddd + e.contato_telefonico[0].numero)
        : "";
      const email = (e.contato_email && e.contato_email[0]) ? e.contato_email[0].email : "";
      const socio = (e.quadro_societario && e.quadro_societario[0]) ? e.quadro_societario[0].nome : "";

      return {
        cnpj: e.cnpj,
        razaoSocial: e.razao_social,
        nomeFantasia: e.nome_fantasia || "",
        situacao: e.situacao_cadastral?.situacao_atual || "ATIVA",
        dataAbertura: e.data_abertura || e.situacao_cadastral?.data || null,
        capitalSocial: parseFloat(e.capital_social || "0"),
        porte: e.porte_empresa?.descricao || "",
        cnae: e.atividade_principal?.codigo || cnaeClean,
        cnaeDesc: e.atividade_principal?.descricao || "",
        cidade: e.endereco?.municipio || "",
        uf: e.endereco?.uf || "",
        cep: e.endereco?.cep || "",
        bairro: e.endereco?.bairro || "",
        logradouro: [e.endereco?.tipo_logradouro, e.endereco?.logradouro, e.endereco?.numero].filter(Boolean).join(" "),
        telefone: tel,
        email: email,
        socio: socio,
        socioQualificacao: (e.quadro_societario && e.quadro_societario[0]) ? e.quadro_societario[0].qualificacao_socio : "",
        naturezaJuridica: e.descricao_natureza_juridica || "",
      };
    });

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
