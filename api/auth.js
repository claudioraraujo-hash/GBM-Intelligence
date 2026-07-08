// GBM Intelligence — Autenticação: cadastro (pendente) e login
import {
  supaConfigurado,
  buscarPorEmail,
  inserirUsuario,
  hashSenha,
  verificarSenha,
} from "../lib/supa.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!supaConfigurado()) {
    return res.status(500).json({ error: "Banco de dados não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_KEY." });
  }

  const { acao } = req.query;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  try {
    // ── CADASTRO ──
    if (acao === "register") {
      const nome = (body.nome || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      const empresa = (body.empresa || "").trim();
      const telefone = (body.telefone || "").trim();
      const senha = body.senha || "";

      if (!nome || !email || !senha) {
        return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "E-mail inválido." });
      }
      if (senha.length < 6) {
        return res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres." });
      }

      const existente = await buscarPorEmail(email);
      if (existente) {
        return res.status(409).json({ error: "Já existe um cadastro com este e-mail." });
      }

      await inserirUsuario({
        nome,
        email,
        empresa,
        telefone,
        senha_hash: hashSenha(senha),
        plano: null,
        status: "pendente",
        creditos_prosp: 0,
        semana_ref: null,
        criado_em: new Date().toISOString(),
      });

      return res.status(200).json({ ok: true, mensagem: "Cadastro enviado. Aguarde a aprovação do administrador." });
    }

    // ── LOGIN ──
    if (acao === "login") {
      const email = (body.email || "").trim().toLowerCase();
      const senha = body.senha || "";
      if (!email || !senha) {
        return res.status(400).json({ error: "Informe e-mail e senha." });
      }

      const u = await buscarPorEmail(email);
      if (!u || !verificarSenha(senha, u.senha_hash)) {
        return res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
      if (u.status === "pendente") {
        return res.status(403).json({ error: "Seu cadastro ainda está em análise. Aguarde a aprovação." });
      }
      if (u.status === "rejeitado") {
        return res.status(403).json({ error: "Seu acesso não foi liberado. Entre em contato com o administrador." });
      }
      if (u.status !== "aprovado" || !u.plano) {
        return res.status(403).json({ error: "Acesso indisponível. Contate o administrador." });
      }

      return res.status(200).json({
        ok: true,
        user: {
          id: u.id,
          nome: u.nome,
          email: u.email,
          empresa: u.empresa,
          plan: u.plano,
        },
      });
    }

    return res.status(400).json({ error: "Ação inválida. Use register ou login." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha na autenticação." });
  }
}
