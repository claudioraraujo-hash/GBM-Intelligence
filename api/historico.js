// GBM Intelligence — Histórico de consultas CNPJ (aba Consulta)
// Salva cada consulta no banco (permanente, por usuário) e permite listar o histórico pessoal.
import {
  supaConfigurado,
  inserirConsulta,
  listarConsultasPorUsuario,
} from "../lib/supa.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!supaConfigurado()) {
    return res.status(500).json({ error: "Banco de dados não configurado." });
  }

  const { acao } = req.query;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  try {
    // ── SALVAR CONSULTA ──
    if (acao === "save") {
      const { userId, cnpj, razaoSocial, situacao } = body;
      if (!userId || !cnpj) {
        return res.status(400).json({ error: "Informe userId e cnpj." });
      }
      const registro = await inserirConsulta({
        usuario_id: userId,
        cnpj,
        razao_social: razaoSocial || null,
        situacao: situacao || null,
      });
      return res.status(200).json({ ok: true, registro });
    }

    // ── LISTAR HISTÓRICO PESSOAL ──
    if (acao === "list") {
      const { userId } = body;
      if (!userId) return res.status(400).json({ error: "Informe userId." });
      const consultas = await listarConsultasPorUsuario(userId, 30);
      return res.status(200).json({ ok: true, consultas });
    }

    return res.status(400).json({ error: "Ação inválida. Use save ou list." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha no histórico." });
  }
}
