// GBM Intelligence — Cotação Dólar PTAX (Banco Central do Brasil)
// Cache de 4h; retrocede até 7 dias úteis para cobrir fins de semana e feriados

let cache = null;
const CACHE_TTL = 4 * 60 * 60 * 1000;

function fmtBCB(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 7);

    const dataInicio = fmtBCB(seteDiasAtras);
    const dataFim    = fmtBCB(hoje);

    const url =
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
      `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
      `?@dataInicial='${dataInicio}'&@dataFinalCotacao='${dataFim}'` +
      `&$top=10&$orderby=dataHoraCotacao%20desc&$format=json` +
      `&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) throw new Error(`BCB: ${r.status}`);
    const json = await r.json();
    const registros = json?.value || [];
    if (!registros.length) throw new Error("BCB sem dados no período.");

    // Pega o fechamento mais recente do dia (último boletim)
    const ultimo = registros[0];
    const data = {
      compra:  ultimo.cotacaoCompra,
      venda:   ultimo.cotacaoVenda,
      dataHora: ultimo.dataHoraCotacao,
      fonte: "Banco Central do Brasil — PTAX",
      geradoEm: new Date().toISOString(),
    };

    cache = { data, ts: Date.now() };
    return res.status(200).json(data);

  } catch (err) {
    if (cache?.data) return res.status(200).json({ ...cache.data, cached: true, cacheExpired: true });
    return res.status(500).json({ error: err.message || "Falha ao buscar cotação BCB." });
  }
}
