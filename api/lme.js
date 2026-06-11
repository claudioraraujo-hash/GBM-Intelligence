// GBM Intelligence — Tabela LME
// Fonte: shockmetais.com.br (scraping)
// Cache de 4h

let cache = {};
const CACHE_TTL = 4 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  // mes=Jun/2026 ou vazio para atual
  const mes = req.query.mes || "";
  const cacheKey = mes || "atual";
  const force = req.query.force === "1";

  if (!force && cache[cacheKey] && (Date.now() - cache[cacheKey].ts) < CACHE_TTL) {
    return res.status(200).json({ ...cache[cacheKey].data, cached: true });
  }

  try {
    const url = mes
      ? `https://shockmetais.com.br/lme?mes=${encodeURIComponent(mes)}`
      : "https://shockmetais.com.br/lme";

    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GBM-Intelligence/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!r.ok) throw new Error(`Shockmetais: ${r.status}`);
    const html = await r.text();

    // Extrai título do mês
    const mesMatch = html.match(/Indicadores de ([^<]+)</);
    const mesAtual = mesMatch ? mesMatch[1].trim() : "—";

    // Extrai opções do seletor de meses
    const meses = [];
    const optRegex = /<option[^>]*>([^<]+)<\/option>/g;
    let om;
    while ((om = optRegex.exec(html)) !== null) {
      const v = om[1].trim();
      if (/^[A-Za-zçÇ]+\/\d{4}$/.test(v)) meses.push(v);
    }

    // Extrai tabela — linhas do tbody
    const tabela = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let tr;
    while ((tr = trRegex.exec(html)) !== null) {
      const row = tr[1];
      // Extrai células td
      const cells = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let td;
      while ((td = tdRegex.exec(row)) !== null) {
        cells.push(td[1].replace(/<[^>]*>/g, "").trim());
      }
      if (cells.length >= 7) {
        const dia = cells[0];
        // Filtra linhas válidas (dia numérico ou "Média")
        if (dia && (dia.match(/^\d{2}\//) || dia.toLowerCase().includes("média"))) {
          tabela.push({
            dia,
            cobre:    parseNum(cells[1]),
            zinco:    parseNum(cells[2]),
            aluminio: parseNum(cells[3]),
            chumbo:   parseNum(cells[4]),
            estanho:  parseNum(cells[5]),
            niquel:   parseNum(cells[6]),
            dolar:    parseNum(cells[7]),
            isMedia:  dia.toLowerCase().includes("média"),
          });
        }
      }
    }

    // Última cotação válida do cobre
    const linhasDia = tabela.filter(r => !r.isMedia && r.cobre);
    const ultima = linhasDia[linhasDia.length - 1] || null;
    const penultima = linhasDia[linhasDia.length - 2] || null;

    // Variação dia anterior
    let variacaoDia = null;
    if (ultima?.cobre && penultima?.cobre) {
      const diff = ultima.cobre - penultima.cobre;
      const pct  = (diff / penultima.cobre) * 100;
      variacaoDia = { valor: diff, pct: pct.toFixed(2), positivo: diff >= 0 };
    }

    // Máx / mín do mês
    const cobres = linhasDia.map(r => r.cobre).filter(Boolean);
    const maxMes = cobres.length ? Math.max(...cobres) : null;
    const minMes = cobres.length ? Math.min(...cobres) : null;
    const mediaLinha = tabela.find(r => r.dia.toLowerCase().includes("mensal"));

    const result = {
      mes: mesAtual,
      meses,
      tabela,
      ultima,
      penultima,
      variacaoDia,
      maxMes,
      minMes,
      mediaLinha,
      fonte: "Shockmetais / LME",
      geradoEm: new Date().toISOString(),
    };

    cache[cacheKey] = { data: result, ts: Date.now() };
    return res.status(200).json(result);

  } catch (err) {
    if (cache[cacheKey]?.data) {
      return res.status(200).json({ ...cache[cacheKey].data, cached: true, cacheExpired: true });
    }
    return res.status(500).json({ error: err.message || "Falha ao buscar tabela LME." });
  }
}

function parseNum(s) {
  if (!s || s.toLowerCase() === "feriado" || s === "-" || s === "") return null;
  const t = s.trim();
  // Detecta formato do dólar: X,XXXX (vírgula como decimal, ex: 5,1763)
  // vs formato dos metais: XX,XXX.XX (vírgula=milhar, ponto=decimal, ex: 13,819.00)
  if (/^\d[.,]\d{4}$/.test(t)) {
    // Dólar: 5,1763 ou 5.1763 — troca vírgula por ponto
    return parseFloat(t.replace(",", "."));
  }
  // Metais: formato americano 13,819.00 — remove vírgulas de milhar
  const clean = t.replace(/,/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}
