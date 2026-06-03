// Retorna cotação do cobre LME + câmbio USD/BRL
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Câmbio USD/BRL — AwesomeAPI (gratuita, sem chave)
    const fxRes = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    const fxData = await fxRes.json();
    const usdBrl = parseFloat(fxData.USDBRL?.bid || "0");

    // Cobre LME via metals-api.com free tier
    // Fallback: usa valor simulado realista se API não disponível
    let copperUsd = null;
    let copperSource = "live";

    try {
      const metalsRes = await fetch(
        "https://api.metals.live/v1/spot/copper",
        { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(5000) }
      );
      if (metalsRes.ok) {
        const metalsData = await metalsRes.json();
        // metals.live retorna preço em USD/oz troy — converter para USD/t (tonelada métrica)
        // 1 tonelada = 32150.7 oz troy
        const pricePerOz = metalsData[0]?.price || metalsData?.price;
        if (pricePerOz) copperUsd = parseFloat(pricePerOz) * 32150.7;
      }
    } catch {}

    // Fallback: tenta outra fonte pública
    if (!copperUsd) {
      try {
        const r2 = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=XCU", {
          signal: AbortSignal.timeout(5000)
        });
        // XCU não existe na Coinbase — vai falhar graciosamente
      } catch {}
    }

    // Se não conseguiu cotação ao vivo, usa referência LME com timestamp
    if (!copperUsd) {
      copperSource = "reference";
      copperUsd = 9450; // Referência aproximada LME (atualizar conforme mercado)
    }

    const copperBrl = copperUsd * usdBrl;
    const copperKgBrl = copperBrl / 1000;
    const copperKgUsd = copperUsd / 1000;

    return res.status(200).json({
      copper: {
        usdTon: Math.round(copperUsd * 100) / 100,
        usdKg: Math.round(copperKgUsd * 4) / 4,
        brlTon: Math.round(copperBrl * 100) / 100,
        brlKg: Math.round(copperKgBrl * 100) / 100,
        source: copperSource,
        updatedAt: new Date().toISOString(),
      },
      fx: {
        usdBrl: Math.round(usdBrl * 10000) / 10000,
        updatedAt: new Date().toISOString(),
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao buscar cotações." });
  }
}
