// Vercel Serverless Function — proxy para publica.cnpj.ws
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { cnpj } = req.query;
  if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido." });
  }

  const raw = cnpj.replace(/\D/g, "");

  try {
    const response = await fetch(`https://publica.cnpj.ws/cnpj/${raw}`, {
      headers: { "Accept": "application/json", "User-Agent": "gbm-intelligence/1.0" },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Falha ao consultar a Receita Federal." });
  }
}
