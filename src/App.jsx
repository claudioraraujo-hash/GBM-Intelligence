import { useState, useEffect, useCallback } from "react";
import CreditReportComponent from "./CreditReport";

// ─── Auth / Planos ────────────────────────────────────────────────────────────
const PLANS = {
  free:     { label: "Free",     color: "#64748b", limit: 5 },
  pro:      { label: "Pro",      color: "#f59e0b", limit: Infinity },
  business: { label: "Business", color: "#10b981", limit: Infinity },
};

const DEMO_USERS = [
  { email: "demo@gbm.com",      password: "gbm2025", name: "Demo GBM",    plan: "free"     },
  { email: "pro@gbm.com",       password: "gbm2025", name: "Usuário Pro", plan: "pro"      },
  { email: "business@gbm.com",  password: "gbm2025", name: "GBM Admin",   plan: "business" },
];

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = {
  cnpj: (v="") => { const d=v.replace(/\D/g,"").slice(0,14); return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2"); },
  money: (v,currency="BRL") => { const n=parseFloat(v); return isNaN(n)?"—":n.toLocaleString("pt-BR",{style:"currency",currency}); },
  moneyUSD: (v) => { const n=parseFloat(v); return isNaN(n)?"—":`US$ ${n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`; },
  num: (v,dec=2) => { const n=parseFloat(v); return isNaN(n)?"—":n.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec}); },
  date: (v="") => { if(!v) return "—"; if(/^\d{4}-\d{2}-\d{2}/.test(v)){const[y,m,d]=v.split("T")[0].split("-");return`${d}/${m}/${y}`;}return v; },
  cep: (v="") => String(v).replace(/\D/g,"").replace(/(\d{5})(\d)/,"$1-$2"),
  phone: (v="") => { const d=String(v).replace(/\D/g,""); if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return v||"—"; },
  ts: () => new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),
};

// ─── Cores ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0c10", bg2: "#0d0f14", card: "#111318", border: "rgba(100,116,139,0.2)",
  amber: "#f59e0b", amberDark: "#92400e", white: "#ffffff", muted: "#64748b",
  text: "#f1f5f9", textSoft: "#94a3b8", green: "#10b981", red: "#ef4444",
};

// ─── Componentes base ─────────────────────────────────────────────────────────
const Card = ({children, style={}}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",...style}}>
    {children}
  </div>
);

const CardHeader = ({title, subtitle, right}) => (
  <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
    <div>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.15em",color:C.amber,fontWeight:700}}>{title}</div>
      {subtitle && <div style={{fontSize:11,color:C.muted,marginTop:2}}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

const Btn = ({children, onClick, disabled, variant="primary", small=false, full=false, style={}}) => {
  const styles = {
    primary: {background:C.amber,color:C.bg},
    secondary: {background:"#1e2230",color:C.textSoft,border:`1px solid #374151`},
    danger: {background:"rgba(127,29,29,0.4)",color:"#fca5a5",border:"1px solid rgba(248,113,113,0.3)"},
    ghost: {background:"transparent",color:C.textSoft,border:`1px solid #374151`},
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      padding: small?"6px 12px":"11px 18px",
      borderRadius:8, fontWeight:700, fontSize:small?12:14,
      cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?0.5:1,
      width:full?"100%":"auto",
      whiteSpace:"nowrap", fontFamily:"Georgia,serif",
      touchAction:"manipulation", WebkitTapHighlightColor:"transparent",
      border: styles[variant].border || "none",
      ...style
    }}>{children}</button>
  );
};

const Input = ({label, value, onChange, placeholder, type="text", inputMode, maxLength, style={}}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {label && <label style={{fontSize:10,color:C.amber,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>{label}</label>}
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      maxLength={maxLength} inputMode={inputMode}
      style={{background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"11px 14px",fontSize:15,fontFamily:"monospace",color:C.white,outline:"none",caretColor:C.amber,width:"100%",...style}}
      onFocus={e=>e.target.style.borderColor=C.amber}
      onBlur={e=>e.target.style.borderColor="#374151"}
    />
  </div>
);

const Badge = ({label, color="#f59e0b", bg}) => (
  <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,fontFamily:"monospace",background:bg||`${color}22`,color,border:`1px solid ${color}44`,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</span>
);

const Spinner = () => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{width:32,height:32,border:`3px solid ${C.amberDark}`,borderTopColor:C.amber,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true); setErr("");
    setTimeout(() => {
      const user = DEMO_USERS.find(u => u.email===email.trim() && u.password===pass);
      if (user) { onLogin(user); }
      else setErr("E-mail ou senha incorretos.");
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:380}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:"0.3em",textTransform:"uppercase",marginBottom:6}}>GBM International</div>
          <div style={{fontSize:28,fontWeight:700,color:C.amber,letterSpacing:"-0.02em"}}>Intelligence</div>
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>Plataforma de Inteligência para o Mercado de Cobre</div>
        </div>

        <Card>
          <div style={{padding:24,display:"flex",flexDirection:"column",gap:16}}>
            <Input label="E-mail" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" type="email" />
            <Input label="Senha" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" type="password" />
            {err && <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"8px 12px",borderRadius:6,fontSize:13}}>⚠ {err}</div>}
            <Btn onClick={handleLogin} disabled={loading} full>{loading?"Entrando...":"Entrar"}</Btn>
          </div>
        </Card>

        <div style={{marginTop:20,background:"rgba(245,158,11,0.06)",border:`1px solid ${C.amberDark}`,borderRadius:8,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:C.amber,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Acesso Demo</div>
          {DEMO_USERS.map(u=>(
            <div key={u.email} onClick={()=>{setEmail(u.email);setPass(u.password);}} style={{fontSize:11,color:C.textSoft,cursor:"pointer",padding:"2px 0",display:"flex",gap:8,alignItems:"center"}}>
              <Badge label={PLANS[u.plan].label} color={PLANS[u.plan].color}/>
              <span>{u.email}</span>
            </div>
          ))}
          <div style={{fontSize:10,color:C.muted,marginTop:6}}>Senha: gbm2025</div>
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO 1: CONSULTA CNPJ ──────────────────────────────────────────────────
function CNPJModule({ user }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => { try{return JSON.parse(localStorage.getItem("gbm_cnpj_history")||"[]")}catch{return[]} });
  const [tab, setTab] = useState("consulta");

  const usageKey = `gbm_usage_${new Date().toDateString()}`;
  const todayUsage = parseInt(localStorage.getItem(usageKey)||"0");
  const limit = PLANS[user.plan].limit;
  const canSearch = user.plan !== "free" || todayUsage < limit;

  useEffect(() => { localStorage.setItem("gbm_cnpj_history", JSON.stringify(history.slice(0,20))); }, [history]);

  const consultar = useCallback(async (cnpjOverride) => {
    const raw = (cnpjOverride||input).replace(/\D/g,"");
    if (raw.length!==14){setError("CNPJ deve conter 14 dígitos.");return;}
    if (!canSearch){setError(`Limite de ${limit} consultas/dia atingido. Faça upgrade para o plano Pro.`);return;}
    setLoading(true);setError("");setData(null);
    if(cnpjOverride)setInput(fmt.cnpj(cnpjOverride));
    try {
      const res = await fetch(`/api/cnpj?cnpj=${raw}`);
      const json = await res.json();
      if(!res.ok)throw new Error(json.error||`Erro ${res.status}`);
      setData(json);
      localStorage.setItem(usageKey, String(todayUsage+1));
      const s = {
        cnpj: raw,
        razaoSocial: json.razao_social,
        situacao: json.estabelecimento?.situacao_cadastral?.descricao,
        ts: new Date().toISOString(),
      };
      setHistory(prev=>[s,...prev.filter(h=>h.cnpj!==raw)].slice(0,20));
    } catch(e){setError(e.message||"Falha na consulta.");}
    finally{setLoading(false);}
  },[input,canSearch]);

  const s = data ? {
    razaoSocial: data.razao_social,
    fantasia: data.nome_fantasia,
    situacao: data.estabelecimento?.situacao_cadastral?.descricao,
    cnpj: data.estabelecimento?.cnpj||data.cnpj,
    abertura: fmt.date(data.estabelecimento?.data_inicio_atividade),
    logradouro: [data.estabelecimento?.tipo_logradouro,data.estabelecimento?.logradouro,data.estabelecimento?.numero,data.estabelecimento?.complemento].filter(Boolean).join(" "),
    bairro: data.estabelecimento?.bairro,
    cep: fmt.cep(data.estabelecimento?.cep||""),
    cidade: data.estabelecimento?.cidade?.nome,
    uf: data.estabelecimento?.estado?.sigla,
    cnae: data.estabelecimento?.atividade_principal?`${data.estabelecimento.atividade_principal.id} — ${data.estabelecimento.atividade_principal.descricao}`:null,
    telefone: data.estabelecimento?.ddd1&&data.estabelecimento?.telefone1?fmt.phone(data.estabelecimento.ddd1+data.estabelecimento.telefone1):null,
    email: data.estabelecimento?.email,
    capital: fmt.money(data.capital_social),
    porte: data.porte?.descricao,
    natureza: data.natureza_juridica?.descricao,
  } : null;

  const Field = ({label,value,hi}) => (
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      <span style={{fontSize:9,color:C.amber,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>{label}</span>
      <span style={{fontSize:13,color:hi?C.amber:C.white,fontWeight:hi?600:400,wordBreak:"break-word",lineHeight:1.4}}>{value||"—"}</span>
    </div>
  );

  const statusColor = (s="")=>{const u=s.toUpperCase();if(u.includes("ATIVA"))return C.green;if(u.includes("BAIXADA")||u.includes("CANCELADA"))return C.red;return C.textSoft;};

  return (
    <div>
      {/* Usage bar for free */}
      {user.plan==="free" && (
        <div style={{background:"rgba(245,158,11,0.06)",border:`1px solid ${C.amberDark}`,borderRadius:8,padding:"8px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.textSoft}}>Consultas hoje: <strong style={{color:C.amber}}>{todayUsage}/{limit}</strong></span>
          <Badge label="Upgrade → Pro" color={C.amber}/>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:14,background:"#111318",borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
        {["consulta","historico"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px 8px",background:tab===t?C.amber:"transparent",color:tab===t?C.bg:C.muted,border:"none",cursor:"pointer",fontWeight:tab===t?700:400,fontSize:13,fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
            {t==="consulta"?"Consultar":`Histórico (${history.length})`}
          </button>
        ))}
      </div>

      {tab==="consulta" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:8}}>
            <input
              value={input} onChange={e=>setInput(fmt.cnpj(e.target.value))}
              onKeyDown={e=>e.key==="Enter"&&consultar()}
              placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric"
              style={{flex:1,background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"12px 14px",fontSize:16,fontFamily:"monospace",letterSpacing:"0.08em",color:C.white,outline:"none",caretColor:C.amber}}
              onFocus={e=>e.target.style.borderColor=C.amber}
              onBlur={e=>e.target.style.borderColor="#374151"}
            />
            <Btn onClick={()=>consultar()} disabled={loading||!canSearch}>{loading?"...":"Buscar"}</Btn>
          </div>
          {error && <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"10px 14px",borderRadius:8,fontSize:13}}>{error}</div>}
          {loading && <Spinner/>}
          {s && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Card>
                <div style={{padding:16}}>
                  <div style={{fontSize:9,color:C.amber,textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700,marginBottom:4}}>Razão Social</div>
                  <div style={{fontSize:19,fontWeight:700,color:C.white,lineHeight:1.2}}>{s.razaoSocial||"—"}</div>
                  {s.fantasia&&<div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginTop:2}}>"{s.fantasia}"</div>}
                  <div style={{marginTop:8}}><Badge label={s.situacao||"—"} color={statusColor(s.situacao||"")}/></div>
                </div>
              </Card>
              <Card>
                <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <Field label="CNPJ" value={fmt.cnpj(s.cnpj||"")}/>
                  <Field label="Abertura" value={s.abertura}/>
                  <Field label="Capital Social" value={s.capital} hi/>
                  <Field label="Porte" value={s.porte}/>
                  <Field label="Natureza Jurídica" value={s.natureza}/>
                </div>
              </Card>
              <Card>
                <CardHeader title="Endereço"/>
                <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{gridColumn:"1/-1"}}><Field label="Logradouro" value={s.logradouro}/></div>
                  <Field label="Bairro" value={s.bairro}/>
                  <Field label="CEP" value={s.cep}/>
                  <Field label="Cidade" value={s.cidade}/>
                  <Field label="UF" value={s.uf}/>
                </div>
              </Card>
              <Card>
                <CardHeader title="Contato & CNAE"/>
                <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
                  <Field label="Telefone" value={s.telefone}/>
                  <Field label="E-mail" value={s.email}/>
                  <Field label="CNAE Principal" value={s.cnae}/>
                </div>
              </Card>
              {/* WhatsApp share */}
              <Btn variant="secondary" full onClick={()=>{
                const msg=`*Consulta CNPJ — GBM Intelligence*\n*Empresa:* ${s.razaoSocial}\n*CNPJ:* ${fmt.cnpj(s.cnpj||"")}\n*Situação:* ${s.situacao}\n*Cidade:* ${s.cidade}/${s.uf}\n*CNAE:* ${s.cnae||"—"}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
              }}>📲 Compartilhar no WhatsApp</Btn>
            </div>
          )}
          {!data&&!loading&&!error&&(
            <div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>
              <div style={{fontSize:40,marginBottom:8}}>🏢</div>
              <div style={{fontSize:13}}>Digite um CNPJ para consultar</div>
            </div>
          )}
        </div>
      )}

      {tab==="historico" && (
        <div>
          {history.length===0?(
            <div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>
              <div style={{fontSize:40,marginBottom:8}}>🕐</div>
              <div style={{fontSize:13}}>Nenhuma consulta ainda</div>
            </div>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
                <Btn variant="ghost" small onClick={()=>setHistory([])}>Limpar</Btn>
              </div>
              {history.map((h,i)=>(
                <div key={i} onClick={()=>{setTab("consulta");consultar(h.cnpj);}}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{color:C.white,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.razaoSocial||"—"}</div>
                    <div style={{color:C.muted,fontSize:11,fontFamily:"monospace"}}>{fmt.cnpj(h.cnpj)}</div>
                  </div>
                  <Badge label={h.situacao||"—"} color={h.situacao?.includes("ATIVA")?C.green:C.red}/>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO 2: TABELA LME ────────────────────────────────────────────────────
function LMEModule({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [mesSel, setMesSel]   = useState("");
  const [metalFoco, setMetalFoco] = useState("cobre");
  const [viewTab, setViewTab] = useState("tabela"); // tabela | grafico

  const fetchLME = async (mes="", force=false) => {
    setLoading(true); setError("");
    try {
      const qs = mes ? `?mes=${encodeURIComponent(mes)}` : "";
      const r = await fetch(`/api/lme${qs}${force?"&force=1":""}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `Erro ${r.status}`);
      setData(json);
      if (mes) setMesSel(mes);
    } catch(e) { setError(e.message || "Falha ao carregar tabela LME."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLME(); }, []);

  const metais = [
    { key:"cobre",    label:"Cobre",    cor:"#f59e0b", unit:"US$/t" },
    { key:"zinco",    label:"Zinco",    cor:"#64748b", unit:"US$/t" },
    { key:"aluminio", label:"Alumínio", cor:"#94a3b8", unit:"US$/t" },
    { key:"chumbo",   label:"Chumbo",   cor:"#78716c", unit:"US$/t" },
    { key:"estanho",  label:"Estanho",  cor:"#a78bfa", unit:"US$/t" },
    { key:"niquel",   label:"Níquel",   cor:"#10b981", unit:"US$/t" },
    { key:"dolar",    label:"Dólar",    cor:"#3b82f6", unit:"R$/US$" },
  ];

  const metalAtual = metais.find(m => m.key === metalFoco) || metais[0];
  const fmtNum = (v, dec=2) => v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits:dec, maximumFractionDigits:dec }) : "—";
  const fmtMoney = (v) => v != null ? `US$ ${fmtNum(v)}` : "—";

  // Dados para gráfico — linhas de dia (sem médias)
  const linhasDia = (data?.tabela || []).filter(r => !r.isMedia && r[metalFoco] != null);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* ── Cards destaque ── */}
      {data?.ultima && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {/* Cobre destaque */}
          <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:14,gridColumn:"1/-1"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:9,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700,marginBottom:4}}>🔴 Cobre LME — Última Cotação</div>
                <div style={{fontSize:28,fontWeight:700,color:"#ffffff",lineHeight:1}}>
                  US$ {fmtNum(data.ultima.cobre)}
                  <span style={{fontSize:13,color:"#64748b",fontWeight:400}}>/t</span>
                </div>
                <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{data.ultima.dia} · {data.mes}</div>
              </div>
              <div style={{textAlign:"right"}}>
                {data.variacaoDia && (
                  <div style={{fontSize:18,fontWeight:700,color:data.variacaoDia.positivo?"#10b981":"#ef4444"}}>
                    {data.variacaoDia.positivo?"▲":"▼"} {Math.abs(data.variacaoDia.pct)}%
                    <div style={{fontSize:11,color:"#64748b",fontWeight:400}}>vs dia anterior</div>
                  </div>
                )}
                {data.ultima.dolar && (
                  <div style={{fontSize:13,color:"#3b82f6",marginTop:4}}>
                    Dólar: R$ {fmtNum(data.ultima.dolar, 4)}
                  </div>
                )}
              </div>
            </div>
            {/* Máx / Mín / Média mensal */}
            <div style={{display:"flex",gap:16,marginTop:12,paddingTop:10,borderTop:"1px solid rgba(245,158,11,0.15)",flexWrap:"wrap"}}>
              {[
                ["Máx mês", data.maxMes, "#10b981"],
                ["Mín mês", data.minMes, "#ef4444"],
                ["Média mensal", data.mediaLinha?.cobre, "#f59e0b"],
              ].map(([l,v,cor])=> v ? (
                <div key={l}>
                  <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:600,color:cor}}>US$ {fmtNum(v)}</div>
                </div>
              ) : null)}
            </div>
          </div>

          {/* Cards outros metais */}
          {metais.slice(1,5).map(m => (
            <div key={m.key} onClick={()=>setMetalFoco(m.key)}
              style={{background:"#111318",border:`1px solid ${metalFoco===m.key?m.cor+"44":"rgba(100,116,139,0.2)"}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",touchAction:"manipulation"}}>
              <div style={{fontSize:9,color:m.cor,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:3}}>{m.label}</div>
              <div style={{fontSize:15,fontWeight:600,color:"#fff"}}>{fmtNum(data.ultima[m.key])}</div>
              <div style={{fontSize:9,color:"#475569"}}>{m.unit}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Seletor de mês + controles ── */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <select
          value={mesSel}
          onChange={e => fetchLME(e.target.value)}
          style={{flex:1,background:"#1e2230",border:"1px solid #374151",borderRadius:6,padding:"8px 12px",fontSize:13,color:"#fff",outline:"none",fontFamily:"Georgia,serif"}}
        >
          <option value="">Mês atual</option>
          {(data?.meses||[]).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <Btn small variant="ghost" onClick={()=>fetchLME(mesSel,true)}>↻</Btn>
        <div style={{display:"flex",gap:0,background:"#111318",borderRadius:6,overflow:"hidden",border:"1px solid rgba(100,116,139,0.2)"}}>
          {["tabela","grafico"].map(v=>(
            <button key={v} onClick={()=>setViewTab(v)}
              style={{padding:"7px 12px",background:viewTab===v?"#d97706":"transparent",color:viewTab===v?"#0a0c10":"#64748b",border:"none",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif",fontWeight:viewTab===v?700:400,touchAction:"manipulation"}}>
              {v==="tabela"?"📋 Tabela":"📈 Gráfico"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading && <Spinner/>}
      {error && <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"10px 14px",borderRadius:8,fontSize:13}}>⚠ {error}</div>}

      {/* ── TABELA ── */}
      {!loading && data && viewTab==="tabela" && (
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>
              Tabela LME — {data.mes}
            </span>
            <span style={{fontSize:10,color:"#334155"}}>Fonte: Shockmetais / LME</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:600}}>
              <thead>
                <tr style={{background:"#0d0f14"}}>
                  {["Dia","Cobre","Zinco","Alumínio","Chumbo","Estanho","Níquel","Dólar"].map((h,i)=>(
                    <th key={h} style={{
                      padding:"8px 10px",
                      color: i===1?"#f59e0b":"#64748b",
                      fontWeight:700,
                      textAlign: i===0?"left":"right",
                      fontSize:10,
                      textTransform:"uppercase",
                      letterSpacing:"0.06em",
                      borderBottom:"1px solid rgba(100,116,139,0.15)",
                      whiteSpace:"nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tabela.map((row,i)=>{
                  const isMedia = row.isMedia;
                  const isUltima = !isMedia && row.dia === data.ultima?.dia;
                  return (
                    <tr key={i} style={{
                      background: isMedia?"rgba(245,158,11,0.05)":isUltima?"rgba(245,158,11,0.04)":"transparent",
                      borderBottom:"1px solid rgba(30,41,59,0.5)",
                    }}>
                      <td style={{padding:"7px 10px",color:isMedia?"#f59e0b":"#94a3b8",fontWeight:isMedia?700:400,whiteSpace:"nowrap",fontSize:isMedia?10:11}}>{row.dia}</td>
                      {["cobre","zinco","aluminio","chumbo","estanho","niquel","dolar"].map(k=>(
                        <td key={k} style={{
                          padding:"7px 10px",
                          textAlign:"right",
                          color: k==="cobre"?(isUltima?"#f59e0b":"#ffffff"):isMedia?"#94a3b8":"#cbd5e1",
                          fontWeight: k==="cobre"&&isUltima?700:isMedia?600:400,
                          whiteSpace:"nowrap",
                        }}>
                          {row[k] != null ? fmtNum(row[k], k==="dolar"?4:2) : <span style={{color:"#334155"}}>—</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GRÁFICO ── */}
      {!loading && data && viewTab==="grafico" && (
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>
                Gráfico — {metalAtual.label} · {data.mes}
              </span>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {metais.map(m=>(
                  <button key={m.key} onClick={()=>setMetalFoco(m.key)}
                    style={{padding:"3px 8px",borderRadius:4,background:metalFoco===m.key?`${m.cor}33`:"transparent",color:metalFoco===m.key?m.cor:"#475569",border:`1px solid ${metalFoco===m.key?m.cor+"44":"#1e293b"}`,fontSize:10,cursor:"pointer",fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{padding:16}}>
            {linhasDia.length > 0 ? (
              <GraficoLME dados={linhasDia} metal={metalFoco} cor={metalAtual.cor} label={metalAtual.label} unit={metalAtual.unit}/>
            ) : (
              <div style={{textAlign:"center",padding:30,color:"#334155"}}>Sem dados suficientes para o gráfico</div>
            )}
          </div>
        </div>
      )}

      {/* ── Crédito da fonte ── */}
      {data && (
        <div style={{fontSize:10,color:"#1e293b",textAlign:"center"}}>
          Dados: <a href="https://shockmetais.com.br/lme" target="_blank" rel="noreferrer" style={{color:"#334155",textDecoration:"underline"}}>Shockmetais</a> / LME (London Metal Exchange) · Atualizado: {new Date(data.geradoEm).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
        </div>
      )}
    </div>
  );
}

// ── Gráfico SVG inline ────────────────────────────────────────────────────────
function GraficoLME({ dados, metal, cor, label, unit }) {
  const valores = dados.map(d => d[metal]).filter(v => v != null);
  if (valores.length < 2) return null;

  const W = 600, H = 200, PAD = { t:20, r:20, b:40, l:60 };
  const gW = W - PAD.l - PAD.r;
  const gH = H - PAD.t - PAD.b;

  const minV = Math.min(...valores) * 0.998;
  const maxV = Math.max(...valores) * 1.002;
  const range = maxV - minV || 1;

  const pts = dados.map((d,i) => {
    const v = d[metal];
    if (v == null) return null;
    const x = PAD.l + (i / (dados.length - 1)) * gW;
    const y = PAD.t + gH - ((v - minV) / range) * gH;
    return { x, y, v, dia: d.dia };
  }).filter(Boolean);

  const pathD = pts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  const areaD = `${pathD} L${pts[pts.length-1].x},${PAD.t+gH} L${pts[0].x},${PAD.t+gH} Z`;

  const fmtNum = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",overflow:"visible"}} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`grad_${metal}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={cor} stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Grid linhas horizontais */}
      {[0,0.25,0.5,0.75,1].map(p=>{
        const y = PAD.t + gH * (1-p);
        const v = minV + range * p;
        return (
          <g key={p}>
            <line x1={PAD.l} y1={y} x2={PAD.l+gW} y2={y} stroke="#1e293b" strokeWidth="1"/>
            <text x={PAD.l-6} y={y+4} textAnchor="end" fontSize="9" fill="#475569">{fmtNum(v)}</text>
          </g>
        );
      })}

      {/* Área */}
      <path d={areaD} fill={`url(#grad_${metal})`}/>

      {/* Linha */}
      <path d={pathD} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Pontos e labels de dia */}
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill={cor} stroke="#0a0c10" strokeWidth="1.5"/>
          {i % Math.ceil(pts.length/8) === 0 && (
            <text x={p.x} y={PAD.t+gH+14} textAnchor="middle" fontSize="8" fill="#475569">
              {p.dia.split("/")[0]}
            </text>
          )}
        </g>
      ))}

      {/* Último ponto destacado */}
      {pts.length>0 && (
        <g>
          <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="5" fill={cor} stroke="#0a0c10" strokeWidth="2"/>
          <text x={pts[pts.length-1].x} y={pts[pts.length-1].y-10} textAnchor="middle" fontSize="9" fill={cor} fontWeight="bold">
            {fmtNum(pts[pts.length-1].v)}
          </text>
        </g>
      )}

      {/* Label eixo Y */}
      <text x={14} y={PAD.t+gH/2} textAnchor="middle" fontSize="9" fill="#475569" transform={`rotate(-90,14,${PAD.t+gH/2})`}>{unit}</text>
    </svg>
  );
}


// ─── MÓDULO 3: CALCULADORA ────────────────────────────────────────────────────
function CopperCalcInline({ copper, fx }) {
  const [peso, setPeso] = useState("");
  const [spread, setSpread] = useState("10");
  const [result, setResult] = useState(null);

  const calcular = () => {
    const kg = parseFloat(peso);
    const sp = parseFloat(spread)/100;
    if(isNaN(kg)||kg<=0) return;
    const baseKg = copper.brlKg;
    const total = kg * baseKg * (1 + sp);
    setResult({ kg, baseKg, spread: parseFloat(spread), total, totalUsd: total/fx.usdBrl });
  };

  return (
    <Card>
      <CardHeader title="Calculadora Rápida" subtitle="Estimativa com base no LME do dia"/>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Peso (kg)" value={peso} onChange={e=>setPeso(e.target.value)} placeholder="ex: 1000" inputMode="decimal"/>
          <Input label="Spread (%)" value={spread} onChange={e=>setSpread(e.target.value)} placeholder="ex: 10" inputMode="decimal"/>
        </div>
        <Btn full onClick={calcular}>Calcular</Btn>
        {result && (
          <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:14}}>
            <div style={{fontSize:10,color:C.green,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,marginBottom:8}}>Resultado</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                ["Peso",""+result.kg.toLocaleString("pt-BR")+" kg"],
                ["Base LME (R$/kg)",fmt.money(result.baseKg)],
                ["Spread",result.spread+"%"],
                ["Total (BRL)",fmt.money(result.total)],
                ["Total (USD)",fmt.moneyUSD(result.totalUsd)],
              ].map(([l,v])=>(
                <div key={l} style={{display:"flex",flexDirection:"column",gap:2}}>
                  <span style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>{l}</span>
                  <span style={{fontSize:14,color:C.white,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function CalculatorModule({ user }) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [peso, setPeso] = useState("");
  const [liga, setLiga] = useState("C11000");
  const [forma, setForma] = useState("Barra");
  const [spread, setSpread] = useState("12");
  const [frete, setFrete] = useState("0");
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(()=>{try{return JSON.parse(localStorage.getItem("gbm_proposals")||"[]")}catch{return[]}});

  useEffect(()=>{
    fetch("/api/market").then(r=>r.json()).then(d=>setMarket(d)).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{ localStorage.setItem("gbm_proposals",JSON.stringify(saved.slice(0,20))); },[saved]);

  const ligas = ["C11000","C12000","C12200","C23000","C26000","C27000","C28000","C36000","C46400","C51000","C63000","C65500","C70600","C71500"];
  const formas = ["Barra","Tubo Rígido","Tubo Flexível","Chapa","Fio","Perfil","Lingote","Catodo"];

  const calcular = () => {
    if(!market) return;
    const kg = parseFloat(peso);
    const sp = parseFloat(spread)/100;
    const fr = parseFloat(frete)||0;
    if(isNaN(kg)||kg<=0) return;
    const baseKg = market.copper.brlKg;
    const materialCost = kg * baseKg;
    const spreadValue = materialCost * sp;
    const total = materialCost + spreadValue + fr;
    const r = {
      id: Date.now(),
      ts: new Date().toISOString(),
      peso: kg, liga, forma, spread: parseFloat(spread), frete: fr,
      baseKg, materialCost, spreadValue, total,
      totalUsd: total/market.fx.usdBrl,
      usdBrl: market.fx.usdBrl,
      lmeUsd: market.copper.usdTon,
    };
    setResult(r);
  };

  const salvar = () => {
    if(!result) return;
    setSaved(prev=>[result,...prev].slice(0,20));
    alert("Proposta salva!");
  };

  const shareWpp = () => {
    if(!result) return;
    const msg = `*Proposta GBM Intelligence*\n*Liga:* ${result.liga} — ${result.forma}\n*Peso:* ${result.peso.toLocaleString("pt-BR")} kg\n*LME:* ${fmt.moneyUSD(result.lmeUsd)}/t\n*Base R$/kg:* ${fmt.money(result.baseKg)}\n*Spread:* ${result.spread}%\n*Frete:* ${fmt.money(result.frete)}\n*Total:* ${fmt.money(result.total)}\n*Total USD:* ${fmt.moneyUSD(result.totalUsd)}\n_GBM International — ${new Date().toLocaleDateString("pt-BR")}_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
  };

  if(loading) return <Spinner/>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {market && (
        <div style={{background:"rgba(245,158,11,0.06)",border:`1px solid ${C.amberDark}`,borderRadius:8,padding:"8px 14px",display:"flex",gap:16,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:C.muted}}>LME: <strong style={{color:C.amber}}>{fmt.moneyUSD(market.copper.usdTon)}/t</strong></span>
          <span style={{fontSize:11,color:C.muted}}>R$/kg: <strong style={{color:C.green}}>{fmt.money(market.copper.brlKg)}</strong></span>
          <span style={{fontSize:11,color:C.muted}}>USD/BRL: <strong style={{color:C.white}}>{fmt.num(market.fx.usdBrl,4)}</strong></span>
        </div>
      )}

      <Card>
        <CardHeader title="Nova Proposta"/>
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:9,color:C.amber,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,marginBottom:4}}>Liga (UNS)</div>
              <select value={liga} onChange={e=>setLiga(e.target.value)} style={{width:"100%",background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"11px 12px",fontSize:14,color:C.white,outline:"none",fontFamily:"monospace"}}>
                {ligas.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:9,color:C.amber,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,marginBottom:4}}>Forma</div>
              <select value={forma} onChange={e=>setForma(e.target.value)} style={{width:"100%",background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"11px 12px",fontSize:14,color:C.white,outline:"none",fontFamily:"Georgia,serif"}}>
                {formas.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <Input label="Peso (kg)" value={peso} onChange={e=>setPeso(e.target.value)} placeholder="Ex: 5000" inputMode="decimal"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Spread (%)" value={spread} onChange={e=>setSpread(e.target.value)} placeholder="12" inputMode="decimal"/>
            <Input label="Frete (R$)" value={frete} onChange={e=>setFrete(e.target.value)} placeholder="0" inputMode="decimal"/>
          </div>
          <Btn full onClick={calcular}>Calcular Proposta</Btn>
        </div>
      </Card>

      {result && (
        <Card>
          <CardHeader title="Resultado da Proposta" right={<Badge label={result.liga} color={C.amber}/>}/>
          <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                ["Peso",result.peso.toLocaleString("pt-BR")+" kg"],
                ["Forma",result.forma],
                ["LME Ref.",fmt.moneyUSD(result.lmeUsd)+"/t"],
                ["Base R$/kg",fmt.money(result.baseKg)],
                ["Custo Material",fmt.money(result.materialCost)],
                ["Spread "+result.spread+"%",fmt.money(result.spreadValue)],
                ["Frete",fmt.money(result.frete)],
              ].map(([l,v])=>(
                <div key={l} style={{display:"flex",flexDirection:"column",gap:2}}>
                  <span style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</span>
                  <span style={{fontSize:13,color:C.textSoft}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:9,color:C.green,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>Total da Proposta</div>
                <div style={{fontSize:24,fontWeight:700,color:C.white}}>{fmt.money(result.total)}</div>
                <div style={{fontSize:12,color:C.muted}}>{fmt.moneyUSD(result.totalUsd)}</div>
              </div>
              <div style={{fontSize:12,color:C.muted}}>{new Date().toLocaleDateString("pt-BR")}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn full variant="secondary" onClick={salvar}>💾 Salvar</Btn>
              <Btn full variant="secondary" onClick={shareWpp}>📲 WhatsApp</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Propostas salvas — só Pro/Business */}
      {user.plan !== "free" && saved.length > 0 && (
        <Card>
          <CardHeader title="Propostas Salvas" right={<Btn small variant="ghost" onClick={()=>setSaved([])}>Limpar</Btn>}/>
          <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
            {saved.slice(0,5).map((p,i)=>(
              <div key={i} style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:12,color:C.white,fontWeight:600}}>{p.liga} — {p.forma}</div>
                  <div style={{fontSize:11,color:C.muted}}>{p.peso.toLocaleString("pt-BR")} kg · {new Date(p.ts).toLocaleDateString("pt-BR")}</div>
                </div>
                <div style={{fontSize:14,fontWeight:700,color:C.green}}>{fmt.money(p.total)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── MÓDULO 4: NOTÍCIAS DO MERCADO DE COBRE ──────────────────────────────────
function NewsModule({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const cacheKey = `gbm_news_${new Date().toDateString()}`;

  const fetchNews = async (force=false) => {
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(cacheKey)||"null");
        if (c) { setData(c); return; }
      } catch {}
    }
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/news${force?"?force=1":""}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error||`Erro ${r.status}`);
      setData(json);
      if (!force) localStorage.setItem(cacheKey, JSON.stringify(json));
    } catch(e) { setError(e.message||"Falha ao carregar notícias."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNews(); }, []);

  const sentimentoConfig = {
    alta:   { cor:"#10b981", icon:"📈", label:"Tendência de Alta"   },
    baixa:  { cor:"#ef4444", icon:"📉", label:"Tendência de Baixa"  },
    neutro: { cor:"#f59e0b", icon:"➡️", label:"Mercado Neutro"      },
  };

  const categoriaColor = {
    LME:"#f59e0b", China:"#ef4444", Macro:"#64748b",
    Oferta:"#10b981", Demanda:"#3b82f6", Brasil:"#84cc16", Mineração:"#a78bfa",
  };

  const relevanciaOrder = { alta:0, media:1, baixa:2 };
  const noticias = (data?.noticias||[]).sort((a,b)=>relevanciaOrder[a.relevancia]-relevanciaOrder[b.relevancia]);

  if (user.plan==="free") return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:40,marginBottom:12}}>📰</div>
      <div style={{fontSize:16,color:"#ffffff",fontWeight:600,marginBottom:8}}>Notícias do Mercado</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Disponível nos planos Pro e Business</div>
      <span style={{fontSize:11,padding:"3px 10px",borderRadius:4,background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",fontWeight:700}}>Upgrade para Pro — R$197/mês</span>
    </div>
  );

  if (loading) return (
    <div style={{textAlign:"center",padding:40}}>
      <Spinner/>
      <div style={{fontSize:12,color:"#64748b",marginTop:12}}>Pesquisando notícias e gerando análise com IA...</div>
    </div>
  );

  if (error) return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:14,borderRadius:8,fontSize:13}}>⚠ {error}</div>
      <Btn onClick={()=>fetchNews(true)}>Tentar novamente</Btn>
    </div>
  );

  if (!data) return (
    <div style={{textAlign:"center",padding:40}}>
      <Btn onClick={()=>fetchNews()}>Carregar Notícias</Btn>
    </div>
  );

  const s = sentimentoConfig[data.sentimento] || sentimentoConfig.neutro;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Header com status */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:"#ffffff"}}>{data.titulo||"Mercado de Cobre"}</div>
          <div style={{fontSize:10,color:"#475569",marginTop:2}}>
            {data.cached?"📦 Cache":"🔄 Ao vivo"} · Gerado às {new Date(data.geradoEm).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
            {data.cacheAge&&` (${data.cacheAge} atrás)`}
          </div>
        </div>
        <Btn small variant="ghost" onClick={()=>fetchNews(true)}>↻ Atualizar</Btn>
      </div>

      {/* Dados de mercado */}
      {data.dados_mercado && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            ["LME Spot", data.dados_mercado.lme_spot ? `US$ ${data.dados_mercado.lme_spot}/t` : null],
            ["Variação", data.dados_mercado.variacao_dia],
            ["USD/BRL", data.dados_mercado.usd_brl],
          ].map(([l,v])=> v ? (
            <div key={l} style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:l==="Variação"?(v.startsWith("+")?"#10b981":"#ef4444"):"#f59e0b"}}>{v}</div>
            </div>
          ) : null)}
        </div>
      )}

      {/* Sentimento */}
      <div style={{background:`${s.cor}10`,border:`1px solid ${s.cor}30`,borderRadius:10,padding:14}}>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:22}}>{s.icon}</span>
          <span style={{fontSize:15,fontWeight:700,color:s.cor}}>{s.label}</span>
        </div>
        <p style={{fontSize:13,color:"#94a3b8",lineHeight:1.6,margin:0}}>{data.resumo}</p>
      </div>

      {/* Destaques */}
      {data.destaques?.length>0 && (
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
            <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>Destaques do Dia</span>
          </div>
          <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
            {data.destaques.map((d,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{color:"#f59e0b",fontSize:14,flexShrink:0,marginTop:1}}>•</span>
                <span style={{fontSize:13,color:"#94a3b8",lineHeight:1.5}}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fatores */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {titulo:"Fatores de Alta", itens:data.fatores_alta, cor:"#10b981", icon:"▲"},
          {titulo:"Fatores de Baixa", itens:data.fatores_baixa, cor:"#ef4444", icon:"▼"},
        ].map(({titulo,itens,cor,icon})=>(
          <div key={titulo} style={{background:"#111318",border:`1px solid ${cor}22`,borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"8px 12px",borderBottom:`1px solid ${cor}15`}}>
              <span style={{fontSize:10,color:cor,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>{titulo}</span>
            </div>
            <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
              {(itens||[]).map((f,i)=>(
                <div key={i} style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                  <span style={{color:cor,fontSize:10,flexShrink:0,marginTop:2}}>{icon}</span>
                  <span style={{fontSize:11,color:"#94a3b8",lineHeight:1.4}}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Perspectiva */}
      {data.perspectiva && (
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:8,padding:14,display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:20,flexShrink:0}}>🔭</span>
          <div>
            <div style={{fontSize:9,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,marginBottom:4}}>Perspectiva de Curto Prazo</div>
            <div style={{fontSize:13,color:"#ffffff",lineHeight:1.5}}>{data.perspectiva}</div>
          </div>
        </div>
      )}

      {/* Notícias */}
      {noticias.length>0 && (
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
            <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>
              Notícias — {noticias.length} publicações
            </span>
          </div>
          <div style={{display:"flex",flexDirection:"column"}}>
            {noticias.map((n,i)=>(
              <div key={i} style={{padding:"12px 14px",borderBottom:"1px solid rgba(30,41,59,0.6)",display:"flex",flexDirection:"column",gap:5}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {n.categoria && (
                    <span style={{fontSize:9,padding:"1px 6px",borderRadius:3,background:`${categoriaColor[n.categoria]||"#64748b"}22`,color:categoriaColor[n.categoria]||"#64748b",border:`1px solid ${categoriaColor[n.categoria]||"#64748b"}33`,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                      {n.categoria}
                    </span>
                  )}
                  {n.relevancia==="alta" && <span style={{fontSize:9,color:"#f59e0b"}}>★ Destaque</span>}
                  <span style={{fontSize:10,color:"#475569",marginLeft:"auto"}}>{n.fonte}</span>
                </div>
                {n.url ? (
                  <a href={n.url} target="_blank" rel="noreferrer"
                    style={{fontSize:13,color:"#ffffff",fontWeight:600,lineHeight:1.4,textDecoration:"none"}}>
                    {n.titulo} →
                  </a>
                ) : (
                  <div style={{fontSize:13,color:"#ffffff",fontWeight:600,lineHeight:1.4}}>{n.titulo}</div>
                )}
                <p style={{fontSize:12,color:"#64748b",margin:0,lineHeight:1.5}}>{n.resumo}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compartilhar WhatsApp */}
      <Btn variant="secondary" full onClick={()=>{
        const msg = [
          `*${data.titulo}*`,
          "",
          data.resumo,
          "",
          "*Destaques:*",
          ...(data.destaques||[]).map(d=>`• ${d}`),
          "",
          `*Perspectiva:* ${data.perspectiva||"—"}`,
          "",
          "_GBM Intelligence_"
        ].join("\n");
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
      }}>📲 Compartilhar Resumo no WhatsApp</Btn>

    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const MODULES = [
  { id:"lme",    label:"LME ao Vivo",   icon:"📊" },
  { id:"calc",   label:"Calculadora",   icon:"🧮" },
  { id:"cnpj",   label:"Consulta CNPJ", icon:"🏢" },
  { id:"credit", label:"Crédito",       icon:"🔍" },
  { id:"news",   label:"Mercado",       icon:"📰" },
];

export default function App() {
  const [user, setUser] = useState(()=>{ try{return JSON.parse(localStorage.getItem("gbm_user")||"null")}catch{return null} });
  const [module, setModule] = useState("lme");

  const handleLogin = (u) => { setUser(u); localStorage.setItem("gbm_user",JSON.stringify(u)); };
  const handleLogout = () => { setUser(null); localStorage.removeItem("gbm_user"); };

  if (!user) return <LoginPage onLogin={handleLogin}/>;

  const plan = PLANS[user.plan];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Georgia,serif",paddingBottom:80}}>
      {/* Header */}
      <div style={{background:C.bg2,borderBottom:`1px solid rgba(245,158,11,0.15)`,position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.2em",textTransform:"uppercase",lineHeight:1}}>GBM</div>
            <div style={{fontSize:18,fontWeight:700,color:C.amber,letterSpacing:"-0.02em",lineHeight:1.1}}>Intelligence</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Badge label={plan.label} color={plan.color}/>
            <Btn small variant="ghost" onClick={handleLogout}>Sair</Btn>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:680,margin:"0 auto",padding:"16px 16px 0"}}>
        {module==="lme"    && <LMEModule user={user}/>}
        {module==="calc"   && <CalculatorModule user={user}/>}
        {module==="cnpj"   && <CNPJModule user={user}/>}
        {module==="credit" && <CreditModule user={user}/>}
        {module==="news"   && <NewsModule user={user}/>}
      </div>

      {/* Bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.bg2,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:50}}>
        {MODULES.map(m=>(
          <button key={m.id} onClick={()=>setModule(m.id)} style={{flex:1,padding:"10px 4px 8px",background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>
            <span style={{fontSize:20}}>{m.icon}</span>
            <span style={{fontSize:9,color:module===m.id?C.amber:C.muted,fontWeight:module===m.id?700:400,textTransform:"uppercase",letterSpacing:"0.05em"}}>{m.label.split(" ")[0]}</span>
            {module===m.id && <div style={{width:20,height:2,background:C.amber,borderRadius:1}}/>}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── MÓDULO 5: CRÉDITO ────────────────────────────────────────────────────────
// ─── MÓDULO 5: CRÉDITO ────────────────────────────────────────────────────────
function CreditModule({ user }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("consulta");
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gbm_credit_history") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("gbm_credit_history", JSON.stringify(history.slice(0, 20)));
  }, [history]);

  const fmtDoc = (v="") => {
    const d = v.replace(/\D/g,"").slice(0,14);
    if (d.length<=11) return d.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
    return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2");
  };

  const consultar = async (docOverride) => {
    const raw = (docOverride || input).replace(/\D/g,"");
    if (raw.length!==14&&raw.length!==11){setError("Informe um CNPJ (14 dígitos) ou CPF (11 dígitos).");return;}
    if (docOverride) setInput(fmtDoc(docOverride));
    setLoading(true);setError("");setData(null);setTab("consulta");
    try {
      const r = await fetch(`/api/credit?doc=${raw}`);
      const json = await r.json();
      if(!r.ok) throw new Error(json.error||`Erro ${r.status}`);
      setData(json);
      // Salva no histórico
      const entry = {
        doc: raw,
        docFmt: json.docFmt || fmtDoc(raw),
        tipo: json.tipo || (raw.length===14?"CNPJ":"CPF"),
        nome: json.dadosCadastrais?.razaoSocial || "Pessoa Física",
        situacao: json.dadosCadastrais?.situacao || "—",
        score: json.score?.pontos,
        classificacao: json.score?.classificacao,
        scoreCor: json.score?.cor,
        protestos: json.protestos?.status,
        ts: new Date().toISOString(),
      };
      setHistory(prev => [entry, ...prev.filter(h => h.doc !== raw)].slice(0, 20));
    } catch(e){setError(e.message||"Falha na consulta.");}
    finally{setLoading(false);}
  };

  const shareWpp = () => {
    if(!data) return;
    const s = data.score;
    const rf = data.dadosCadastrais;
    const msg = [
      `*Análise de Crédito — GBM Intelligence*`,
      `*${data.tipo==="CPF"?"CPF":"Empresa"}:* ${rf?.razaoSocial||input}`,
      `*${data.tipo}:* ${data.docFmt||input}`,
      `*Situação:* ${rf?.situacao||"—"}`,
      `*Score GBM:* ${s?.pontos||"—"}/1000 — ${s?.classificacao||"—"}`,
      `*Protestos:* ${data.protestos?.status==="limpo"?"Nenhum":data.protestos?.quantidade+" protesto(s)"}`,
      `*Processos:* ${(data.acoesEmpresa?.total||0)+(data.acoesSocios?.total||0)} total`,
      `*Recomendação:* ${s?.recomendacao||"—"}`,
      `_GBM International — ${new Date().toLocaleDateString("pt-BR")}_`
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Busca */}
      <div style={{display:"flex",gap:8}}>
        <input
          value={input} onChange={e=>setInput(fmtDoc(e.target.value))}
          onKeyDown={e=>e.key==="Enter"&&consultar()}
          placeholder="CNPJ ou CPF" maxLength={18} inputMode="numeric"
          style={{flex:1,background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"12px 14px",fontSize:16,fontFamily:"monospace",letterSpacing:"0.08em",color:"#ffffff",outline:"none",caretColor:"#f59e0b"}}
          onFocus={e=>e.target.style.borderColor="#f59e0b"}
          onBlur={e=>e.target.style.borderColor="#374151"}
        />
        <Btn onClick={()=>consultar()} disabled={loading}>{loading?"...":"Analisar"}</Btn>
      </div>
      {error && <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"10px 14px",borderRadius:8,fontSize:13}}>⚠ {error}</div>}

      {/* Tabs */}
      <div style={{display:"flex",gap:0,background:"#111318",borderRadius:8,overflow:"hidden",border:"1px solid rgba(100,116,139,0.2)"}}>
        {["consulta","historico"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px 8px",background:tab===t?"#d97706":"transparent",color:tab===t?"#0a0c10":"#64748b",border:"none",cursor:"pointer",fontWeight:tab===t?700:400,fontSize:13,fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
            {t==="consulta"?"Análise":`Histórico (${history.length})`}
          </button>
        ))}
      </div>

      {tab==="consulta" && (
        <>
          {loading && (
            <div style={{textAlign:"center",padding:30}}>
              <Spinner/>
              <div style={{fontSize:12,color:"#64748b",marginTop:8}}>Consultando Receita Federal · CENPROT · CNJ DataJud...</div>
            </div>
          )}

          {data && (
            <>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="secondary" full small onClick={shareWpp}>📲 WhatsApp</Btn>
                <Btn variant="secondary" full small onClick={()=>window.print()}>⬇ PDF</Btn>
              </div>
              <CreditReportComponent data={data}/>
            </>
          )}

          {!data && !loading && !error && (
            <div style={{textAlign:"center",padding:"50px 0",color:"#334155"}}>
              <div style={{fontSize:40,marginBottom:8}}>🔍</div>
              <div style={{fontSize:13,color:"#64748b"}}>Digite um CNPJ ou CPF para analisar</div>
              <div style={{fontSize:11,marginTop:6,color:"#1e293b"}}>Score · Protestos · Processos · Sócios</div>
            </div>
          )}
        </>
      )}

      {tab==="historico" && (
        <div>
          {history.length===0 ? (
            <div style={{textAlign:"center",padding:"50px 0",color:"#334155"}}>
              <div style={{fontSize:40,marginBottom:8}}>🕐</div>
              <div style={{fontSize:13,color:"#64748b"}}>Nenhuma análise realizada ainda</div>
            </div>
          ) : (
            <>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
                <Btn variant="ghost" small onClick={()=>setHistory([])}>Limpar</Btn>
              </div>
              {history.map((h,i)=>(
                <div key={i} onClick={()=>{ setTab("consulta"); consultar(h.doc); }}
                  style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:8,padding:"12px 14px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{minWidth:0}}>
                    <div style={{color:"#ffffff",fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.nome||"—"}</div>
                    <div style={{color:"#64748b",fontSize:11,fontFamily:"monospace"}}>{h.docFmt} · {h.tipo}</div>
                    <div style={{color:"#475569",fontSize:10,marginTop:2}}>{new Date(h.ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    {h.score!=null && (
                      <span style={{fontSize:13,fontWeight:700,color:h.scoreCor||"#f59e0b"}}>{h.score}/1000</span>
                    )}
                    {h.classificacao && (
                      <span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:`${h.scoreCor||"#f59e0b"}22`,color:h.scoreCor||"#f59e0b",border:`1px solid ${h.scoreCor||"#f59e0b"}44`,fontWeight:700}}>{h.classificacao.split("—")[0].trim()}</span>
                    )}
                    {h.protestos && (
                      <span style={{fontSize:10,color:h.protestos==="limpo"?"#10b981":h.protestos==="protestado"?"#ef4444":"#64748b"}}>{h.protestos==="limpo"?"✅ Sem protestos":h.protestos==="protestado"?"❌ Protestado":"⚠ Verificar"}</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

    </div>
  );
}
