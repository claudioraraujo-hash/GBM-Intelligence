// GBM Intelligence — Notícias do Mercado de Cobre
// Fontes: ABCobre (WordPress) + NewsData.io
// Cache de 24h em memória

let cache = { data: null, ts: 0 };
const CACHE_TTL = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const force = req.query.force === "1";
  const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY || "";

  if (!force && cache.data && (Date.now() - cache.ts) < CACHE_TTL) {
    return res.status(200).json({
      ...cache.data,
      cached: true,
      cacheAge: Math.round((Date.now() - cache.ts) / 60000) + "min"
    });
  }

  try {
    const [resAbcobre, resEn, resPt] = await Promise.allSettled([
      fetchABCobre(),
      NEWSDATA_KEY ? fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=copper+price+LME&language=en&size=5&category=business,science`, { signal: AbortSignal.timeout(10000) }) : Promise.resolve(null),
      NEWSDATA_KEY ? fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=cobre+mercado+LME&language=pt&size=5&category=business`, { signal: AbortSignal.timeout(10000) }) : Promise.resolve(null),
    ]);

    const noticiasAbcobre = resAbcobre.status === "fulfilled" ? (resAbcobre.value || []) : [];
    const noticiasEn = resEn.status === "fulfilled" && resEn.value?.ok ? (await resEn.value.json()).results || [] : [];
    const noticiasPt = resPt.status === "fulfilled" && resPt.value?.ok ? (await resPt.value.json()).results || [] : [];

    // ABCobre já vem formatada, NewsData precisa converter
    const noticiasNewsdata = [
      ...noticiasEn.map(n => ({ ...n, _lang: "en" })),
      ...noticiasPt.map(n => ({ ...n, _lang: "pt" })),
    ].filter(n => n.title && n.link).map(n => ({
      titulo: n.title,
      resumo: n.description ? n.description.slice(0, 200) + (n.description.length > 200 ? "..." : "") : "",
      fonte: n.source_id || "—",
      url: n.link,
      imagem: n.image_url || null,
      publicado: n.pubDate || null,
      idioma: n._lang === "pt" ? "🇧🇷" : "🌐",
      categoria: detectarCategoria(n.title + " " + (n.description || "")),
      relevancia: detectarRelevancia(n.title + " " + (n.description || "")),
    }));

    // Extrai dados de mercado dos Indicadores ABCobre
    const postIndicadores = noticiasAbcobre.find(n => n.titulo?.startsWith("Indicadores:"));
    const dadosMercado = postIndicadores ? extrairDadosMercado(postIndicadores.resumo) : { lme_spot: null, variacao_dia: null, usd_brl: null };

    // Remove posts de Indicadores da lista de notícias (são tabelas, não notícias)
    const noticiasAbcobreFiltradas = noticiasAbcobre.filter(n => !n.titulo?.startsWith("Indicadores:"));
    const todasNoticias = [...noticiasAbcobreFiltradas, ...noticiasNewsdata].slice(0, 12);
    const sentimento = calcularSentimento(todasNoticias);

    const result = {
      titulo: `Mercado de Cobre — ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`,
      sentimento: sentimento.valor,
      resumo: sentimento.resumo,
      destaques: todasNoticias.slice(0, 3).map(n => n.titulo),
      fatores_alta: sentimento.alta,
      fatores_baixa: sentimento.baixa,
      perspectiva: sentimento.perspectiva,
      noticias: todasNoticias,
      dados_mercado: dadosMercado,
      geradoEm: new Date().toISOString(),
      cached: false,
      fontes: ["ABCobre", "NewsData.io"],
      _debug: {
        abcobre: noticiasAbcobre.length,
        newsdata_en: noticiasEn.length,
        newsdata_pt: noticiasPt.length,
      }
    };

    cache = { data: result, ts: Date.now() };
    return res.status(200).json(result);

  } catch (err) {
    if (cache.data) {
      return res.status(200).json({ ...cache.data, cached: true, cacheExpired: true });
    }
    return res.status(500).json({ error: err.message || "Falha ao buscar notícias." });
  }
}

// ── ABCobre: 3 estratégias em cascata ────────────────────────────────────────
async function fetchABCobre() {
  // Estratégia 1: WordPress REST API
  try {
    const r = await fetch(
      "https://abcobre.org.br/wp-json/wp/v2/posts?per_page=5&_fields=title,link,excerpt,date",
      { headers: { "User-Agent": "GBM-Intelligence/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (r.ok) {
      const posts = await r.json();
      if (posts.length > 0) {
        return posts.map(p => ({
          titulo: (p.title?.rendered || "").replace(/<[^>]*>/g, "").trim(),
          resumo: (p.excerpt?.rendered || "").replace(/<[^>]*>/g, "").slice(0, 200).trim(),
          fonte: "ABCobre",
          url: p.link,
          publicado: p.date,
          idioma: "🇧🇷",
          categoria: "Brasil",
          relevancia: "alta",
        })).filter(n => n.titulo && n.url);
      }
    }
  } catch {}

  // Estratégia 2: RSS Feed
  try {
    const r = await fetch("https://abcobre.org.br/feed/", {
      headers: { "User-Agent": "GBM-Intelligence/1.0", "Accept": "application/rss+xml, text/xml" },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const xml = await r.text();
      const items = xml.split("<item>").slice(1).slice(0, 5);
      const result = items.map(item => {
        const getTag = (tag) => {
          const m = item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
          return m ? m[1].trim() : "";
        };
        return {
          titulo: getTag("title").replace(/<[^>]*>/g, ""),
          resumo: getTag("description").replace(/<[^>]*>/g, "").slice(0, 200),
          fonte: "ABCobre",
          url: getTag("link"),
          publicado: getTag("pubDate"),
          idioma: "🇧🇷",
          categoria: "Brasil",
          relevancia: "alta",
        };
      }).filter(n => n.titulo && n.url);
      if (result.length > 0) return result;
    }
  } catch {}

  // Estratégia 3: Scraping HTML da página de notícias
  try {
    const r = await fetch("https://abcobre.org.br/noticias/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GBM-Intelligence/1.0)" },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const html = await r.text();
      const result = [];
      // Extrai pares href + h3 do WordPress
      const linkRegex = /href="(https:\/\/abcobre\.org\.br\/[a-z0-9\-]+\/)"[\s\S]{0,200}?<h\d[^>]*>([\s\S]*?)<\/h\d>/g;
      let m;
      const seen = new Set();
      while ((m = linkRegex.exec(html)) !== null && result.length < 5) {
        const url = m[1];
        const titulo = m[2].replace(/<[^>]*>/g, "").trim();
        if (!seen.has(url) && titulo.length > 10 && !url.includes("noticias")) {
          seen.add(url);
          result.push({ titulo, resumo: "", fonte: "ABCobre", url, publicado: null, idioma: "🇧🇷", categoria: "Brasil", relevancia: "alta" });
        }
      }
      if (result.length > 0) return result;
    }
  } catch {}

  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extrairDadosMercado(resumo) {
  if (!resumo) return { lme_spot: null, variacao_dia: null, usd_brl: null };
  // Extrai última cotação LME do texto (ex: "12895,00" ou "13,452")
  const lmeMatch = resumo.match(/(\d{2}[\.,]\d{3}(?:[.,]\d{2})?)/g);
  const usdMatch = resumo.match(/(\d[.,]\d{4})/);
  return {
    lme_spot: lmeMatch ? lmeMatch[lmeMatch.length - 1].replace(",",".") : null,
    variacao_dia: null,
    usd_brl: usdMatch ? usdMatch[1].replace(",",".") : null,
  };
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
  const hits = ["lme", "price", "preço", "alta", "baixa", "record", "supply", "demand", "china", "codelco", "freeport"].filter(k => t.includes(k)).length;
  return hits >= 3 ? "alta" : hits >= 1 ? "media" : "baixa";
}

function calcularSentimento(noticias) {
  const textos = noticias.map(n => (n.titulo + " " + n.resumo).toLowerCase()).join(" ");
  const pontosAlta  = ["high","rise","gain","rally","surge","bull","alta","sobe","recorde","demand","growth","strong"].filter(p => textos.includes(p)).length;
  const pontosBaixa = ["low","fall","drop","decline","bear","weak","baixa","cai","queda","surplus","oversupply","concern"].filter(p => textos.includes(p)).length;

  let valor, resumo, perspectiva;
  if (pontosAlta > pontosBaixa + 1) {
    valor = "alta"; resumo = "O mercado de cobre apresenta sinais positivos. Fatores de demanda e expectativas macroeconômicas sustentam o movimento de alta."; perspectiva = "Tendência de sustentação dos preços no curto prazo.";
  } else if (pontosBaixa > pontosAlta + 1) {
    valor = "baixa"; resumo = "O mercado de cobre enfrenta pressão vendedora. Preocupações com oferta e demanda mais fraca pesam sobre as cotações."; perspectiva = "Pressão de baixa no curto prazo. Aguardar dados econômicos da China e Fed.";
  } else {
    valor = "neutro"; resumo = "O mercado de cobre se mantém em equilíbrio entre fatores de alta e baixa. Investidores aguardam dados macroeconômicos para definir direção."; perspectiva = "Mercado lateralizado. Volatilidade pode aumentar com divulgação de dados.";
  }

  const alta  = [];
  const baixa = [];
  if (textos.includes("china")) alta.push("Demanda chinesa em foco");
  if (textos.includes("electric") || textos.includes("ev")) alta.push("Crescimento veículos elétricos");
  if (textos.includes("infrastructure") || textos.includes("ia") || textos.includes("data center")) alta.push("Expansão de infraestrutura e IA");
  if (textos.includes("strike") || textos.includes("greve")) alta.push("Paralisações em minas");
  if (textos.includes("surplus") || textos.includes("excess")) baixa.push("Excesso de oferta no mercado");
  if (textos.includes("dollar") || textos.includes("dólar")) baixa.push("Fortalecimento do dólar");
  if (textos.includes("recession") || textos.includes("recessão")) baixa.push("Preocupações com recessão global");
  if (textos.includes("inventory") || textos.includes("estoque")) baixa.push("Aumento dos estoques no LME");
  if (alta.length === 0) { alta.push("Demanda industrial sustentada"); alta.push("Transição energética global"); }
  if (baixa.length === 0) { baixa.push("Incerteza macroeconômica global"); baixa.push("Pressão do dólar forte"); }

  return { valor, resumo, perspectiva, alta: alta.slice(0, 3), baixa: baixa.slice(0, 3) };
}
