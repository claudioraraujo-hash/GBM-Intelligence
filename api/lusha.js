// GBM Intelligence — Integração Lusha v3
// Endpoints: company search, decision makers, contact prospecting

const BASE = "https://api.lusha.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const API_KEY = process.env.LUSHA_API_KEY || "";

  if (!API_KEY) {
    return res.status(500).json({
      error: "LUSHA_API_KEY não configurada.",
    });
  }

  const { acao } = req.query;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    api_key: API_KEY,
  };

  try {
    // ── BUSCAR EMPRESA ──
    if (acao === "empresa") {
      const { nome, dominio } = req.query;

      if (!nome && !dominio) {
        return res.status(400).json({
          error: "Informe nome ou domínio.",
        });
      }

      const body = {
        companies: [{}],
      };

      if (nome) body.companies[0].name = nome;
      if (dominio) body.companies[0].domain = dominio;

      console.log("LUSHA EMPRESA BODY:", JSON.stringify(body, null, 2));

      const r = await fetch(`${BASE}/v3/companies/search-and-enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Lusha empresa ${r.status}: ${err.slice(0, 500)}`);
      }

      const d = await r.json();

      return res.status(200).json({
        tipo: "empresa",
        dados: d,
        fonte: "Lusha v3",
      });
    }

    // ── DECISION MAKERS ──
    if (acao === "decisores") {
      const { companyName, companyDomain } = req.query;

      if (!companyName && !companyDomain) {
        return res.status(400).json({
          error: "Informe companyName ou companyDomain.",
        });
      }

      const cf = {};
      if (companyName) cf.names = [companyName];
      if (companyDomain) cf.domains = [companyDomain];
      const body = { pages:{page:0,size:20}, filters:{companies:{include:cf}} };

      console.log("LUSHA DECISORES BODY:", JSON.stringify(body, null, 2));

      const r = await fetch(`${BASE}/v3/contacts/prospecting`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Lusha decisores ${r.status}: ${err.slice(0, 500)}`);
      }

      const d = await r.json();

      return res.status(200).json({
        tipo: "decisores",
        dados: d,
        fonte: "Lusha v3",
      });
    }

    // ── PROSPECTING CONTATOS ──
    if (acao === "contatos") {
      const { companyNames, companyDomains, jobTitles, departments } = req.query;

      const ctf = {};
      if (departments) ctf.departments = departments.split(",").map((s) => s.trim());
      if (jobTitles) ctf.jobTitles = jobTitles.split(",").map((s) => s.trim());
      const cpf = {};
      if (companyNames) cpf.names = companyNames.split(",").map((s) => s.trim());
      if (companyDomains) cpf.domains = companyDomains.split(",").map((s) => s.trim());
      const body = { pages:{page:0,size:20}, filters:{} };
      if (Object.keys(ctf).length) body.filters.contacts = {include:ctf};
      if (Object.keys(cpf).length) body.filters.companies = {include:cpf};

      console.log("LUSHA CONTATOS BODY:", JSON.stringify(body, null, 2));

      const r = await fetch(`${BASE}/v3/contacts/prospecting`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Lusha contatos ${r.status}: ${err.slice(0, 500)}`);
      }

      const d = await r.json();

      return res.status(200).json({
        tipo: "contatos",
        dados: d,
        fonte: "Lusha v3",
      });
    }

    // ── ENRICH CONTATO ──
    if (acao === "enrich") {
      const { contactId, reveal } = req.query;

      if (!contactId) {
        return res.status(400).json({
          error: "Informe contactId.",
        });
      }

      const body = {
        ids: [contactId],
        reveal: reveal ? reveal.split(",") : ["emails", "phones"],
      };

      console.log("LUSHA ENRICH BODY:", JSON.stringify(body, null, 2));

      const r = await fetch(`${BASE}/v3/contacts/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Lusha enrich ${r.status}: ${err.slice(0, 500)}`);
      }

      const d = await r.json();

      return res.status(200).json({
        tipo: "enrich",
        dados: d,
        fonte: "Lusha v3",
      });
    }

    return res.status(400).json({
      error: "Ação inválida. Use: empresa, decisores, contatos, enrich",
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Falha na consulta Lusha.",
    });
  }
}
