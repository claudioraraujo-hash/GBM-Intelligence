// GBM Intelligence — Helpers compartilhados: Supabase REST, hash de senha, créditos semanais
import crypto from "node:crypto";

const URL = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";

export const CREDITOS_SEMANA = 10; // Prospecção Avançada — plano Business

// ── Supabase REST (PostgREST) ──────────────────────────────────────────────
function headers(extra = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function supaConfigurado() {
  return Boolean(URL && KEY);
}

// Verificação leve de saúde do banco (não retorna dados).
// Também serve para manter o projeto Supabase ativo (evita pausa por inatividade).
export async function pingBanco() {
  const r = await fetch(`${URL}/rest/v1/usuarios?select=id&limit=1`, {
    headers: headers(),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
  await r.json();
  return true;
}

// Busca usuário por email (case-insensitive). Retorna objeto ou null.
export async function buscarPorEmail(email) {
  const q = encodeURIComponent(email.trim().toLowerCase());
  const r = await fetch(`${URL}/rest/v1/usuarios?email=eq.${q}&select=*`, {
    headers: headers(),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase busca ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0] || null;
}

export async function buscarPorId(id) {
  const r = await fetch(`${URL}/rest/v1/usuarios?id=eq.${id}&select=*`, {
    headers: headers(),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase busca ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0] || null;
}

export async function listarUsuarios() {
  const r = await fetch(
    `${URL}/rest/v1/usuarios?select=id,nome,email,empresa,telefone,plano,status,creditos_prosp,semana_ref,criado_em,aprovado_em&order=criado_em.desc`,
    { headers: headers(), signal: AbortSignal.timeout(10000) }
  );
  if (!r.ok) throw new Error(`Supabase lista ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function inserirUsuario(dados) {
  const r = await fetch(`${URL}/rest/v1/usuarios`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(dados),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase insert ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0];
}

export async function atualizarUsuario(id, dados) {
  const r = await fetch(`${URL}/rest/v1/usuarios?id=eq.${id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(dados),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase update ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0];
}

// ── Histórico de consultas CNPJ (aba Consulta) ──────────────────────────────
export async function inserirConsulta({ usuario_id, cnpj, razao_social, situacao }) {
  const r = await fetch(`${URL}/rest/v1/consultas_cnpj`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ usuario_id, cnpj, razao_social, situacao }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase insert consulta ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0];
}

export async function listarConsultasPorUsuario(usuario_id, limite = 30) {
  const r = await fetch(
    `${URL}/rest/v1/consultas_cnpj?usuario_id=eq.${usuario_id}&select=*&order=criado_em.desc&limit=${limite}`,
    { headers: headers(), signal: AbortSignal.timeout(10000) }
  );
  if (!r.ok) throw new Error(`Supabase lista consultas ${r.status}: ${await r.text()}`);
  return r.json();
}

// Todas as consultas de todos os usuários, com nome/email do usuário embutido (para o Painel Master).
export async function listarTodasConsultas(limite = 300) {
  const r = await fetch(
    `${URL}/rest/v1/consultas_cnpj?select=*,usuarios(nome,email,plano)&order=criado_em.desc&limit=${limite}`,
    { headers: headers(), signal: AbortSignal.timeout(10000) }
  );
  if (!r.ok) throw new Error(`Supabase lista consultas ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Agenda — tokens OAuth (Google Calendar / Microsoft Outlook) ────────────
export async function buscarTokenAgenda(provider) {
  const r = await fetch(`${URL}/rest/v1/agenda_tokens?provider=eq.${provider}&select=*`, {
    headers: headers(), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase busca token ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0] || null;
}

export async function salvarTokenAgenda(provider, dados) {
  const r = await fetch(`${URL}/rest/v1/agenda_tokens`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({ provider, ...dados, atualizado_em: new Date().toISOString() }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase salva token ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0];
}

// ── Senha (scrypt, sem dependências externas) ──────────────────────────────
export function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha, armazenado) {
  if (!armazenado || !armazenado.includes(":")) return false;
  const [salt, hash] = armazenado.split(":");
  const teste = crypto.scryptSync(senha, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(teste, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Semana de referência (segunda a domingo, horário de Brasília) ───────────
// Retorna a data (YYYY-MM-DD) da segunda-feira da semana atual.
export function segundaFeiraAtual() {
  const brasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dow = brasilia.getDay(); // 0=domingo ... 6=sábado
  const diffParaSegunda = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(brasilia);
  mon.setDate(brasilia.getDate() + diffParaSegunda);
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, "0");
  const d = String(mon.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Quantidade de semanas completas entre duas segundas-feiras (YYYY-MM-DD).
export function semanasEntre(segundaAntiga, segundaAtual) {
  if (!segundaAntiga) return 0;
  const a = new Date(`${segundaAntiga}T00:00:00Z`);
  const b = new Date(`${segundaAtual}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / (7 * 86400000)));
}

// Recalcula o saldo de créditos aplicando o acúmulo semanal (10/semana).
// Retorna { saldo, semanaRef, mudou }. NÃO grava — quem chama decide.
export function recalcularCreditos(usuario) {
  const monAtual = segundaFeiraAtual();
  // Primeiro acesso do Business: inicia com 1 semana de créditos.
  if (!usuario.semana_ref) {
    return { saldo: CREDITOS_SEMANA, semanaRef: monAtual, mudou: true };
  }
  const semanas = semanasEntre(usuario.semana_ref, monAtual);
  if (semanas > 0) {
    return {
      saldo: (usuario.creditos_prosp || 0) + semanas * CREDITOS_SEMANA,
      semanaRef: monAtual,
      mudou: true,
    };
  }
  return { saldo: usuario.creditos_prosp || 0, semanaRef: usuario.semana_ref, mudou: false };
}
