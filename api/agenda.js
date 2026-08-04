// GBM Intelligence — Agenda: Google Calendar + Outlook (Microsoft 365) corporativo
// Recurso pessoal do Master. Sincroniza eventos do Outlook para um calendário
// dedicado dentro do Google Calendar ("Outlook Corporativo — GBM").
import {
  supaConfigurado,
  buscarTokenAgenda,
  salvarTokenAgenda,
} from "../lib/supa.js";

const REDIRECT_BASE = "https://gbm-intelligence.vercel.app";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar";
const MS_SCOPES = "offline_access Calendars.Read User.Read";
const GOOGLE_CAL_NOME = "Outlook Corporativo — GBM";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { acao } = req.query;
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

  try {
    // ── INICIAR CONEXÃO GOOGLE (redireciona pro consentimento) ──
    if (acao === "google-connect") {
      if (!ADMIN_SECRET || req.query.secret !== ADMIN_SECRET) {
        return res.status(401).send("Acesso negado.");
      }
      const clientId = process.env.GOOGLE_CLIENT_ID || "";
      if (!clientId) return res.status(500).send("GOOGLE_CLIENT_ID não configurada.");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${REDIRECT_BASE}/api/agenda?acao=google-callback`,
        response_type: "code",
        scope: GOOGLE_SCOPES,
        access_type: "offline",
        prompt: "consent",
        state: ADMIN_SECRET,
      });
      res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
      return res.end();
    }

    // ── CALLBACK GOOGLE ──
    if (acao === "google-callback") {
      const { code, state, error } = req.query;
      if (error) return res.status(400).send(`Erro do Google: ${error}`);
      if (!ADMIN_SECRET || state !== ADMIN_SECRET) return res.status(401).send("Estado inválido — inicie a conexão novamente pelo app.");

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: `${REDIRECT_BASE}/api/agenda?acao=google-callback`,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(10000),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) return res.status(400).send(`Falha ao trocar código com o Google: ${JSON.stringify(tokenJson)}`);
      if (!tokenJson.refresh_token) {
        return res.status(400).send(
          "O Google não retornou um refresh_token (isso acontece se você já autorizou antes). " +
          "Revogue o acesso em https://myaccount.google.com/permissions (procure 'GBM Intelligence') e tente conectar de novo."
        );
      }
      await salvarTokenAgenda("google", {
        refresh_token: tokenJson.refresh_token,
        access_token: tokenJson.access_token,
        expires_at: new Date(Date.now() + (tokenJson.expires_in || 3600) * 1000).toISOString(),
      });
      res.writeHead(302, { Location: `${REDIRECT_BASE}/?agenda=google_ok` });
      return res.end();
    }

    // ── INICIAR CONEXÃO MICROSOFT ──
    if (acao === "microsoft-connect") {
      if (!ADMIN_SECRET || req.query.secret !== ADMIN_SECRET) {
        return res.status(401).send("Acesso negado.");
      }
      const clientId = process.env.MS_CLIENT_ID || "";
      const tenant = process.env.MS_TENANT_ID || "common";
      if (!clientId) return res.status(500).send("MS_CLIENT_ID não configurada.");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${REDIRECT_BASE}/api/agenda?acao=microsoft-callback`,
        response_type: "code",
        response_mode: "query",
        scope: MS_SCOPES,
        state: ADMIN_SECRET,
      });
      res.writeHead(302, { Location: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}` });
      return res.end();
    }

    // ── CALLBACK MICROSOFT ──
    if (acao === "microsoft-callback") {
      const { code, state, error, error_description } = req.query;
      if (error) return res.status(400).send(`Erro da Microsoft: ${error} — ${error_description || ""}`);
      if (!ADMIN_SECRET || state !== ADMIN_SECRET) return res.status(401).send("Estado inválido — inicie a conexão novamente pelo app.");

      const tenant = process.env.MS_TENANT_ID || "common";
      const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.MS_CLIENT_ID || "",
          client_secret: process.env.MS_CLIENT_SECRET || "",
          redirect_uri: `${REDIRECT_BASE}/api/agenda?acao=microsoft-callback`,
          grant_type: "authorization_code",
          scope: MS_SCOPES,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) return res.status(400).send(`Falha ao trocar código com a Microsoft: ${JSON.stringify(tokenJson)}`);
      await salvarTokenAgenda("microsoft", {
        refresh_token: tokenJson.refresh_token,
        access_token: tokenJson.access_token,
        expires_at: new Date(Date.now() + (tokenJson.expires_in || 3600) * 1000).toISOString(),
      });
      res.writeHead(302, { Location: `${REDIRECT_BASE}/?agenda=microsoft_ok` });
      return res.end();
    }

    if (!supaConfigurado()) {
      return res.status(500).json({ error: "Banco de dados não configurado." });
    }

    // ── STATUS (contas conectadas?) ──
    if (acao === "status") {
      const [g, m] = await Promise.all([buscarTokenAgenda("google"), buscarTokenAgenda("microsoft")]);
      return res.status(200).json({ ok: true, google: !!g, microsoft: !!m });
    }

    // ── SINCRONIZAR + LISTAR EVENTOS ──
    if (acao === "sync") {
      const resultado = await sincronizar();
      return res.status(200).json({ ok: true, ...resultado });
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Falha na Agenda." });
  }
}

// ── Renovação de access token ────────────────────────────────────────────────
async function googleAccessToken() {
  const stored = await buscarTokenAgenda("google");
  if (!stored) throw new Error("Google Calendar não conectado.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: stored.refresh_token,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Renovação Google falhou: ${JSON.stringify(json)}`);
  await salvarTokenAgenda("google", {
    refresh_token: stored.refresh_token,
    access_token: json.access_token,
    expires_at: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
  });
  return json.access_token;
}

async function microsoftAccessToken() {
  const stored = await buscarTokenAgenda("microsoft");
  if (!stored) throw new Error("Outlook corporativo não conectado.");
  const tenant = process.env.MS_TENANT_ID || "common";
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID || "",
      client_secret: process.env.MS_CLIENT_SECRET || "",
      refresh_token: stored.refresh_token,
      grant_type: "refresh_token",
      scope: MS_SCOPES,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Renovação Microsoft falhou: ${JSON.stringify(json)}`);
  // Microsoft pode rotacionar o refresh_token a cada renovação
  await salvarTokenAgenda("microsoft", {
    refresh_token: json.refresh_token || stored.refresh_token,
    access_token: json.access_token,
    expires_at: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
  });
  return json.access_token;
}

// ── Microsoft Graph ───────────────────────────────────────────────────────────
async function buscarEventosOutlook(accessToken) {
  const agora = new Date();
  const inicio = new Date(agora); inicio.setDate(inicio.getDate() - 7);
  const fim = new Date(agora); fim.setDate(fim.getDate() + 60);
  const params = new URLSearchParams({
    startDateTime: inicio.toISOString(),
    endDateTime: fim.toISOString(),
    $orderby: "start/dateTime",
    $top: "100",
  });
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/calendarview?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="America/Sao_Paulo"',
    },
    signal: AbortSignal.timeout(15000),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Microsoft Graph: ${JSON.stringify(json)}`);
  return json.value || [];
}

// ── Google Calendar ────────────────────────────────────────────────────────────
async function googleCalendarId(accessToken) {
  const r = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Google calendarList: ${JSON.stringify(json)}`);
  const existente = (json.items || []).find(c => c.summary === GOOGLE_CAL_NOME);
  if (existente) return existente.id;

  const criar = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: GOOGLE_CAL_NOME, timeZone: "America/Sao_Paulo" }),
    signal: AbortSignal.timeout(10000),
  });
  const criadoJson = await criar.json();
  if (!criar.ok) throw new Error(`Google criar calendário: ${JSON.stringify(criadoJson)}`);
  return criadoJson.id;
}

async function upsertEventoGoogle(accessToken, calendarId, outlookEvent) {
  const outlookId = outlookEvent.id;
  const buscaParams = new URLSearchParams({ privateExtendedProperty: `outlookEventId=${outlookId}` });
  const busca = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${buscaParams}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
  );
  const buscaJson = await busca.json();
  const existenteId = buscaJson.items?.[0]?.id || null;

  const corpo = {
    summary: outlookEvent.subject || "(Sem título)",
    description: `${outlookEvent.bodyPreview || ""}\n\n— Sincronizado automaticamente do Outlook corporativo (GBM Intelligence)`,
    location: outlookEvent.location?.displayName || undefined,
    start: outlookEvent.isAllDay
      ? { date: outlookEvent.start.dateTime.slice(0, 10) }
      : { dateTime: outlookEvent.start.dateTime, timeZone: outlookEvent.start.timeZone || "America/Sao_Paulo" },
    end: outlookEvent.isAllDay
      ? { date: outlookEvent.end.dateTime.slice(0, 10) }
      : { dateTime: outlookEvent.end.dateTime, timeZone: outlookEvent.end.timeZone || "America/Sao_Paulo" },
    extendedProperties: { private: { outlookEventId: outlookId } },
  };

  const url = existenteId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existenteId}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const r = await fetch(url, {
    method: existenteId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(10000),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Google evento: ${JSON.stringify(json)}`);
  return json;
}

async function listarEventosGoogle(accessToken, calendarId, inicioISO, fimISO) {
  const params = new URLSearchParams({
    timeMin: inicioISO, timeMax: fimISO,
    singleEvents: "true", orderBy: "startTime", maxResults: "100",
  });
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
  );
  const json = await r.json();
  if (!r.ok) throw new Error(`Google lista: ${JSON.stringify(json)}`);
  return json.items || [];
}

// ── Orquestração ──────────────────────────────────────────────────────────────
async function sincronizar() {
  const [gToken, mToken] = await Promise.allSettled([googleAccessToken(), microsoftAccessToken()]);

  if (gToken.status === "rejected") {
    throw new Error(gToken.reason?.message || "Falha ao autenticar com o Google.");
  }
  const googleToken = gToken.value;
  const calendarId = await googleCalendarId(googleToken);

  let sincronizados = 0;
  let erroOutlook = null;
  if (mToken.status === "fulfilled") {
    try {
      const eventosOutlook = await buscarEventosOutlook(mToken.value);
      for (const ev of eventosOutlook) {
        await upsertEventoGoogle(googleToken, calendarId, ev);
        sincronizados++;
      }
    } catch (e) { erroOutlook = e.message; }
  } else {
    erroOutlook = mToken.reason?.message || "Outlook corporativo não conectado.";
  }

  const agora = new Date();
  const inicio = new Date(agora); inicio.setDate(inicio.getDate() - 3);
  const fim = new Date(agora); fim.setDate(fim.getDate() + 45);

  const [nativos, sync] = await Promise.all([
    listarEventosGoogle(googleToken, "primary", inicio.toISOString(), fim.toISOString()),
    listarEventosGoogle(googleToken, calendarId, inicio.toISOString(), fim.toISOString()),
  ]);

  const normaliza = (items, origem) => items.map(ev => ({
    id: ev.id,
    titulo: ev.summary || "(Sem título)",
    inicio: ev.start?.dateTime || ev.start?.date,
    fim: ev.end?.dateTime || ev.end?.date,
    diaTodo: !ev.start?.dateTime,
    local: ev.location || "",
    origem,
  }));

  const eventos = [...normaliza(nativos, "google"), ...normaliza(sync, "outlook")]
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  return { eventos, sincronizados, erroOutlook };
}
