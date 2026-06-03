import { useState, useEffect, useCallback } from "react";

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

// ─── MÓDULO 2: LME AO VIVO ───────────────────────────────────────────────────
function LMEModule({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");
  const [history, setHistory] = useState(() => { try{return JSON.parse(localStorage.getItem("gbm_lme_history")||"[]")}catch{return[]} });

  const fetchMarket = async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/market");
      const json = await r.json();
      if(!r.ok) throw new Error(json.error);
      setData(json);
      setLastUpdate(fmt.ts());
      // Salva histórico
      const entry = { ts: new Date().toISOString(), usdTon: json.copper.usdTon, brlKg: json.copper.brlKg, usdBrl: json.fx.usdBrl };
      setHistory(prev=>[entry,...prev].slice(0,48));
      localStorage.setItem("gbm_lme_history", JSON.stringify([entry,...history].slice(0,48)));
    } catch(e) { setError(e.message||"Falha ao buscar cotações."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMarket(); const t=setInterval(fetchMarket,5*60*1000); return()=>clearInterval(t); }, []);

  const MetricCard = ({label, value, sub, color=C.amber, icon}) => (
    <Card>
      <div style={{padding:16}}>
        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,marginBottom:6}}>{icon} {label}</div>
        <div style={{fontSize:22,fontWeight:700,color,lineHeight:1}}>{value}</div>
        {sub&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{sub}</div>}
      </div>
    </Card>
  );

  if (loading) return <Spinner/>;
  if (error) return <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:14,borderRadius:8,fontSize:13}}>⚠ {error}<br/><button onClick={fetchMarket} style={{marginTop:8,color:C.amber,background:"none",border:"none",cursor:"pointer",fontSize:12}}>Tentar novamente</button></div>;
  if (!data) return null;

  const isPro = user.plan !== "free";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:11,color:C.muted}}>Atualizado às {lastUpdate} {data.copper.source==="reference"&&<Badge label="referência" color={C.muted}/>}</div>
        <Btn small variant="ghost" onClick={fetchMarket}>↻ Atualizar</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <MetricCard icon="🔴" label="Cobre LME (USD/t)" value={fmt.moneyUSD(data.copper.usdTon)} sub="Tonelada métrica"/>
        <MetricCard icon="💱" label="USD / BRL" value={`R$ ${fmt.num(data.fx.usdBrl,4)}`} sub="Câmbio comercial"/>
        <MetricCard icon="🇧🇷" label="Cobre (R$/t)" value={fmt.money(data.copper.brlTon)} sub="Tonelada" color={C.green}/>
        <MetricCard icon="⚖️" label="Cobre (R$/kg)" value={fmt.money(data.copper.brlKg)} sub="Por quilograma" color={C.green}/>
      </div>

      {/* Calculadora rápida inline */}
      <CopperCalcInline copper={data.copper} fx={data.fx}/>

      {/* Histórico — só Pro/Business */}
      {isPro ? (
        history.length > 1 && (
          <Card>
            <CardHeader title="Histórico de Cotações" subtitle="Últimas atualizações"/>
            <div style={{padding:16,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.border}`}}>
                    {["Horário","USD/t","R$/kg","Câmbio"].map(h=>(
                      <th key={h} style={{padding:"4px 8px",color:C.muted,fontWeight:600,textAlign:"left"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0,10).map((h,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid rgba(100,116,139,0.1)`}}>
                      <td style={{padding:"6px 8px",color:C.muted,fontSize:11}}>{new Date(h.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</td>
                      <td style={{padding:"6px 8px",color:C.white}}>{fmt.moneyUSD(h.usdTon)}</td>
                      <td style={{padding:"6px 8px",color:C.green}}>{fmt.money(h.brlKg)}</td>
                      <td style={{padding:"6px 8px",color:C.textSoft}}>{fmt.num(h.usdBrl,4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        <div style={{background:"rgba(245,158,11,0.06)",border:`1px solid ${C.amberDark}`,borderRadius:8,padding:14,textAlign:"center"}}>
          <div style={{fontSize:13,color:C.textSoft,marginBottom:6}}>📊 Histórico de cotações disponível no plano Pro</div>
          <Badge label="Upgrade para Pro — R$197/mês" color={C.amber}/>
        </div>
      )}
    </div>
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

// ─── MÓDULO 4: RESUMO DE MERCADO ──────────────────────────────────────────────
function NewsModule({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cacheKey = `gbm_news_${new Date().toDateString()}`;

  const fetchNews = async (force=false) => {
    if(!force){
      try{const c=JSON.parse(localStorage.getItem(cacheKey)||"null");if(c){setData(c);return;}}catch{}
    }
    setLoading(true);setError("");
    try {
      const r = await fetch("/api/news");
      const json = await r.json();
      if(!r.ok) throw new Error(json.error);
      setData(json);
      localStorage.setItem(cacheKey, JSON.stringify(json));
    } catch(e){setError(e.message||"Falha ao gerar resumo.");}
    finally{setLoading(false);}
  };

  useEffect(()=>{fetchNews();},[]);

  const sentimentColor = (s) => s==="alta"?C.green:s==="baixa"?C.red:C.amber;
  const sentimentLabel = (s) => s==="alta"?"📈 Tendência de Alta":s==="baixa"?"📉 Tendência de Baixa":"➡️ Mercado Neutro";

  if(user.plan==="free") return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:40,marginBottom:12}}>📰</div>
      <div style={{fontSize:16,color:C.white,fontWeight:600,marginBottom:8}}>Resumo Diário de Mercado</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Disponível nos planos Pro e Business</div>
      <Badge label="Upgrade para Pro — R$197/mês" color={C.amber}/>
    </div>
  );

  if(loading) return (
    <div style={{textAlign:"center",padding:40}}>
      <Spinner/>
      <div style={{fontSize:13,color:C.muted,marginTop:12}}>Gerando resumo com IA...</div>
    </div>
  );

  if(error) return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:14,borderRadius:8,fontSize:13}}>⚠ {error}</div>
      <Btn onClick={()=>fetchNews(true)}>Tentar novamente</Btn>
    </div>
  );

  if(!data) return <div style={{textAlign:"center",padding:40}}><Btn onClick={()=>fetchNews(true)}>Gerar Resumo do Dia</Btn></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:11,color:C.muted}}>Gerado em {new Date(data.generatedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
        <Btn small variant="ghost" onClick={()=>fetchNews(true)}>↻ Atualizar</Btn>
      </div>

      {/* Sentimento */}
      <Card>
        <div style={{padding:16}}>
          <div style={{fontSize:16,fontWeight:700,color:sentimentColor(data.sentimento),marginBottom:6}}>{sentimentLabel(data.sentimento)}</div>
          <div style={{fontSize:13,color:C.textSoft,lineHeight:1.6}}>{data.resumo}</div>
        </div>
      </Card>

      {/* Destaques */}
      {data.destaques?.length>0 && (
        <Card>
          <CardHeader title="Destaques do Dia"/>
          <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
            {data.destaques.map((d,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{color:C.amber,fontSize:14,flexShrink:0}}>•</span>
                <span style={{fontSize:13,color:C.textSoft,lineHeight:1.5}}>{d}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fatores */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Card>
          <CardHeader title="Fatores de Alta"/>
          <div style={{padding:14,display:"flex",flexDirection:"column",gap:6}}>
            {(data.fatores_alta||[]).map((f,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{color:C.green,fontSize:12}}>▲</span>
                <span style={{fontSize:12,color:C.textSoft,lineHeight:1.4}}>{f}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Fatores de Baixa"/>
          <div style={{padding:14,display:"flex",flexDirection:"column",gap:6}}>
            {(data.fatores_baixa||[]).map((f,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{color:C.red,fontSize:12}}>▼</span>
                <span style={{fontSize:12,color:C.textSoft,lineHeight:1.4}}>{f}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Perspectiva */}
      {data.perspectiva && (
        <Card>
          <div style={{padding:14,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:20}}>🔭</span>
            <div>
              <div style={{fontSize:9,color:C.amber,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,marginBottom:4}}>Perspectiva de Curto Prazo</div>
              <div style={{fontSize:13,color:C.white,lineHeight:1.5}}>{data.perspectiva}</div>
            </div>
          </div>
        </Card>
      )}

      {/* WhatsApp */}
      <Btn variant="secondary" full onClick={()=>{
        const msg=`*Resumo Mercado de Cobre — GBM Intelligence*\n*${data.titulo||""}*\n\n${data.resumo}\n\n*Destaques:*\n${(data.destaques||[]).map(d=>`• ${d}`).join("\n")}\n\n*Perspectiva:* ${data.perspectiva}\n\n_GBM International_`;
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
function CreditModule({ user }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const fmtCNPJ = (v="") => { const d=v.replace(/\D/g,"").slice(0,14); return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2"); };
  const fmtDate = (v="") => { if(!v)return"—"; if(/^\d{4}-\d{2}-\d{2}/.test(v)){const[y,m,d]=v.split("T")[0].split("-");return`${d}/${m}/${y}`;}return v; };

  const consultar = async () => {
    const raw = input.replace(/\D/g,"");
    if (raw.length!==14){setError("CNPJ deve conter 14 dígitos.");return;}
    setLoading(true);setError("");setData(null);
    try {
      const r = await fetch(`/api/credit?cnpj=${raw}`);
      const json = await r.json();
      if(!r.ok) throw new Error(json.error||`Erro ${r.status}`);
      setData(json);
    } catch(e){setError(e.message||"Falha na consulta.");}
    finally{setLoading(false);}
  };

  const score = data?.score;
  const rf = data?.rfData;
  const protestos = data?.protestos;
  const processos = data?.processos;
  const socios = rf?.socios || rf?.qsa || [];

  const ScoreGauge = ({pontos, cor, classificacao}) => {
    const pct = pontos / 10;
    return (
      <div style={{textAlign:"center",padding:"20px 16px"}}>
        <div style={{position:"relative",display:"inline-block",width:160,height:80,overflow:"hidden",marginBottom:8}}>
          <div style={{width:160,height:160,borderRadius:"50%",background:`conic-gradient(${cor} 0% ${pct}%, #1e2230 ${pct}% 100%)`,position:"absolute",top:0,left:0}}/>
          <div style={{width:120,height:120,borderRadius:"50%",background:C.card,position:"absolute",top:20,left:20}}/>
        </div>
        <div style={{fontSize:36,fontWeight:700,color:cor,lineHeight:1}}>{pontos}</div>
        <div style={{fontSize:14,color:cor,fontWeight:600,marginTop:4}}>{classificacao}</div>
        <div style={{fontSize:11,color:C.muted,marginTop:4}}>Score GBM (0–1000)</div>
      </div>
    );
  };

  const StatusIcon = ({ok}) => <span style={{fontSize:14}}>{ok?"✅":"❌"}</span>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Aviso plano */}
      {user.plan==="free" && (
        <div style={{background:"rgba(245,158,11,0.06)",border:`1px solid ${C.amberDark}`,borderRadius:8,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:12,color:C.textSoft}}>Plano Free: <strong style={{color:C.amber}}>3 consultas/dia</strong></span>
          <Badge label="Pro = Ilimitado" color={C.amber}/>
        </div>
      )}

      {/* Campo de busca */}
      <div style={{display:"flex",gap:8}}>
        <input
          value={input} onChange={e=>setInput(fmtCNPJ(e.target.value))}
          onKeyDown={e=>e.key==="Enter"&&consultar()}
          placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric"
          style={{flex:1,background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"12px 14px",fontSize:16,fontFamily:"monospace",letterSpacing:"0.08em",color:C.white,outline:"none",caretColor:C.amber}}
          onFocus={e=>e.target.style.borderColor=C.amber}
          onBlur={e=>e.target.style.borderColor="#374151"}
        />
        <Btn onClick={consultar} disabled={loading}>{loading?"...":"Analisar"}</Btn>
      </div>
      {error && <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"10px 14px",borderRadius:8,fontSize:13}}>⚠ {error}</div>}
      {loading && (
        <div style={{textAlign:"center",padding:30}}>
          <Spinner/>
          <div style={{fontSize:12,color:C.muted,marginTop:8}}>Consultando Receita Federal, CENPROT e CNJ...</div>
        </div>
      )}

      {data && score && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Score principal */}
          <Card>
            <CardHeader title="Score GBM Intelligence" subtitle="Indicativo — baseado em dados públicos"/>
            <ScoreGauge pontos={score.pontos} cor={score.cor} classificacao={score.classificacao}/>
            <div style={{padding:"0 16px 16px"}}>
              <div style={{background:`${score.cor}15`,border:`1px solid ${score.cor}40`,borderRadius:8,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:13,color:score.cor,fontWeight:600}}>📋 {score.recomendacao}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {score.fatores.map((f,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid rgba(100,116,139,0.1)`}}>
                    <span style={{fontSize:12,color:C.textSoft,flex:1}}>{f.positivo?"✅":"❌"} {f.label}</span>
                    {f.impacto!==0 && <span style={{fontSize:12,color:C.red,fontWeight:600,flexShrink:0}}>{f.impacto}</span>}
                  </div>
                ))}
              </div>
              <div style={{fontSize:10,color:C.muted,marginTop:10,fontStyle:"italic"}}>{score.fonte}</div>
            </div>
          </Card>

          {/* Empresa */}
          {rf && (
            <Card>
              <CardHeader
                title={rf.razao_social||"Empresa"}
                right={<Badge label={rf.estabelecimento?.situacao_cadastral?.descricao||"—"} color={rf.estabelecimento?.situacao_cadastral?.descricao?.includes("ATIVA")?C.green:C.red}/>}
              />
              <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  ["CNPJ", fmtCNPJ(data.cnpj)],
                  ["Abertura", fmtDate(rf.estabelecimento?.data_inicio_atividade)],
                  ["Porte", rf.porte?.descricao],
                  ["Capital Social", parseFloat(rf.capital_social||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})],
                  ["Natureza Jurídica", rf.natureza_juridica?.descricao],
                  ["CNAE", rf.estabelecimento?.atividade_principal?.descricao],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",flexDirection:"column",gap:2}}>
                    <span style={{fontSize:9,color:C.amber,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>{l}</span>
                    <span style={{fontSize:12,color:C.white,wordBreak:"break-word",lineHeight:1.4}}>{v||"—"}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Protestos */}
          <Card>
            <CardHeader
              title="Protestos em Cartório"
              subtitle="Fonte: CENPROT — Central Nacional de Protestos"
              right={
                protestos?.status==="limpo" ? <Badge label="LIMPO" color={C.green}/> :
                protestos?.status==="protestado" ? <Badge label="PROTESTADO" color={C.red}/> :
                <Badge label="VERIFICAR" color={C.amber}/>
              }
            />
            <div style={{padding:16}}>
              {protestos?.status==="limpo" && (
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:24}}>✅</span>
                  <span style={{fontSize:13,color:C.textSoft}}>Nenhum protesto localizado nos cartórios do Brasil.</span>
                </div>
              )}
              {protestos?.status==="protestado" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:24}}>❌</span>
                    <div>
                      <div style={{fontSize:14,color:C.red,fontWeight:600}}>{protestos.quantidade} protesto(s) localizado(s)</div>
                      <div style={{fontSize:12,color:C.muted}}>{protestos.obs}</div>
                    </div>
                  </div>
                  <a href="https://pesquisaprotesto.com.br" target="_blank" rel="noreferrer"
                    style={{fontSize:12,color:C.amber,textDecoration:"underline"}}>
                    Ver detalhes em pesquisaprotesto.com.br →
                  </a>
                </div>
              )}
              {(protestos?.status==="verificar"||protestos?.status==="indisponivel") && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{fontSize:13,color:C.textSoft}}>⚠ {protestos.obs}</div>
                  <a href="https://pesquisaprotesto.com.br" target="_blank" rel="noreferrer"
                    style={{fontSize:12,color:C.amber,textDecoration:"underline"}}>
                    Consultar manualmente em pesquisaprotesto.com.br →
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* Processos Judiciais */}
          <Card>
            <CardHeader
              title="Processos Judiciais"
              subtitle="Fonte: CNJ DataJud"
              right={<Badge label={`${processos?.total||0} processo(s)`} color={processos?.total>0?C.red:C.green}/>}
            />
            <div style={{padding:16}}>
              {processos?.total===0 ? (
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:24}}>✅</span>
                  <span style={{fontSize:13,color:C.textSoft}}>Nenhum processo judicial localizado.</span>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {processos?.lista?.map((p,i)=>(
                    <div key={i} style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:C.red,fontFamily:"monospace",marginBottom:4}}>{p.numero||"—"}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {[
                          ["Classe",p.classe],["Assunto",p.assunto],
                          ["Tribunal",p.tribunal],["Ajuizamento",fmtDate(p.dataAjuizamento)],
                        ].map(([l,v])=>(
                          <div key={l}>
                            <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</div>
                            <div style={{fontSize:11,color:C.textSoft}}>{v||"—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {processos?.total > 5 && (
                    <div style={{fontSize:12,color:C.muted,textAlign:"center"}}>... e mais {processos.total-5} processo(s)</div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Quadro societário */}
          {socios.length > 0 && (
            <Card>
              <CardHeader title="Quadro Societário" subtitle={`${socios.length} sócio(s) / administrador(es)`}/>
              <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
                {socios.map((s,i)=>(
                  <div key={i} style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:13,color:C.white,fontWeight:600}}>{s.nome||s.nome_socio||"—"}</div>
                      <div style={{fontSize:11,color:C.muted}}>{s.qualificacao_socio?.descricao||s.qualificacao||""}</div>
                    </div>
                    {s.pais_origem && <Badge label={s.pais_origem.nome||s.pais_origem} color={C.muted}/>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Slot Serasa — futuro */}
          <div style={{background:"rgba(245,158,11,0.04)",border:`1px dashed ${C.amberDark}`,borderRadius:8,padding:14,textAlign:"center"}}>
            <div style={{fontSize:13,color:C.muted,marginBottom:4}}>🔌 Score Serasa / SPC + Dívidas Detalhadas</div>
            <div style={{fontSize:11,color:"#475569"}}>Disponível após integração com Serasa Experian ou Netrin</div>
          </div>

          {/* Erros de API */}
          {data.errors?.length > 0 && (
            <div style={{fontSize:11,color:"#475569",padding:"8px 12px",background:"#0d0f14",borderRadius:6}}>
              ℹ️ {data.errors.join(" · ")}
            </div>
          )}
        </div>
      )}

      {!data && !loading && !error && (
        <div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>
          <div style={{fontSize:40,marginBottom:8}}>🔍</div>
          <div style={{fontSize:13}}>Digite um CNPJ para analisar crédito</div>
          <div style={{fontSize:11,marginTop:6,color:"#334155"}}>Protestos · Processos · Sócios · Score GBM</div>
        </div>
      )}
    </div>
  );
}
