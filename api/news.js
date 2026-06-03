// Resumo de mercado diário via Claude API
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const today = new Date().toLocaleDateString("pt-BR");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "Você é um analista especializado em mercado de cobre e metais não-ferrosos. Responda SEMPRE em português brasileiro. Seja direto e objetivo.",
        messages: [{
          role: "user",
          content: `Hoje é ${today}. Busque as principais notícias e eventos de hoje ou dos últimos 2 dias que afetam o mercado de cobre: cotação LME, fatores macro (China, Fed, dólar), oferta/demanda, eventos geopolíticos relevantes. Retorne um resumo estruturado em JSON com este formato exato:
{
  "titulo": "Resumo do Mercado de Cobre — [data]",
  "sentimento": "alta" | "baixa" | "neutro",
  "resumo": "2-3 frases resumindo o cenário geral",
  "destaques": ["destaque 1", "destaque 2", "destaque 3"],
  "fatores_alta": ["fator 1", "fator 2"],
  "fatores_baixa": ["fator 1", "fator 2"],
  "perspectiva": "frase curta sobre perspectiva de curto prazo"
}
Retorne APENAS o JSON, sem texto antes ou depois.`
        }]
      })
    });

    if (!r.ok) throw new Error(`Claude API error: ${r.status}`);
    const data = await r.json();

    // Extrai JSON da resposta
    const textBlock = data.content?.find(b => b.type === "text");
    const text = textBlock?.text || "";
    const clean = text.replace(/```(?:json)?/gi,"").trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("JSON inválido");
    }

    return res.status(200).json({ ...parsed, generatedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha ao gerar resumo." });
  }
}
