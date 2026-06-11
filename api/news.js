// GBM Intelligence — Notícias do Mercado de Cobre
// Cache de 24h via variável em memória (Vercel serverless)
// Resumo IA + lista de notícias com links

let cache = { data: null, ts: 0 };
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const force = req.query.force === "1";

  // Serve cache se válido
  if (!force && cache.data && (Date.now() - cache.ts) < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true, cacheAge: Math.round((Date.now() - cache.ts) / 60000) + "min" });
  }

  try {
    const hoje = new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });

    const prompt = `Hoje é ${hoje}. Você é um analista sênior especializado em mercado de cobre e metais não-ferrosos.

Faça pesquisas web nas melhores fontes disponíveis sobre cobre e metais hoje:
- LME (London Metal Exchange)
- Reuters Metals / Mining.com
- Kitco Metals
- Bloomberg Commodities
- Valor Econômico / InfoMoney (fontes brasileiras)
- CRU Group, Wood Mackenzie quando disponível

Retorne APENAS este JSON, sem markdown, sem texto antes ou depois:
{
  "titulo": "Mercado de Cobre — [data curta ex: 10 Jun 2026]",
  "sentimento": "alta" | "baixa" | "neutro",
  "resumo": "Parágrafo de 3-4 frases resumindo o cenário geral do mercado de cobre hoje",
  "destaques": [
    "frase curta e direta com o destaque mais importante",
    "segundo destaque",
    "terceiro destaque"
  ],
  "fatores_alta": ["fator 1", "fator 2"],
  "fatores_baixa": ["fator 1", "fator 2"],
  "perspectiva": "Uma frase sobre perspectiva de curto prazo (1-2 semanas)",
  "noticias": [
    {
      "titulo": "Título da notícia",
      "resumo": "1-2 frases resumindo",
      "fonte": "Nome da fonte",
      "url": "URL real da notícia se encontrada, ou null",
      "relevancia": "alta" | "media" | "baixa",
      "categoria": "LME" | "China" | "Macro" | "Oferta" | "Demanda" | "Brasil" | "Mineração"
    }
  ],
  "dados_mercado": {
    "lme_spot": "valor em USD/t se encontrado, ou null",
    "variacao_dia": "ex: +0,8% ou null",
    "usd_brl": "câmbio se encontrado, ou null"
  }
}

Inclua de 4 a 8 notícias relevantes. Priorize notícias reais com URLs verificáveis.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "Você é um analista de mercado de metais. Pesquise notícias reais e retorne APENAS JSON puro, sem markdown.",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(55000),
    });

    if (!r.ok) throw new Error(`Claude API: ${r.status}`);
    const apiData = await r.json();

    // Extrai texto
    const texts = (apiData.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    const clean = texts.replace(/```(?:json)?/gi, "").trim();
    let parsed = null;
    try { parsed = JSON.parse(clean); } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) try { parsed = JSON.parse(match[0]); } catch {}
    }

    if (!parsed) throw new Error("JSON inválido na resposta");

    const result = {
      ...parsed,
      geradoEm: new Date().toISOString(),
      cached: false,
    };

    // Salva cache
    cache = { data: result, ts: Date.now() };

    return res.status(200).json(result);
  } catch (err) {
    // Se tem cache antigo, serve mesmo expirado
    if (cache.data) {
      return res.status(200).json({
        ...cache.data,
        cached: true,
        cacheExpired: true,
        cacheAge: Math.round((Date.now() - cache.ts) / 60000) + "min",
      });
    }
    return res.status(500).json({ error: err.message || "Falha ao gerar resumo." });
  }
}
