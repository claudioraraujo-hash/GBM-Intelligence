export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  const { cnpj } = req.query;
  if (!cnpj || cnpj.replace(/\D/g,"").length !== 14)
    return res.status(400).json({ error: "CNPJ inválido." });
  const raw = cnpj.replace(/\D/g,"");
  try {
    const r = await fetch(`https://publica.cnpj.ws/cnpj/${raw}`, {
      headers: { "Accept": "application/json", "User-Agent": "gbm-intelligence/1.0" }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: "Falha ao consultar a Receita Federal." });
  }
}
