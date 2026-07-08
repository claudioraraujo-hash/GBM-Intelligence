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
