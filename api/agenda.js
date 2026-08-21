// GBM Intelligence — Agenda: Google Calendar (+ e-mail corporativo via CalDAV, pausado)
// Recurso pessoal do Master. Mostra os eventos do Google Calendar (agenda pessoal +
// a agenda dedicada "Agenda Corporativa — GBM", onde dá pra lançar compromissos manualmente).
// A sincronização automática do CalDAV corporativo está pausada — ver CALDAV_ATIVO abaixo.
import {
  supaConfigurado,
  buscarTokenAgenda,
  salvarTokenAgenda,
} from "../lib/supa.js";

const REDIRECT_BASE = "https://gbm-intelligence.vercel.app";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar";
const GOOGLE_CAL_NOME = "Agenda Corporativa — GBM";

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

    if (!supaConfigurado()) {
      return res.status(500).json({ error: "Banco de dados não configurado." });
    }

    // ── STATUS (Google conectado? CalDAV configurado?) ──
    if (acao === "status") {
      const g = await buscarTokenAgenda("google");
      const caldavConfigurado = Boolean(process.env.CALDAV_URL && process.env.CALDAV_USER && process.env.CALDAV_PASSWORD);
      return res.status(200).json({
        ok: true, google: !!g, caldav: caldavConfigurado,
        googleAtualizadoEm: g?.atualizado_em || null,
        googleRefreshTokenInicio: g?.refresh_token ? g.refresh_token.slice(0, 12) : null,
      });
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

// ── Renovação de access token do Google ────────────────────────────────────────
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

// ── CalDAV (e-mail corporativo — HostGator/cPanel) ──────────────────────────────
async function buscarEventosCalDAV() {
  const url = process.env.CALDAV_URL || "";
  const user = process.env.CALDAV_USER || "";
  const pass = process.env.CALDAV_PASSWORD || "";
  if (!url || !user || !pass) throw new Error("CalDAV não configurado (CALDAV_URL/CALDAV_USER/CALDAV_PASSWORD).");

  const agora = new Date();
  const inicio = new Date(agora); inicio.setUTCDate(inicio.getUTCDate() - 7);
  const fim = new Date(agora); fim.setUTCDate(fim.getUTCDate() + 60);
  const fmtICS = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const corpoXML = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${fmtICS(inicio)}" end="${fmtICS(fim)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const r = await fetch(url, {
    method: "REPORT",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "1",
    },
    body: corpoXML,
    signal: AbortSignal.timeout(15000),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`CalDAV ${r.status}: ${texto.slice(0, 300)}`);

  // Extrai o conteúdo de cada <calendar-data> (ignora o prefixo de namespace, que varia por servidor)
  const blocosICS = [];
  const reDados = /<[a-zA-Z0-9]*:?calendar-data[^>]*>([\s\S]*?)<\/[a-zA-Z0-9]*:?calendar-data>/g;
  let m;
  while ((m = reDados.exec(texto)) !== null) {
    blocosICS.push(m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
  }

  const eventos = [];
  for (const ics of blocosICS) {
    const unfolded = unfoldICS(ics);
    for (const bloco of extrairVEVENTs(unfolded)) {
      const ev = parseVEventBloco(bloco);
      if (ev) eventos.push(ev);
    }
  }
  return eventos;
}

// Desfaz o "line folding" do formato iCalendar (RFC 5545)
function unfoldICS(ics) {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function extrairVEVENTs(ics) {
  const blocos = [];
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = re.exec(ics)) !== null) blocos.push(m[1]);
  return blocos;
}

function parseLinhaICS(linha) {
  const idx = linha.indexOf(":");
  if (idx === -1) return null;
  const chaveComParams = linha.slice(0, idx);
  const valor = linha.slice(idx + 1);
  const [nome, ...paramsArr] = chaveComParams.split(";");
  const params = {};
  for (const p of paramsArr) {
    const [k, v] = p.split("=");
    if (k) params[k.toUpperCase()] = v;
  }
  return { nome: nome.toUpperCase(), params, valor };
}

// Datas no formato iCalendar: "20260810" (dia todo) ou "20260810T140000(Z)?"
function parseDataICS(valor, params) {
  if (params.VALUE === "DATE" || /^\d{8}$/.test(valor)) {
    const y = valor.slice(0, 4), mo = valor.slice(4, 6), d = valor.slice(6, 8);
    return { diaTodo: true, data: `${y}-${mo}-${d}` };
  }
  const mm = valor.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!mm) return { diaTodo: false, dataHora: null, timeZone: "America/Sao_Paulo" };
  const [, y, mo, d, h, mi, s, z] = mm;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  if (z === "Z") return { diaTodo: false, dataHora: `${iso}Z`, timeZone: null };
  return { diaTodo: false, dataHora: iso, timeZone: params.TZID || "America/Sao_Paulo" };
}

function parseVEventBloco(bloco) {
  const linhas = bloco.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const campos = {};
  for (const linha of linhas) {
    const p = parseLinhaICS(linha);
    if (!p) continue;
    if (!campos[p.nome]) campos[p.nome] = p; // primeira ocorrência de cada campo
  }
  if (!campos.DTSTART) return null;

  const inicioInfo = parseDataICS(campos.DTSTART.valor, campos.DTSTART.params);
  const fimInfo = campos.DTEND ? parseDataICS(campos.DTEND.valor, campos.DTEND.params) : inicioInfo;

  const unescapeTexto = (s = "") => s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

  let titulo = unescapeTexto(campos.SUMMARY?.valor || "(Sem título)");
  if (campos.RRULE) titulo += " (recorrente)"; // recorrência não é expandida no cliente — mostra 1ª ocorrência

  return {
    uid: campos.UID?.valor || `${campos.DTSTART.valor}-${titulo}`,
    titulo,
    descricao: unescapeTexto(campos.DESCRIPTION?.valor || ""),
    local: unescapeTexto(campos.LOCATION?.valor || ""),
    diaTodo: inicioInfo.diaTodo,
    inicio: inicioInfo,
    fim: fimInfo,
  };
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

async function upsertEventoGoogle(accessToken, calendarId, evento) {
  const buscaParams = new URLSearchParams({ privateExtendedProperty: `caldavUid=${evento.uid}` });
  const busca = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${buscaParams}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
  );
  const buscaJson = await busca.json();
  const existenteId = buscaJson.items?.[0]?.id || null;

  const montaData = (info) => info.diaTodo
    ? { date: info.data }
    : info.dataHora.endsWith("Z")
      ? { dateTime: info.dataHora }
      : { dateTime: info.dataHora, timeZone: info.timeZone || "America/Sao_Paulo" };

  const corpo = {
    summary: evento.titulo,
    description: `${evento.descricao}\n\n— Sincronizado automaticamente do e-mail corporativo (GBM Intelligence)`,
    location: evento.local || undefined,
    start: montaData(evento.inicio),
    end: montaData(evento.fim),
    extendedProperties: { private: { caldavUid: evento.uid } },
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

// Sync do e-mail corporativo (CalDAV) pausado: o backend Kolab/cPanel da HostGator
// não responde de forma consistente às consultas REPORT/PROPFIND via script, mesmo
// com a URL correta (confirmada via macOS Calendar). Reativar exige suporte da
// HostGator para entender o método de consulta esperado por esse backend específico.
const CALDAV_ATIVO = false;

// ── Orquestração ──────────────────────────────────────────────────────────────
async function sincronizar() {
  const googleToken = await googleAccessToken();
  const calendarId = await googleCalendarId(googleToken);

  let sincronizados = 0;
  let erroCorporativo = null;
  if (CALDAV_ATIVO) {
    try {
      const eventosCorp = await buscarEventosCalDAV();
      for (const ev of eventosCorp) {
        await upsertEventoGoogle(googleToken, calendarId, ev);
        sincronizados++;
      }
    } catch (e) { erroCorporativo = e.message; }
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

  const eventos = [...normaliza(nativos, "google"), ...normaliza(sync, "corporativo")]
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  return { eventos, sincronizados, erroCorporativo };
}
