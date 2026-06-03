// Módulo de crédito: Protestos (CENPROT) + Processos (CNJ) + Score GBM
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { cnpj } = req.query;
  if (!cnpj || cnpj.replace(/\D/g, "").length !== 14)
    return res.status(400).json({ error: "CNPJ inválido." });

  const raw = cnpj.replace(/\D/g, "");
  const results = { cnpj: raw, protestos: null, processos: null, rfData: null, score: null, errors: [] };

  // ── 1. Dados Receita Federal (já temos, mas buscamos aqui para o score) ──
  try {
    const r = await fetch(`https://publica.cnpj.ws/cnpj/${raw}`, {
      headers: { "Accept": "application/json", "User-Agent": "gbm-intelligence/1.0" }
    });
    if (r.ok) results.rfData = await r.json();
  } catch { results.errors.push("Receita Federal indisponível."); }

  // ── 2. Protestos via CENPROT (pesquisaprotesto.com.br) ──
  // A CENPROT não tem API REST pública documentada — scraping via POST
  try {
    const formData = new URLSearchParams({ documento: raw, tipo: "J" });
    const r = await fetch("https://pesquisaprotesto.com.br/consulta", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml"
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(8000)
    });
    const html = await r.text();

    // Parseia resultado — "não possui protesto" ou lista de cartórios
    const semProtesto = /n[ãa]o\s+possui|sem\s+protesto|nenhum\s+protesto/i.test(html);
    const comProtesto = /possui\s+protesto|cartório|tabelionato/i.test(html);

    if (semProtesto) {
      results.protestos = { status: "limpo", quantidade: 0, cartórios: [] };
    } else if (comProtesto) {
      // Tenta extrair quantidade e cartórios
      const qtdMatch = html.match(/(\d+)\s+protesto/i);
      results.protestos = {
        status: "protestado",
        quantidade: qtdMatch ? parseInt(qtdMatch[1]) : 1,
        cartórios: [],
        obs: "Consulte pesquisaprotesto.com.br para detalhes"
      };
    } else {
      // Fallback: redireciona usuário para consulta manual
      results.protestos = {
        status: "verificar",
        quantidade: null,
        link: `https://pesquisaprotesto.com.br`,
        obs: "Consulta manual necessária"
      };
    }
  } catch (e) {
    results.protestos = {
      status: "indisponivel",
      link: "https://pesquisaprotesto.com.br",
      obs: "Serviço temporariamente indisponível. Consulte manualmente."
    };
    results.errors.push("CENPROT: " + e.message);
  }

  // ── 3. Processos Judiciais via API CNJ ──
  try {
    // DataJud — API pública do CNJ
    const cnpjFormatado = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    const query = {
      query: {
        bool: {
          should: [
            { match: { "numeroOrgaoJustica": raw } },
            { match_phrase: { "classe.nome": cnpjFormatado } }
          ]
        }
      },
      size: 10,
      sort: [{ "dataAjuizamento": { order: "desc" } }]
    };

    const r = await fetch("https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "ApiKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TaEctcWRRbWx4ODZTdw=="
      },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(8000)
    });

    if (r.ok) {
      const data = await r.json();
      const hits = data.hits?.hits || [];
      results.processos = {
        total: data.hits?.total?.value || 0,
        lista: hits.slice(0, 5).map(h => ({
          numero: h._source?.numeroProcesso,
          classe: h._source?.classe?.nome,
          assunto: h._source?.assuntos?.[0]?.nome,
          tribunal: h._source?.tribunal,
          dataAjuizamento: h._source?.dataAjuizamento,
          grau: h._source?.grau,
        })),
        fonte: "CNJ DataJud",
        cobertura: "TJSP (expandir para outros tribunais conforme necessário)"
      };
    } else {
      results.processos = { total: 0, lista: [], fonte: "CNJ DataJud", obs: `Status ${r.status}` };
    }
  } catch (e) {
    results.processos = { total: 0, lista: [], fonte: "CNJ DataJud", obs: "Indisponível: " + e.message };
    results.errors.push("CNJ: " + e.message);
  }

  // ── 4. Score GBM (calculado com dados disponíveis) ──
  results.score = calcularScoreGBM(results);

  return res.status(200).json(results);
}

function calcularScoreGBM(data) {
  let pontos = 1000;
  const fatores = [];

  const rf = data.rfData;

  // Situação cadastral RF
  const situacao = rf?.estabelecimento?.situacao_cadastral?.descricao?.toUpperCase() || "";
  if (situacao.includes("ATIVA")) {
    fatores.push({ label: "Situação cadastral ativa", impacto: 0, positivo: true });
  } else if (situacao) {
    pontos -= 300;
    fatores.push({ label: `Situação cadastral: ${situacao}`, impacto: -300, positivo: false });
  }

  // Tempo de empresa
  const dataAbertura = rf?.estabelecimento?.data_inicio_atividade;
  if (dataAbertura) {
    const anos = (Date.now() - new Date(dataAbertura)) / (1000 * 60 * 60 * 24 * 365);
    if (anos >= 5) { fatores.push({ label: `Empresa com ${Math.floor(anos)} anos`, impacto: 0, positivo: true }); }
    else if (anos >= 2) { pontos -= 50; fatores.push({ label: "Empresa entre 2-5 anos", impacto: -50, positivo: false }); }
    else { pontos -= 150; fatores.push({ label: "Empresa com menos de 2 anos", impacto: -150, positivo: false }); }
  }

  // Capital social
  const capital = parseFloat(rf?.capital_social || "0");
  if (capital >= 1000000) { fatores.push({ label: "Capital social acima de R$1M", impacto: 0, positivo: true }); }
  else if (capital >= 100000) { pontos -= 30; fatores.push({ label: "Capital social entre R$100K-1M", impacto: -30, positivo: false }); }
  else if (capital > 0) { pontos -= 80; fatores.push({ label: "Capital social abaixo de R$100K", impacto: -80, positivo: false }); }
  else { pontos -= 100; fatores.push({ label: "Capital social não informado", impacto: -100, positivo: false }); }

  // Protestos
  if (data.protestos?.status === "limpo") {
    fatores.push({ label: "Sem protestos em cartório", impacto: 0, positivo: true });
  } else if (data.protestos?.status === "protestado") {
    const qtd = data.protestos.quantidade || 1;
    const deducao = Math.min(qtd * 100, 400);
    pontos -= deducao;
    fatores.push({ label: `${qtd} protesto(s) em cartório`, impacto: -deducao, positivo: false });
  }

  // Processos judiciais
  const totalProcessos = data.processos?.total || 0;
  if (totalProcessos === 0) {
    fatores.push({ label: "Sem processos judiciais localizados", impacto: 0, positivo: true });
  } else if (totalProcessos <= 3) {
    pontos -= 80;
    fatores.push({ label: `${totalProcessos} processo(s) judicial(is)`, impacto: -80, positivo: false });
  } else {
    pontos -= 200;
    fatores.push({ label: `${totalProcessos} processos judiciais`, impacto: -200, positivo: false });
  }

  // Sócios
  const socios = rf?.socios?.length || rf?.qsa?.length || 0;
  if (socios > 0) { fatores.push({ label: `${socios} sócio(s) identificado(s)`, impacto: 0, positivo: true }); }

  pontos = Math.max(0, Math.min(1000, pontos));

  let classificacao, cor, recomendacao;
  if (pontos >= 800) { classificacao = "Excelente"; cor = "#10b981"; recomendacao = "Baixo risco. Crédito recomendado."; }
  else if (pontos >= 600) { classificacao = "Bom"; cor = "#f59e0b"; recomendacao = "Risco moderado. Avaliar limite de crédito."; }
  else if (pontos >= 400) { classificacao = "Regular"; cor = "#f97316"; recomendacao = "Risco elevado. Exigir garantias."; }
  else { classificacao = "Crítico"; cor = "#ef4444"; recomendacao = "Risco muito alto. Crédito não recomendado."; }

  return { pontos, classificacao, cor, recomendacao, fatores, fonte: "Score GBM Intelligence (indicativo)" };
}
