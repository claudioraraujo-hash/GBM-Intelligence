// GBM Intelligence — Créditos semanais da Prospecção Avançada (plano Business)
// Regra: 10 por semana (seg→dom), acumulativos. Pró = ilimitado. Free = sem acesso.
import {
  supaConfigurado,
  buscarPorId,
  atualizarUsuario,
  recalcularCreditos,
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
  const id = body.id;
  if (!id) return res.status(400).json({ error: "Informe o id do usuário." });

  try {
    const u = await buscarPorId(id);
    if (!u || u.status !== "aprovado") {
      return res.status(403).json({ error: "Usuário sem acesso." });
    }

    // Pró — ilimitado
    if (u.plano === "pro") {
      return res.status(200).json({ ok: true, ilimitado: true, saldo: null });
    }
    // Somente Business tem a Prospecção Avançada por créditos
    if (u.plano !== "business") {
      return res.status(403).json({ acesso: false, error: "Plano sem acesso à Prospecção Avançada." });
    }

    const { saldo, semanaRef, mudou } = recalcularCreditos(u);

    // ── VERIFICAR (não consome) ──
    if (acao === "check") {
      if (mudou) await atualizarUsuario(id, { creditos_prosp: saldo, semana_ref: semanaRef });
      return res.status(200).json({ ok: true, saldo });
    }

    // ── CONSUMIR 1 crédito ──
    if (acao === "consume") {
      if (saldo <= 0) {
        if (mudou) await atualizarUsuario(id, { creditos_prosp: saldo, semana_ref: semanaRef });
        return res.status(200).json({ ok: false, saldo: 0, esgotado: true });
      }
      const novoSaldo = saldo - 1;
      await atualizarUsuario(id, { creditos_prosp: novoSaldo, semana_ref: semanaRef });
      return res.status(200).json({ ok: true, saldo: novoSaldo });
    }

    return res.status(400).json({ error: "Ação inválida. Use check ou consume." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha ao processar créditos." });
  }
}
