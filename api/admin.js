// GBM Intelligence — Painel master: listar cadastros e aprovar/definir plano
// Protegido por ADMIN_SECRET (variável de ambiente). Só o administrador conhece.
import {
  supaConfigurado,
  listarUsuarios,
  atualizarUsuario,
  segundaFeiraAtual,
  CREDITOS_SEMANA,
} from "../lib/supa.js";

const PLANOS_VALIDOS = ["free", "business", "pro"];
const STATUS_VALIDOS = ["pendente", "aprovado", "rejeitado"];

// Cache do uso das APIs externas (limite de 5 req/min na Lusha)
let usageCache = null;
const USAGE_TTL = 60 * 1000;

// Tenta uma lista de endpoints de saldo; retorna o 1º que responder 200 com JSON.
async function tentarEndpoints(candidatos) {
  for (const c of candidatos) {
    try {
      const r = await fetch(c.url, {
        method: c.method || "GET",
        headers: c.headers,
        body: c.body,
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const txt = await r.text();
        try { return { ok: true, json: JSON.parse(txt) }; } catch { return { ok: true, json: null, txt }; }
      }
    } catch {}
  }
  return { ok: false };
}

// Busca profunda por um campo numérico de saldo dentro do JSON de resposta.
function extrairSaldo(obj) {
  const chaves = ["saldo","saldo_atual","saldoatual","creditos","credito","credits","balance","remaining","restante","restantes","disponivel","disponiveis","quantidade"];
  let achado = null;
  const visita = (o) => {
    if (achado != null || !o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (achado != null) break;
      if (typeof v === "number" && chaves.includes(k.toLowerCase())) { achado = v; return; }
      if (typeof v === "string" && chaves.includes(k.toLowerCase()) && v.trim() !== "" && !isNaN(Number(v))) { achado = Number(v); return; }
      if (v && typeof v === "object") visita(v);
    }
  };
  visita(obj);
  return achado;
}

async function coletarUsoAPIs() {
  const apis = [];

  // ── Lusha — Prospecção Avançada (endpoint oficial de uso) ──
  const lushaKey = process.env.LUSHA_API_KEY || "";
  if (lushaKey) {
    try {
      const r = await fetch("https://api.lusha.com/account/usage", {
        headers: { api_key: lushaKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        const d = await r.json();
        apis.push({
          id: "lusha",
          nome: "Lusha — Prospecção Avançada",
          restantes: d?.credits?.remaining ?? null,
          total: d?.credits?.total ?? null,
          usados: d?.credits?.used ?? null,
          plano: d?.plan?.category || null,
          renovaEm: d?.plan?.endDate || null,
          limiteDiario: d?.rateLimits?.daily || null,
        });
      } else {
        apis.push({ id: "lusha", nome: "Lusha — Prospecção Avançada", erro: `HTTP ${r.status}` });
      }
    } catch (e) {
      apis.push({ id: "lusha", nome: "Lusha — Prospecção Avançada", erro: e.message });
    }
  } else {
    apis.push({ id: "lusha", nome: "Lusha — Prospecção Avançada", erro: "chave não configurada" });
  }

  // ── Casa dos Dados — Prospecção (exportação em massa) ──
  const cddKey = process.env.CASA_DADOS_API_KEY || "";
  if (cddKey) {
    const h = { "api-key": cddKey, Accept: "application/json" };
    const res = await tentarEndpoints([
      { url: "https://api.casadosdados.com.br/v5/saldo", headers: h },
      { url: "https://api.casadosdados.com.br/v4/saldo", headers: h },
      { url: "https://api.casadosdados.com.br/v5/conta/saldo", headers: h },
    ]);
    const s = res.ok ? extrairSaldo(res.json) : null;
    apis.push(s != null
      ? { id: "casadosdados", nome: "Casa dos Dados — Prospecção", restantes: s, total: null }
      : { id: "casadosdados", nome: "Casa dos Dados — Prospecção", erro: res.ok ? "saldo não localizado na resposta" : "saldo indisponível" });
  } else {
    apis.push({ id: "casadosdados", nome: "Casa dos Dados — Prospecção", erro: "chave não configurada" });
  }

  // ── API Full — Crédito (Boa Vista/Serasa) ──
  const apifullKey = process.env.APIFULL_API_KEY || "";
  if (apifullKey) {
    const h = { Authorization: `Bearer ${apifullKey}`, Accept: "application/json", "Content-Type": "application/json" };
    const res = await tentarEndpoints([
      { url: "https://api.apifull.com.br/api/saldo", headers: h },
      { url: "https://api.apifull.com.br/api/saldo", method: "POST", headers: h, body: "{}" },
      { url: "https://api.apifull.com.br/api/consultar-saldo", headers: h },
      { url: "https://api.apifull.com.br/api/creditos", headers: h },
    ]);
    const s = res.ok ? extrairSaldo(res.json) : null;
    apis.push(s != null
      ? { id: "apifull", nome: "API Full — Crédito", restantes: s, total: null }
      : { id: "apifull", nome: "API Full — Crédito", erro: res.ok ? "saldo não localizado na resposta" : "saldo indisponível" });
  } else {
    apis.push({ id: "apifull", nome: "API Full — Crédito", erro: "chave não configurada" });
  }

  // ── Valida — Crédito/CNPJ ──
  const validaKey = process.env.VALIDA_API_KEY || "";
  if (validaKey) {
    const h = { Authorization: `Bearer ${validaKey}`, Accept: "application/json" };
    const res = await tentarEndpoints([
      { url: "https://valida.api.br/api/v1/saldo", headers: h },
      { url: "https://valida.api.br/api/v1/creditos", headers: h },
      { url: "https://valida.api.br/api/v1/account", headers: h },
    ]);
    const s = res.ok ? extrairSaldo(res.json) : null;
    apis.push(s != null
      ? { id: "valida", nome: "Valida — Crédito/CNPJ", restantes: s, total: null }
      : { id: "valida", nome: "Valida — Crédito/CNPJ", erro: res.ok ? "saldo não localizado na resposta" : "saldo indisponível" });
  } else {
    apis.push({ id: "valida", nome: "Valida — Crédito/CNPJ", erro: "chave não configurada" });
  }

  return apis;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");
  if (req.method === "OPTIONS") return res.status(200).end();

  const SECRET = process.env.ADMIN_SECRET || "";
  if (!SECRET) {
    return res.status(500).json({ error: "ADMIN_SECRET não configurada no servidor." });
  }
  if (!supaConfigurado()) {
    return res.status(500).json({ error: "Banco de dados não configurado." });
  }

  const { acao } = req.query;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const enviado = req.headers["x-admin-secret"] || body.secret || "";

  // Valida a senha master em toda ação (inclusive login).
  if (enviado !== SECRET) {
    return res.status(401).json({ error: "Acesso negado." });
  }

  try {
    // ── LOGIN MASTER (apenas valida a senha) ──
    if (acao === "login") {
      return res.status(200).json({ ok: true });
    }

    // ── CRÉDITOS DAS APIs EXTERNAS ──
    if (acao === "usage") {
      if (usageCache && Date.now() - usageCache.ts < USAGE_TTL) {
        return res.status(200).json({ ok: true, apis: usageCache.apis, cached: true });
      }
      const apis = await coletarUsoAPIs();
      usageCache = { apis, ts: Date.now() };
      return res.status(200).json({ ok: true, apis });
    }

    // ── LISTAR USUÁRIOS ──
    if (acao === "list") {
      const usuarios = await listarUsuarios();
      return res.status(200).json({ ok: true, usuarios });
    }

    // ── ATUALIZAR (plano + status) ──
    if (acao === "update") {
      const { id, plano, status } = body;
      if (!id) return res.status(400).json({ error: "Informe o id do usuário." });

      const patch = {};
      if (plano !== undefined) {
        if (plano !== null && !PLANOS_VALIDOS.includes(plano)) {
          return res.status(400).json({ error: "Plano inválido." });
        }
        patch.plano = plano;
        // Ao definir Business, inicializa a semana de créditos.
        if (plano === "business") {
          patch.creditos_prosp = CREDITOS_SEMANA;
          patch.semana_ref = segundaFeiraAtual();
        }
      }
      if (status !== undefined) {
        if (!STATUS_VALIDOS.includes(status)) {
          return res.status(400).json({ error: "Status inválido." });
        }
        patch.status = status;
        if (status === "aprovado") patch.aprovado_em = new Date().toISOString();
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "Nada para atualizar." });
      }

      const atualizado = await atualizarUsuario(id, patch);
      return res.status(200).json({ ok: true, usuario: atualizado });
    }

    return res.status(400).json({ error: "Ação inválida. Use login, list ou update." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha na operação administrativa." });
  }
}
