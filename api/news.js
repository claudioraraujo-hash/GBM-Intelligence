// GBM Intelligence — Notícias do Mercado de Cobre
// Fonte: NewsData.io (gratuito, 200 req/dia)
// Cache de 24h em memória

let cache = { data: null, ts: 0 };
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const force = req.query.force === "1";
  const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY || "";

  // Serve cache se válido
  if (!force && cache.data && (Date.now() - cache.ts) < CACHE_TTL) {
    return res.status(200).json({
      ...cache.data,
      cached: true,
      cacheAge: Math.round((Date.now() - cache.ts) / 60000) + "min"
    });
  }

  if (!NEWSDATA_KEY) {
    return res.status(500).json({ error: "NEWSDATA_API_KEY não configurada." });
  }

  try {
    // Busca notícias em paralelo — EN e PT-BR
    const [resEn, resPt] = await Promise.allSettled([
      fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=copper+price+LME&language=en&size=5&category=business,science`, {
        signal: AbortSignal.timeout(10000)
      }),
      fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=cobre+mercado+LME&language=pt&size=5&category=business`, {
        signal: AbortSignal.timeout(10000)
      }),
    ]);

    const noticiasEn = resEn.status === "fulfilled" && resEn.value.ok
      ? (await resEn.value.json()).results || []
      : [];

    const noticiasPt = resPt.status === "fulfilled" && resPt.value.ok
      ? (await resPt.value.json()).results || []
      : [];

    // Combina e formata
    const todasNoticias = [
      ...noticiasEn.map(n => ({ ...n, _lang: "en" })),
      ...noticiasPt.map(n => ({ ...n, _lang: "pt" })),
    ]
    .filter(n => n.title && n.link)
    .slice(0, 10)
    .map(n => ({
      titulo: n.title,
      resumo: n.description ? n.description.slice(0, 200) + (n.description.length > 200 ? "..." : "") : "",
      fonte: n.source_id || n.source_url || "—",
      url: n.link,
      imagem: n.image_url || null,
      publicado: n.pubDate || null,
      idioma: n._lang === "pt" ? "🇧🇷" : "🌐",
      categoria: detectarCategoria(n.title + " " + (n.description||"")),
      relevancia: detectarRelevancia(n.title + " " + (n.description||"")),
    }));

    // Gera sentimento baseado nas notícias (sem IA)
    const sentimento = calcularSentimento(todasNoticias);

    const result = {
      titulo: `Mercado de Cobre — ${new Date().toLocaleDateString("pt-BR", {day:"2-digit",month:"short",year:"numeric"})}`,
      sentimento: sentimento.valor,
      resumo: sentimento.resumo,
      destaques: todasNoticias.slice(0, 3).map(n => n.titulo),
      fatores_alta: sentimento.alta,
      fatores_baixa: sentimento.baixa,
      perspectiva: sentimento.perspectiva,
      noticias: todasNoticias,
      dados_mercado: { lme_spot: null, variacao_dia: null, usd_brl: null },
      geradoEm: new Date().toISOString(),
      cached: false,
      fonte: "NewsData.io",
    };

    cache = { data: result, ts: Date.now() };
    return res.status(200).json(result);

  } catch (err) {
    if (cache.data) {
      return res.status(200).json({
        ...cache.data,
        cached: true,
        cacheExpired: true,
        cacheAge: Math.round((Date.now() - cache.ts) / 60000) + "min",
      });
    }
    return res.status(500).json({ error: err.message || "Falha ao buscar notícias." });
  }
}

function detectarCategoria(texto) {
  const t = texto.toLowerCase();
  if (t.includes("lme") || t.includes("london metal")) return "LME";
  if (t.includes("china") || t.includes("chinese")) return "China";
  if (t.includes("fed") || t.includes("dollar") || t.includes("dólar") || t.includes("interest rate")) return "Macro";
  if (t.includes("mine") || t.includes("mina") || t.includes("mining") || t.includes("codelco") || t.includes("freeport")) return "Mineração";
  if (t.includes("demand") || t.includes("demanda") || t.includes("ev") || t.includes("electric")) return "Demanda";
  if (t.includes("supply") || t.includes("oferta") || t.includes("produc")) return "Oferta";
  if (t.includes("brasil") || t.includes("brazil") || t.includes("real")) return "Brasil";
  return "Macro";
}

function detectarRelevancia(texto) {
  const t = texto.toLowerCase();
  const altaRelevancia = ["lme", "price", "preço", "alta", "baixa", "record", "supply", "demand", "china", "codelco", "freeport"];
  const hits = altaRelevancia.filter(k => t.includes(k)).length;
  if (hits >= 3) return "alta";
  if (hits >= 1) return "media";
  return "baixa";
}

function calcularSentimento(noticias) {
  const textos = noticias.map(n => (n.titulo + " " + n.resumo).toLowerCase()).join(" ");

  const palavrasAlta = ["high", "rise", "gain", "rally", "surge", "bull", "alta", "sobe", "recorde", "demand", "growth", "strong"];
  const palavrasBaixa = ["low", "fall", "drop", "decline", "bear", "weak", "baixa", "cai", "queda", "surplus", "oversupply", "concern"];

  const pontosAlta = palavrasAlta.filter(p => textos.includes(p)).length;
  const pontosBaixa = palavrasBaixa.filter(p => textos.includes(p)).length;

  let valor, resumo, perspectiva;
  const fatoresAlta = [];
  const fatoresBaixa = [];

  if (pontosAlta > pontosBaixa + 1) {
    valor = "alta";
    resumo = "O mercado de cobre apresenta sinais positivos nas últimas notícias. Fatores de demanda e expectativas macroeconômicas sustentam o movimento de alta nos preços do metal.";
    perspectiva = "Tendência de sustentação dos preços no curto prazo, com atenção ao fluxo de dados da China.";
  } else if (pontosBaixa > pontosAlta + 1) {
    valor = "baixa";
    resumo = "O mercado de cobre enfrenta pressão vendedora nas últimas notícias. Preocupações com oferta global e demanda mais fraca pesam sobre as cotações.";
    perspectiva = "Pressão de baixa no curto prazo. Aguardar dados econômicos da China e decisões do Fed.";
  } else {
    valor = "neutro";
    resumo = "O mercado de cobre se mantém em equilíbrio entre fatores de alta e baixa. Investidores aguardam novos dados macroeconômicos para definir direção.";
    perspectiva = "Mercado lateralizado no curto prazo. Volatilidade pode aumentar com divulgação de dados econômicos.";
  }

  // Extrai fatores dos textos
  if (textos.includes("china")) fatoresAlta.push("Demanda chinesa em foco");
  if (textos.includes("electric") || textos.includes("ev")) fatoresAlta.push("Crescimento veículos elétricos");
  if (textos.includes("infrastructure")) fatoresAlta.push("Investimentos em infraestrutura");
  if (textos.includes("strike") || textos.includes("greve")) fatoresAlta.push("Paralisações em minas");
  if (textos.includes("surplus") || textos.includes("excess")) fatoresBaixa.push("Excesso de oferta no mercado");
  if (textos.includes("dollar") || textos.includes("dólar")) fatoresBaixa.push("Fortalecimento do dólar");
  if (textos.includes("recession") || textos.includes("recessão")) fatoresBaixa.push("Preocupações com recessão global");
  if (textos.includes("inventory") || textos.includes("estoque")) fatoresBaixa.push("Aumento dos estoques no LME");

  if (fatoresAlta.length === 0) fatoresAlta.push("Demanda industrial sustentada", "Transição energética");
  if (fatoresBaixa.length === 0) fatoresBaixa.push("Incerteza macroeconômica global", "Pressão do dólar forte");

  return { valor, resumo, perspectiva, alta: fatoresAlta.slice(0,3), baixa: fatoresBaixa.slice(0,3) };
}
