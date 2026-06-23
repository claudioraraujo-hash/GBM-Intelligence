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
    // Shockmetais usa path-based: /lme/5-2026 (não query string)
    const url = mes
      ? `https://shockmetais.com.br/lme/${mes}`
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

    // Extrai opções do seletor de meses — captura value="" e texto
    const meses = [];
    const optRegex = /<option([^>]*)>([^<]+)<\/option>/g;
    let om;
    while ((om = optRegex.exec(html)) !== null) {
      const attrStr = om[1];
      const txt = om[2].trim();
      if (!/^[A-Za-záéíóúàâêôãõçÇ]+\/\d{4}$/.test(txt)) continue;
      const vmatch = attrStr.match(/value="([^"]*)"/i);
      const val = vmatch ? vmatch[1].trim() : txt;
      meses.push({ value: val, label: txt });
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
          const isMedia = dia.toLowerCase().includes("média");
          const semanaMatch = dia.match(/semana\s*(\d+)/i);
          tabela.push({
            dia,
            cobre:    parseNum(cells[1]),
            zinco:    parseNum(cells[2]),
            aluminio: parseNum(cells[3]),
            chumbo:   parseNum(cells[4]),
            estanho:  parseNum(cells[5]),
            niquel:   parseNum(cells[6]),
            dolar:    parseNum(cells[7]),
            isMedia,
            numeroSemana: semanaMatch ? parseInt(semanaMatch[1]) : null,
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

    // ── Semana de referência para a calculadora ──
    // Pega todas as médias semanais (linhas "Média Semana XX") com dados válidos
    const mediasSemana = tabela.filter(r => r.isMedia && r.numeroSemana && r.cobre && r.dolar);

    let semanaCalc = null;
    if (mediasSemana.length > 0) {
      // Horário de Brasília (UTC-3)
      const agora = new Date();
      const brasilia = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const diaSemana = brasilia.getDay(); // 0=dom 1=seg ... 5=sex 6=sab
      const horaAtual = brasilia.getHours();

      // Regra de negócio (fechamento sexta às 11h):
      // - A média de uma semana só "vale" a partir da sexta 11h daquela semana
      // - Antes disso, vale a média da semana anterior
      //
      // O site publica a média assim que a semana fecha. Então a lista de médias
      // pode conter a média da semana CORRENTE já na sexta de manhã.
      //
      // Lógica: a partir de sexta 11h (ou sábado/domingo), usamos a média mais recente.
      // De segunda a sexta antes das 11h, usamos a PENÚLTIMA se a última for da semana corrente.
      const fechamentoDisponivel = (diaSemana === 5 && horaAtual >= 11) || diaSemana === 6 || diaSemana === 0;

      const ultimaMedia = mediasSemana[mediasSemana.length - 1];
      const penultimaMedia = mediasSemana[mediasSemana.length - 2] || ultimaMedia;

      // Calcula o número da semana ISO atual para comparar
      const getSemanaISO = (d) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
      };
      const semanaAtualISO = getSemanaISO(brasilia);

      // Se a última média publicada é da semana CORRENTE e o fechamento ainda não chegou,
      // usa a penúltima (semana anterior). Caso contrário, usa a última.
      let escolhida;
      if (ultimaMedia.numeroSemana === semanaAtualISO && !fechamentoDisponivel) {
        escolhida = penultimaMedia;
      } else {
        escolhida = ultimaMedia;
      }

      semanaCalc = {
        mediaLme: escolhida.cobre,
        mediaCambio: escolhida.dolar,
        numeroSemana: escolhida.numeroSemana,
        periodo: `Semana ${escolhida.numeroSemana}`,
        diaSemanaHoje: ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][diaSemana],
        fechamentoDisponivel,
        semanaAtualISO,
      };
    }

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
      semanaCalc,
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
