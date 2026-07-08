import { useState, useEffect, useCallback } from "react";
import CreditReportComponent from "./CreditReport";

// ─── Auth / Planos ────────────────────────────────────────────────────────────
const PLANS = {
  free:     { label: "Free",     color: "#64748b", limit: Infinity },
  business: { label: "Business", color: "#10b981", limit: Infinity },
  pro:      { label: "Pró",      color: "#f59e0b", limit: Infinity },
};

// Módulos da barra inferior liberados por plano
const ACESSO_MODULOS = {
  free:     ["lme", "news"],
  business: ["lme", "calc", "cnpj", "news"],
  pro:      ["lme", "calc", "cnpj", "credit", "news"],
};

function podeAcessar(plan, moduleId) {
  return (ACESSO_MODULOS[plan] || ACESSO_MODULOS.free).includes(moduleId);
}

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

// ─── LGPD: MODAL POLÍTICA DE PRIVACIDADE ─────────────────────────────────────
function ModalPrivacidade({ onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}>
      <div style={{background:"#111318",border:"1px solid rgba(245,158,11,0.3)",borderRadius:12,maxWidth:600,width:"100%",padding:24,marginTop:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.amber}}>Política de Privacidade</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{fontSize:12,color:C.textSoft,lineHeight:1.8,display:"flex",flexDirection:"column",gap:14}}>
          <p style={{margin:0}}><strong style={{color:C.white}}>Controlador dos dados:</strong> GBM International Comércio de Metais Ltda., inscrita no CNPJ sob nº a definir, com sede em São Paulo/SP.</p>
          <p style={{margin:0}}><strong style={{color:C.white}}>Encarregado (DPO):</strong> <a href="mailto:lgpd@gbminternational.com.br" style={{color:C.amber}}>lgpd@gbminternational.com.br</a></p>

          <div>
            <strong style={{color:C.white}}>1. Dados tratados e finalidades</strong>
            <ul style={{margin:"6px 0 0 16px",display:"flex",flexDirection:"column",gap:4}}>
              <li><strong>Credenciais de acesso</strong> (e-mail, senha): autenticação na plataforma. Base legal: execução de contrato (art. 7º, V, LGPD).</li>
              <li><strong>Histórico de consultas CNPJ e cálculos</strong>: armazenado localmente no dispositivo do usuário (localStorage) para facilitar o uso. Base legal: legítimo interesse (art. 7º, IX, LGPD).</li>
              <li><strong>Dados de contatos B2B</strong> (nome, cargo, e-mail corporativo, telefone profissional): obtidos de base de dados de prospecção comercial para fins exclusivos de atividade comercial B2B. Base legal: legítimo interesse (art. 7º, IX, LGPD) e dado manifestamente público no contexto profissional (art. 7º, IV).</li>
              <li><strong>Dados cadastrais de pessoas jurídicas</strong> (CNPJ, razão social, sócios): dados públicos da Receita Federal do Brasil. Base legal: dado público (art. 7º, IV, LGPD).</li>
            </ul>
          </div>

          <div>
            <strong style={{color:C.white}}>2. Compartilhamento de dados</strong>
            <p style={{margin:"6px 0 0"}}>Os dados são processados internamente e por fornecedores de infraestrutura (Vercel Inc. — hospedagem) e de inteligência comercial, todos sujeitos a acordos de confidencialidade. Não comercializamos dados pessoais.</p>
          </div>

          <div>
            <strong style={{color:C.white}}>3. Retenção</strong>
            <p style={{margin:"6px 0 0"}}>Dados armazenados no dispositivo (localStorage) são eliminados ao limpar o cache do navegador ou ao usar a função "Apagar meus dados" disponível na plataforma. Dados de acesso são mantidos enquanto a conta estiver ativa.</p>
          </div>

          <div>
            <strong style={{color:C.white}}>4. Direitos do titular (art. 18, LGPD)</strong>
            <ul style={{margin:"6px 0 0 16px",display:"flex",flexDirection:"column",gap:3}}>
              <li>Confirmação e acesso aos dados tratados</li>
              <li>Correção de dados incompletos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados</li>
              <li>Eliminação dos dados tratados com consentimento</li>
              <li>Revogação do consentimento</li>
              <li>Oposição ao tratamento em caso de descumprimento</li>
            </ul>
            <p style={{margin:"6px 0 0"}}>Para exercer seus direitos, envie solicitação para <a href="mailto:lgpd@gbminternational.com.br" style={{color:C.amber}}>lgpd@gbminternational.com.br</a>. Responderemos em até 15 dias úteis.</p>
          </div>

          <div>
            <strong style={{color:C.white}}>5. Segurança</strong>
            <p style={{margin:"6px 0 0"}}>Adotamos medidas técnicas e organizacionais adequadas para proteger os dados contra acesso não autorizado, perda ou divulgação indevida, incluindo comunicação cifrada (HTTPS/TLS) e controle de acesso por credenciais.</p>
          </div>

          <div>
            <strong style={{color:C.white}}>6. Alterações</strong>
            <p style={{margin:"6px 0 0"}}>Esta política pode ser atualizada. Notificaremos os usuários sobre mudanças relevantes. Versão vigente: junho/2026.</p>
          </div>

          <p style={{margin:0,fontSize:10,color:C.muted}}>Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD)</p>
        </div>
        <div style={{marginTop:20}}>
          <Btn full onClick={onClose}>Fechar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── LGPD: MODAL MEUS DADOS ───────────────────────────────────────────────────
function ModalMeusDados({ onClose }) {
  const [apagado, setApagado] = useState(false);

  const apagarDados = () => {
    const keysParaManter = ["gbm_user","gbm_lgpd_consent"];
    const keys = Object.keys(localStorage).filter(k => !keysParaManter.includes(k) && k.startsWith("gbm_"));
    keys.forEach(k => localStorage.removeItem(k));
    setApagado(true);
  };

  const consentInfo = (() => {
    try {
      const c = JSON.parse(localStorage.getItem("gbm_lgpd_consent") || "null");
      return c ? new Date(c.ts).toLocaleString("pt-BR") : null;
    } catch { return null; }
  })();

  const dadosLocais = [
    { label: "Histórico de CNPJs consultados", key: "gbm_cnpj_history" },
    { label: "Histórico de cálculos", key: "gbm_calc_hist" },
    { label: "Cache de notícias", key: null },
  ].map(d => ({ ...d, presente: d.key ? !!localStorage.getItem(d.key) : Object.keys(localStorage).some(k => k.startsWith("gbm_news_")) }));

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}>
      <div style={{background:"#111318",border:"1px solid rgba(245,158,11,0.3)",borderRadius:12,maxWidth:500,width:"100%",padding:24,marginTop:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.amber}}>🔒 Meus Dados — LGPD</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16,fontSize:12,color:C.textSoft}}>

          {/* Consentimento */}
          <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:8,padding:12}}>
            <div style={{fontSize:10,color:"#10b981",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:4}}>Consentimento registrado</div>
            <div style={{color:C.white}}>{consentInfo || "Não localizado neste dispositivo"}</div>
          </div>

          {/* Dados locais */}
          <div>
            <div style={{fontSize:10,color:C.amber,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:8}}>Dados armazenados neste dispositivo</div>
            {dadosLocais.map((d,i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(100,116,139,0.1)"}}>
                <span>{d.label}</span>
                <span style={{color:d.presente?"#f59e0b":"#334155"}}>{d.presente ? "Presente" : "Vazio"}</span>
              </div>
            ))}
          </div>

          {/* Direitos */}
          <div style={{background:"rgba(100,116,139,0.08)",border:"1px solid rgba(100,116,139,0.15)",borderRadius:8,padding:12}}>
            <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:6}}>Seus direitos (art. 18, LGPD)</div>
            <ul style={{margin:0,paddingLeft:16,display:"flex",flexDirection:"column",gap:3}}>
              <li>Acesso e confirmação dos dados tratados</li>
              <li>Correção, bloqueio ou eliminação</li>
              <li>Portabilidade e revogação do consentimento</li>
            </ul>
            <p style={{margin:"8px 0 0"}}>Contato do encarregado (DPO):<br/>
              <a href="mailto:lgpd@gbminternational.com.br" style={{color:C.amber}}>lgpd@gbminternational.com.br</a>
            </p>
          </div>

          {/* Apagar dados */}
          {apagado ? (
            <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:12,color:"#10b981",textAlign:"center"}}>
              ✓ Dados locais apagados com sucesso.
            </div>
          ) : (
            <Btn variant="danger" full onClick={apagarDados}>
              Apagar meus dados locais
            </Btn>
          )}
          <p style={{margin:0,fontSize:10,color:C.muted,textAlign:"center"}}>Apenas dados armazenados neste dispositivo serão removidos. Seus dados de acesso permanecem para manter a conta ativa.</p>
        </div>
        <div style={{marginTop:20}}>
          <Btn full variant="ghost" onClick={onClose}>Fechar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function AuthShell({ children }) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:"0.3em",textTransform:"uppercase",marginBottom:6}}>GBM International</div>
          <div style={{fontSize:28,fontWeight:700,color:C.amber,letterSpacing:"-0.02em"}}>Intelligence</div>
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>Plataforma de Inteligência para o Mercado de Cobre</div>
        </div>
        {children}
      </div>
    </div>
  );
}

const linkStyle = {background:"none",border:"none",color:C.amber,cursor:"pointer",fontFamily:"inherit",fontSize:12,padding:0,textDecoration:"underline"};
const errBox = {background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"8px 12px",borderRadius:6,fontSize:13};
const okBox  = {background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",color:"#6ee7b7",padding:"10px 12px",borderRadius:6,fontSize:13};

function LoginPage({ onLogin, onGoRegister, onAdmin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [showPriv, setShowPriv] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const handleLogin = async () => {
    if (!aceito) { setErr("Aceite a Política de Privacidade para continuar."); return; }
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/auth?acao=login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha: pass }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha no login.");
      localStorage.setItem("gbm_lgpd_consent", JSON.stringify({ ts: new Date().toISOString(), email: email.trim() }));
      onLogin(d.user);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleAdmin = async () => {
    setAdminLoading(true); setAdminErr("");
    try {
      const r = await fetch("/api/admin?acao=login", {
        method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": adminPass },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Acesso negado.");
      onAdmin(adminPass);
    } catch (e) { setAdminErr(e.message); }
    finally { setAdminLoading(false); }
  };

  return (
    <AuthShell>
      {showPriv && <ModalPrivacidade onClose={()=>setShowPriv(false)}/>}
      <Card>
        <div style={{padding:24,display:"flex",flexDirection:"column",gap:16}}>
          <Input label="E-mail" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" type="email" />
          <Input label="Senha" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" type="password" />
          <label style={{display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer"}}>
            <input type="checkbox" checked={aceito} onChange={e=>setAceito(e.target.checked)}
              style={{marginTop:3,accentColor:C.amber,width:16,height:16,flexShrink:0,cursor:"pointer"}}/>
            <span style={{fontSize:11,color:C.textSoft,lineHeight:1.6}}>
              Li e aceito a{" "}
              <button onClick={e=>{e.preventDefault();setShowPriv(true);}} style={{...linkStyle,fontSize:11}}>
                Política de Privacidade
              </button>
              {" "}e autorizo o tratamento dos meus dados conforme a LGPD (Lei 13.709/2018).
            </span>
          </label>
          {err && <div style={errBox}>⚠ {err}</div>}
          <Btn onClick={handleLogin} disabled={loading||!aceito} full>{loading?"Entrando...":"Entrar"}</Btn>
          <div style={{textAlign:"center",fontSize:12,color:C.textSoft}}>
            Ainda não tem acesso?{" "}
            <button onClick={onGoRegister} style={linkStyle}>Criar conta</button>
          </div>
        </div>
      </Card>

      {/* Acesso administrativo (discreto) */}
      <div style={{marginTop:24,textAlign:"center"}}>
        {!showAdmin ? (
          <button onClick={()=>setShowAdmin(true)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase"}}>
            ⚙ Acesso administrativo
          </button>
        ) : (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>Painel Master</div>
            <input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleAdmin()} placeholder="Senha master"
              style={{background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"9px 12px",fontSize:14,color:C.white,outline:"none",fontFamily:"monospace"}}/>
            {adminErr && <div style={{...errBox,fontSize:12}}>{adminErr}</div>}
            <div style={{display:"flex",gap:8}}>
              <Btn small variant="ghost" onClick={()=>{setShowAdmin(false);setAdminPass("");setAdminErr("");}}>Cancelar</Btn>
              <Btn small onClick={handleAdmin} disabled={adminLoading||!adminPass} full>{adminLoading?"...":"Entrar"}</Btn>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function RegisterPage({ onGoLogin }) {
  const [f, setF] = useState({ nome:"", empresa:"", email:"", telefone:"", senha:"", senha2:"" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [showPriv, setShowPriv] = useState(false);
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));

  const handleRegister = async () => {
    setErr("");
    if (!f.nome.trim() || !f.email.trim() || !f.senha) { setErr("Preencha nome, e-mail e senha."); return; }
    if (f.senha.length < 6) { setErr("A senha deve ter ao menos 6 caracteres."); return; }
    if (f.senha !== f.senha2) { setErr("As senhas não conferem."); return; }
    if (!aceito) { setErr("Aceite a Política de Privacidade para continuar."); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/auth?acao=register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome:f.nome, empresa:f.empresa, email:f.email, telefone:f.telefone, senha:f.senha }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha no cadastro.");
      setOk(true);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  if (ok) return (
    <AuthShell>
      <Card>
        <div style={{padding:28,textAlign:"center",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:44}}>✅</div>
          <div style={{fontSize:17,fontWeight:700,color:C.white}}>Cadastro enviado!</div>
          <div style={{fontSize:13,color:C.textSoft,lineHeight:1.6}}>
            Seu pedido de acesso foi encaminhado para aprovação. Você poderá entrar assim que o administrador liberar o seu plano.
          </div>
          <Btn variant="ghost" onClick={onGoLogin} full>Voltar ao login</Btn>
        </div>
      </Card>
    </AuthShell>
  );

  return (
    <AuthShell>
      {showPriv && <ModalPrivacidade onClose={()=>setShowPriv(false)}/>}
      <Card>
        <div style={{padding:24,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:14,fontWeight:700,color:C.white,textAlign:"center"}}>Criar conta</div>
          <Input label="Nome completo *" value={f.nome} onChange={set("nome")} placeholder="Seu nome" />
          <Input label="Empresa" value={f.empresa} onChange={set("empresa")} placeholder="Nome da empresa" />
          <Input label="E-mail *" value={f.email} onChange={set("email")} placeholder="seu@email.com" type="email" />
          <Input label="Telefone / WhatsApp" value={f.telefone} onChange={set("telefone")} placeholder="(11) 90000-0000" inputMode="tel" />
          <Input label="Senha *" value={f.senha} onChange={set("senha")} placeholder="mín. 6 caracteres" type="password" />
          <Input label="Confirmar senha *" value={f.senha2} onChange={set("senha2")} placeholder="repita a senha" type="password" />
          <label style={{display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer"}}>
            <input type="checkbox" checked={aceito} onChange={e=>setAceito(e.target.checked)}
              style={{marginTop:3,accentColor:C.amber,width:16,height:16,flexShrink:0,cursor:"pointer"}}/>
            <span style={{fontSize:11,color:C.textSoft,lineHeight:1.6}}>
              Li e aceito a{" "}
              <button onClick={e=>{e.preventDefault();setShowPriv(true);}} style={{...linkStyle,fontSize:11}}>Política de Privacidade</button>
              {" "}(LGPD).
            </span>
          </label>
          {err && <div style={errBox}>⚠ {err}</div>}
          <Btn onClick={handleRegister} disabled={loading} full>{loading?"Enviando...":"Enviar cadastro"}</Btn>
          <div style={{textAlign:"center",fontSize:12,color:C.textSoft}}>
            Já tem conta?{" "}
            <button onClick={onGoLogin} style={linkStyle}>Fazer login</button>
          </div>
        </div>
      </Card>
    </AuthShell>
  );
}

// ─── PAINEL MASTER (aprovação de cadastros) ──────────────────────────────────
function AdminPanel({ secret, onExit }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filtro, setFiltro] = useState("pendente"); // pendente | aprovado | rejeitado | todos
  const [salvando, setSalvando] = useState("");
  const [apisUso, setApisUso] = useState(null);
  const [loadingUso, setLoadingUso] = useState(true);

  const carregar = async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/admin?acao=list", { method:"POST", headers:{ "Content-Type":"application/json", "x-admin-secret":secret }, body:"{}" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao carregar.");
      setUsuarios(d.usuarios || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const carregarUso = async () => {
    setLoadingUso(true);
    try {
      const r = await fetch("/api/admin?acao=usage", { method:"POST", headers:{ "Content-Type":"application/json", "x-admin-secret":secret }, body:"{}" });
      const d = await r.json();
      if (r.ok) setApisUso(d.apis || []);
    } catch {}
    finally { setLoadingUso(false); }
  };

  useEffect(() => { carregar(); carregarUso(); }, []);

  const atualizar = async (id, patch) => {
    setSalvando(id);
    try {
      const r = await fetch("/api/admin?acao=update", { method:"POST", headers:{ "Content-Type":"application/json", "x-admin-secret":secret }, body:JSON.stringify({ id, ...patch }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao salvar.");
      setUsuarios(prev => prev.map(u => u.id===id ? { ...u, ...d.usuario } : u));
    } catch (e) { setErr(e.message); }
    finally { setSalvando(""); }
  };

  const aprovarComPlano = (id, plano) => atualizar(id, { plano, status:"aprovado" });

  const fmtData = (s) => s ? new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
  const contagem = (st) => usuarios.filter(u=>u.status===st).length;
  const lista = filtro==="todos" ? usuarios : usuarios.filter(u=>u.status===filtro);
  const statusCor = { pendente:"#f59e0b", aprovado:"#10b981", rejeitado:"#ef4444" };

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Georgia,serif",paddingBottom:40}}>
      <div style={{background:C.bg2,borderBottom:"1px solid rgba(245,158,11,0.15)",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:720,margin:"0 auto",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:"0.2em",textTransform:"uppercase"}}>GBM Intelligence</div>
            <div style={{fontSize:18,fontWeight:700,color:C.amber}}>Painel Master</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn small variant="ghost" onClick={carregar}>↻ Atualizar</Btn>
            <Btn small variant="ghost" onClick={onExit}>Sair</Btn>
          </div>
        </div>
      </div>

      <div style={{maxWidth:720,margin:"0 auto",padding:"16px"}}>
        {/* Créditos das APIs externas */}
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>Créditos das APIs</span>
            <button onClick={carregarUso} disabled={loadingUso} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11}}>↻ atualizar</button>
          </div>
          {loadingUso && !apisUso ? (
            <div style={{fontSize:12,color:C.muted,padding:"8px 0"}}>carregando…</div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
              {(apisUso||[]).map(a=>{
                const pct = (a.total && a.restantes!=null) ? Math.max(0, Math.min(100, Math.round((a.restantes/a.total)*100))) : null;
                const cor = a.erro ? C.red : pct==null ? C.muted : pct<15 ? C.red : pct<35 ? C.amber : C.green;
                return (
                  <div key={a.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.white}}>{a.nome}</div>
                        {a.erro ? (
                          <div style={{fontSize:11,color:C.red,marginTop:2}}>⚠ {a.erro}</div>
                        ) : (
                          <div style={{fontSize:10,color:C.muted,marginTop:2}}>
                            {a.usados!=null && `${a.usados.toLocaleString("pt-BR")} usados`}
                            {a.plano && ` · plano ${a.plano}`}
                            {a.renovaEm && ` · renova ${new Date(a.renovaEm).toLocaleDateString("pt-BR")}`}
                            {a.expiraEm && ` · expira ${new Date(a.expiraEm).toLocaleDateString("pt-BR")}`}
                          </div>
                        )}
                        {a.limiteDiario && (
                          <div style={{fontSize:10,color:C.muted,marginTop:1}}>
                            Hoje: {a.limiteDiario.remaining}/{a.limiteDiario.limit} disponíveis
                          </div>
                        )}
                      </div>
                      {!a.erro && a.restantes!=null && (
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:22,fontWeight:700,color:cor,lineHeight:1}}>{a.restantes.toLocaleString("pt-BR")}</div>
                          <div style={{fontSize:9,color:C.muted}}>{a.total!=null ? `de ${a.total.toLocaleString("pt-BR")} restantes` : "créditos restantes"}</div>
                        </div>
                      )}
                    </div>
                    {pct!=null && (
                      <div style={{marginTop:10,height:6,background:"#0d0f14",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,height:"100%",background:cor,borderRadius:3}}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          {[["pendente",`Pendentes (${contagem("pendente")})`],["aprovado",`Aprovados (${contagem("aprovado")})`],["rejeitado",`Rejeitados (${contagem("rejeitado")})`],["todos",`Todos (${usuarios.length})`]].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltro(v)}
              style={{padding:"7px 12px",borderRadius:6,background:filtro===v?"rgba(245,158,11,0.15)":C.card,border:`1px solid ${filtro===v?"rgba(245,158,11,0.5)":C.border}`,color:filtro===v?C.amber:C.muted,fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:filtro===v?700:400}}>
              {l}
            </button>
          ))}
        </div>

        {err && <div style={{...errBox,marginBottom:12}}>⚠ {err}</div>}
        {loading ? <Spinner/> : lista.length===0 ? (
          <div style={{textAlign:"center",padding:"50px 0",color:C.muted}}>
            <div style={{fontSize:40,marginBottom:8}}>📭</div>
            <div style={{fontSize:13}}>Nenhum cadastro nesta categoria</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {lista.map(u=>(
              <Card key={u.id}>
                <div style={{padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:700,color:C.white}}>{u.nome}</div>
                      <div style={{fontSize:12,color:C.textSoft,marginTop:2}}>{u.email}</div>
                      {u.empresa && <div style={{fontSize:12,color:C.muted,marginTop:1}}>🏢 {u.empresa}</div>}
                      {u.telefone && <div style={{fontSize:12,color:C.muted,marginTop:1}}>📱 {u.telefone}</div>}
                      <div style={{fontSize:10,color:"#475569",marginTop:4}}>Cadastro: {fmtData(u.criado_em)}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                      <Badge label={u.status} color={statusCor[u.status]||C.muted}/>
                      {u.plano && <Badge label={PLANS[u.plano]?.label||u.plano} color={PLANS[u.plano]?.color||C.muted}/>}
                      {u.plano==="business" && <span style={{fontSize:10,color:C.green}}>{u.creditos_prosp ?? 0} créditos</span>}
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Definir plano e aprovar</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {["free","business","pro"].map(pl=>(
                        <button key={pl} disabled={salvando===u.id} onClick={()=>aprovarComPlano(u.id, pl)}
                          style={{flex:"1 1 30%",padding:"9px 8px",borderRadius:6,background:u.plano===pl&&u.status==="aprovado"?`${PLANS[pl].color}22`:C.bg2,border:`1px solid ${u.plano===pl&&u.status==="aprovado"?PLANS[pl].color:"#1e293b"}`,color:u.plano===pl&&u.status==="aprovado"?PLANS[pl].color:C.textSoft,fontSize:12,fontWeight:700,cursor:salvando===u.id?"wait":"pointer",fontFamily:"Georgia,serif"}}>
                          {PLANS[pl].label}
                        </button>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:8}}>
                      {u.status!=="rejeitado" && (
                        <Btn small variant="danger" onClick={()=>atualizar(u.id,{status:"rejeitado"})}>Rejeitar</Btn>
                      )}
                      {u.status!=="pendente" && (
                        <Btn small variant="ghost" onClick={()=>atualizar(u.id,{status:"pendente"})}>Voltar p/ pendente</Btn>
                      )}
                      {salvando===u.id && <span style={{fontSize:11,color:C.muted,alignSelf:"center"}}>salvando…</span>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
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
  const [cnpjDataParaProsp, setCnpjDataParaProsp] = useState(null);

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
      setCnpjDataParaProsp({ atividadePrincipal: json?.estabelecimento?.atividade_principal, atividadesSecundarias: json?.estabelecimento?.atividades_secundarias || [] });
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
    socios: data.socios || [],
    responsavel: data.qualificacao_do_responsavel?.descricao || "",
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
        {[["consulta","Consulta"],["prospeccao","Prospecção"],["lusha","Prospecção Avançada"],["historico","Histórico"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"10px 8px",background:tab===t?C.amber:"transparent",color:tab===t?C.bg:C.muted,border:"none",cursor:"pointer",fontWeight:tab===t?700:400,fontSize:13,fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
            {l==="Histórico"?`Histórico (${history.length})`:l}
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

              {/* Presença Online — busca rápida */}
              <Card>
                <CardHeader title="Presença Online" subtitle="Buscar na web"/>
                <div style={{padding:16,display:"flex",flexDirection:"column",gap:8}}>
                  {(() => {
                    const nome = encodeURIComponent((s.razaoSocial || s.fantasia || "").trim());
                    const cidade = encodeURIComponent((s.cidade || "").trim());
                    const botoes = [
                      { label: "🌐 Site oficial", url: `https://www.google.com/search?q=${nome}+${cidade}+site+oficial`, cor: "#f59e0b" },
                      { label: "💼 LinkedIn",     url: `https://www.google.com/search?q=${nome}+linkedin`, cor: "#0a66c2" },
                      { label: "📷 Instagram",    url: `https://www.google.com/search?q=${nome}+instagram`, cor: "#e1306c" },
                      { label: "🔍 Google",       url: `https://www.google.com/search?q=${nome}+${cidade}`, cor: "#94a3b8" },
                    ];
                    return botoes.map((b,i)=>(
                      <a key={i} href={b.url} target="_blank" rel="noreferrer"
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0d0f14",border:`1px solid ${b.cor}33`,borderRadius:8,padding:"10px 14px",textDecoration:"none",touchAction:"manipulation"}}>
                        <span style={{fontSize:13,color:"#fff",fontWeight:500}}>{b.label}</span>
                        <span style={{fontSize:14,color:b.cor}}>→</span>
                      </a>
                    ));
                  })()}
                  <div style={{fontSize:10,color:"#475569",marginTop:2,textAlign:"center"}}>Abre a busca em nova aba</div>
                </div>
              </Card>

              {/* Quadro Societário */}
              {s.socios && s.socios.length > 0 && (
                <Card>
                  <CardHeader title="Quadro Societário" subtitle={`${s.socios.length} sócio(s)`}/>
                  <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
                    {s.socios.map((socio,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,paddingBottom:i<s.socios.length-1?10:0,borderBottom:i<s.socios.length-1?`1px solid ${C.border}`:"none",flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:600,color:C.white}}>{socio.nome||"—"}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{socio.qualificacao_socio?.descricao||socio.qualificacao||"—"}</div>
                          {socio.faixa_etaria && <div style={{fontSize:10,color:C.textSoft,marginTop:1}}>{socio.faixa_etaria}</div>}
                        </div>
                        {socio.data_entrada && (
                          <div style={{textAlign:"right",fontSize:10,color:C.textSoft}}>
                            Desde<br/>{fmt.date(socio.data_entrada)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* WhatsApp share */}
              <Btn variant="secondary" full onClick={()=>{
                const msg=`*Consulta CNPJ — GBM Intelligence*\n*Empresa:* ${s.razaoSocial}\n*CNPJ:* ${fmt.cnpj(s.cnpj||"")}\n*Situação:* ${s.situacao}\n*Cidade:* ${s.cidade}/${s.uf}\n*CNAE:* ${s.cnae||"—"}${s.socios&&s.socios.length>0?`\n*Sócio:* ${s.socios[0].nome}`:""}`;
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

      {tab==="lusha" && (
        <LushaModule user={user} razaoSocial={data?.razao_social||data?.razaoSocial||""}/>
      )}

      {tab==="prospeccao" && (
        <ProspeccoesModule user={user} cnpjData={cnpjDataParaProsp}/>
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
          onChange={e => { setMesSel(e.target.value); fetchLME(e.target.value); }}
          style={{flex:1,background:"#1e2230",border:"1px solid #374151",borderRadius:6,padding:"8px 12px",fontSize:13,color:"#fff",outline:"none",fontFamily:"Georgia,serif"}}
        >
          <option value="">Mês atual</option>
          {(data?.meses||[]).map(m => {
            const val = typeof m === "object" ? m.value : m;
            const lbl = typeof m === "object" ? m.label : m;
            return <option key={val} value={val}>{lbl}</option>;
          })}
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
            <span style={{fontSize:10,color:"#334155"}}>{data.mes}</span>
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


// ─── MÓDULO 3: CALCULADORA LME ───────────────────────────────────────────────
// Fórmula: Preço R$/kg = (LME + prêmio) × câmbio / 1000 / fator

// Grupo 1 — ICMS + PIS/Cofins (lingotados e laminados)
const FATORES_G1 = { "0%": 1.0000, "4%": 0.8440, "7%": 0.8712, "12%": 0.7986 };
// Grupo 2 — Somente ICMS (sucatas / cobre moído)
const FATORES_G2 = { "Sem ICMS": 1.0000, "Com ICMS": 0.8800 };

const PRODUTOS = [
  // Grupo 1 — ICMS + PIS/Cofins
  { key:"catodo",   label:"Catódo",            grupo:1, premioUSD:0,    premioTipo:"usd" },
  { key:"palanqui", label:"Palanquilha",        grupo:1, premioUSD:70,   premioTipo:"usd" },
  { key:"lingote",  label:"Lingote",            grupo:1, premioUSD:-280, premioTipo:"usd" },
  { key:"vergalho", label:"Vergalhão de Cobre", grupo:1, premioUSD:0,    premioTipo:"usd" },
  // Grupo 2 — Somente ICMS
  { key:"sucata",   label:"Sucata",             grupo:2, premioUSD:0,    premioTipo:"usd" },
  { key:"moido",    label:"Cobre Moído",         grupo:2, premioUSD:0,    premioTipo:"usd" },
  { key:"mel",      label:"Cobre Mel",           grupo:2, premioUSD:0,    premioTipo:"usd" },
  { key:"misto",    label:"Cobre Misto",         grupo:2, premioUSD:0,    premioTipo:"usd" },
];

function calcular({ lme, cambio, produto, premioTipo, premioValor, icms }) {
  const prod = PRODUTOS.find(p => p.key === produto);
  const fatores = prod?.grupo === 2 ? FATORES_G2 : FATORES_G1;
  const fator = fatores[icms] ?? 1.0;
  const taxLabel = prod?.grupo === 2 ? "ICMS" : "ICMS+PIS/Cofins";

  let lmeLiquido;
  const premioNum = parseFloat(String(premioValor || "0").replace(",", ".")) || 0;
  if (premioTipo === "usd") {
    lmeLiquido = lme + premioNum;
  } else {
    lmeLiquido = lme * (1 + premioNum / 100);
  }

  const precoSemTax = (lmeLiquido * cambio) / 1000;
  const precoComTax = precoSemTax / fator;

  return {
    lmeLiquido,
    precoUSDt: lmeLiquido,
    precoRkgSem: precoSemTax,
    precoRkgCom: precoComTax,
    taxValor: precoComTax - precoSemTax,
    fator,
    taxLabel,
  };
}

function CalculatorModule({ user }) {
  // Inputs
  const [lmeAuto, setLmeAuto]         = useState(null);
  const [cambioAuto, setCambioAuto]   = useState(null);
  const [semanaRef, setSemanaRef]     = useState("");
  const [loadingAuto, setLoadingAuto] = useState(true);

  const [lmeManual, setLmeManual]     = useState("");
  const [cambioManual, setCambioManual] = useState("");
  const [modoLme, setModoLme]         = useState("auto");    // auto | manual
  const [modoCambio, setModoCambio]   = useState("auto");

  const [produto, setProduto]         = useState("catodo");
  const [premioTipo, setPremioTipo]   = useState("usd");
  const [premioValor, setPremioValor] = useState("0");
  const [icms, setIcms]               = useState("12%");
  const [qtdKg, setQtdKg]             = useState("1000");

  const [resultado, setResultado]     = useState(null);
  const [historico, setHistorico]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("gbm_calc_hist") || "[]"); } catch { return []; }
  });

  // Busca LME usando lógica correta de semana de referência
  // Seg-qui: média S-1 | Sex em diante: média semana atual (fechamento)
  useEffect(() => {
    const fetchLME = async () => {
      setLoadingAuto(true);
      try {
        const r = await fetch("/api/lme");
        const d = await r.json();
        const sc = d.semanaCalc;
        if (sc) {
          setLmeAuto(sc.mediaLme);
          setCambioAuto(sc.mediaCambio);
          setSemanaRef(`${sc.periodo} · ${sc.diaSemanaHoje}`);
        } else {
          // Fallback: última linha disponível
          const ultima = d.ultima;
          if (ultima?.cobre) setLmeAuto(ultima.cobre);
          if (ultima?.dolar) setCambioAuto(ultima.dolar);
          setSemanaRef(d.mes || "");
        }
      } catch {}
      finally { setLoadingAuto(false); }
    };
    fetchLME();
  }, []);

  // Preenche prêmio e impostos padrão ao mudar produto
  useEffect(() => {
    const p = PRODUTOS.find(p => p.key === produto);
    if (!p) return;
    setPremioTipo(p.premioTipo || "usd");
    setPremioValor(String(p.premioUSD ?? 0));
    setIcms(p.grupo === 2 ? "Sem ICMS" : "12%");
  }, [produto]);

  const lmeEfetivo    = modoLme    === "auto" ? lmeAuto    : parseFloat(lmeManual)    || 0;
  const cambioEfetivo = modoCambio === "auto" ? cambioAuto : parseFloat(cambioManual) || 0;

  const calcularClick = () => {
    if (!lmeEfetivo || !cambioEfetivo) return;
    const res = calcular({ lme: lmeEfetivo, cambio: cambioEfetivo, produto, premioTipo, premioValor, icms });
    const produtoLabel = PRODUTOS.find(p => p.key === produto)?.label || produto;
    const entry = {
      ts: new Date().toISOString(),
      produto: produtoLabel,
      lme: lmeEfetivo,
      cambio: cambioEfetivo,
      premioTipo,
      premioValor,
      icms,
      qtdKg: parseFloat(qtdKg) || 0,
      ...res,
    };
    setResultado(entry);
    const hist = [entry, ...historico].slice(0, 20);
    setHistorico(hist);
    localStorage.setItem("gbm_calc_hist", JSON.stringify(hist));
  };

  const fmtR = (v) => v?.toLocaleString("pt-BR", { style:"currency", currency:"BRL", minimumFractionDigits:2, maximumFractionDigits:2 });
  const fmtN = (v, d=2) => v?.toLocaleString("pt-BR", { minimumFractionDigits:d, maximumFractionDigits:d });
  const fmtUS = (v) => v != null ? `US$ ${fmtN(v,2)}/t` : "—";

  const [tab, setTab] = useState("calc");

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,background:"#111318",borderRadius:8,overflow:"hidden",border:"1px solid rgba(100,116,139,0.2)"}}>
        {[["calc","Calculadora"],["hist",`Histórico (${historico.length})`]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:"10px 8px",background:tab===v?"#d97706":"transparent",color:tab===v?"#0a0c10":"#64748b",border:"none",cursor:"pointer",fontWeight:tab===v?700:400,fontSize:13,fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
            {l}
          </button>
        ))}
      </div>

      {tab === "calc" && (<>

        {/* Seção LME */}
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>LME Cobre (US$/t)</span>
            <div style={{display:"flex",gap:4}}>
              {["auto","manual"].map(m=>(
                <button key={m} onClick={()=>setModoLme(m)} style={{padding:"3px 8px",borderRadius:4,background:modoLme===m?"rgba(245,158,11,0.2)":"transparent",color:modoLme===m?"#f59e0b":"#475569",border:`1px solid ${modoLme===m?"rgba(245,158,11,0.4)":"#1e293b"}`,fontSize:10,cursor:"pointer",fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
                  {m==="auto"?"Automático S-1":"Manual"}
                </button>
              ))}
            </div>
          </div>
          <div style={{padding:"12px 14px"}}>
            {modoLme === "auto" ? (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  {loadingAuto ? (
                    <span style={{color:"#64748b",fontSize:13}}>Carregando...</span>
                  ) : (
                    <span style={{fontSize:24,fontWeight:700,color:"#f59e0b"}}>
                      {fmtN(lmeEfetivo, 2)}
                    </span>
                  )}
                  <div style={{fontSize:10,color:"#475569",marginTop:2}}>Média S-1 · {semanaRef}</div>
                </div>
              </div>
            ) : (
              <input value={lmeManual} onChange={e=>setLmeManual(e.target.value)}
                placeholder="Ex: 13.861,70" inputMode="decimal"
                style={{width:"100%",background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"10px 12px",fontSize:16,color:"#fff",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}
                onFocus={e=>e.target.style.borderColor="#f59e0b"} onBlur={e=>e.target.style.borderColor="#374151"}/>
            )}
          </div>
        </div>

        {/* Seção Câmbio */}
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:10,color:"#3b82f6",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>Câmbio (R$/US$)</span>
            <div style={{display:"flex",gap:4}}>
              {["auto","manual"].map(m=>(
                <button key={m} onClick={()=>setModoCambio(m)} style={{padding:"3px 8px",borderRadius:4,background:modoCambio===m?"rgba(59,130,246,0.2)":"transparent",color:modoCambio===m?"#3b82f6":"#475569",border:`1px solid ${modoCambio===m?"rgba(59,130,246,0.4)":"#1e293b"}`,fontSize:10,cursor:"pointer",fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
                  {m==="auto"?"Automático S-1":"Manual"}
                </button>
              ))}
            </div>
          </div>
          <div style={{padding:"12px 14px"}}>
            {modoCambio === "auto" ? (
              <div>
                {loadingAuto ? (
                  <span style={{color:"#64748b",fontSize:13}}>Carregando...</span>
                ) : (
                  <span style={{fontSize:24,fontWeight:700,color:"#3b82f6"}}>
                    R$ {fmtN(cambioEfetivo, 4)}
                  </span>
                )}
                <div style={{fontSize:10,color:"#475569",marginTop:2}}>Média S-1 · {semanaRef}</div>
              </div>
            ) : (
              <input value={cambioManual} onChange={e=>setCambioManual(e.target.value)}
                placeholder="Ex: 5,0362" inputMode="decimal"
                style={{width:"100%",background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"10px 12px",fontSize:16,color:"#fff",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}
                onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#374151"}/>
            )}
          </div>
        </div>

        {/* Preço base R$/kg */}
        {lmeEfetivo && cambioEfetivo && (
          <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700,marginBottom:2}}>Preço base em R$/Kg — Média S-1</div>
              <div style={{fontSize:26,fontWeight:700,color:"#10b981"}}>
                {fmtR((lmeEfetivo * cambioEfetivo) / 1000)}
              </div>
            </div>
            <div style={{fontSize:11,color:"#10b981",fontWeight:700}}>R$/kg</div>
          </div>
        )}

        {/* Produto + Prêmio */}
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
            <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>Produto e Prêmio</span>
          </div>
          <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

            {/* Produto — Grupo 1 */}
            <div>
              <div style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5,fontWeight:700}}>Lingotados e Laminados <span style={{color:"#334155",fontWeight:400}}>(ICMS + PIS/Cofins)</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                {PRODUTOS.filter(p=>p.grupo===1).map(p=>(
                  <button key={p.key} onClick={()=>setProduto(p.key)}
                    style={{padding:"8px 10px",borderRadius:6,background:produto===p.key?"rgba(245,158,11,0.15)":"#0d0f14",border:`1px solid ${produto===p.key?"rgba(245,158,11,0.5)":"#1e293b"}`,color:produto===p.key?"#f59e0b":"#64748b",fontSize:11,cursor:"pointer",fontFamily:"Georgia,serif",textAlign:"left",touchAction:"manipulation"}}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Produto — Grupo 2 */}
            <div>
              <div style={{fontSize:10,color:"#10b981",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5,fontWeight:700}}>Sucatas <span style={{color:"#334155",fontWeight:400}}>(somente ICMS · fator 0,8800)</span></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {PRODUTOS.filter(p=>p.grupo===2).map(p=>(
                  <button key={p.key} onClick={()=>setProduto(p.key)}
                    style={{padding:"8px 10px",borderRadius:6,background:produto===p.key?"rgba(16,185,129,0.15)":"#0d0f14",border:`1px solid ${produto===p.key?"rgba(16,185,129,0.5)":"#1e293b"}`,color:produto===p.key?"#10b981":"#64748b",fontSize:11,cursor:"pointer",fontFamily:"Georgia,serif",textAlign:"left",touchAction:"manipulation"}}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de prêmio */}
            <div>
              <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Tipo de Prêmio</div>
              <div style={{display:"flex",gap:6}}>
                {[["usd","US$/t"],["pct","%"]].map(([v,l])=>(
                  <button key={v} onClick={()=>{ setPremioTipo(v); if(v==="pct"){ const pr=PRODUTOS.find(p=>p.key===produto); setIcms(pr?.grupo===2?"Sem ICMS":"0%"); } }}
                    style={{flex:1,padding:"7px",borderRadius:6,background:premioTipo===v?"rgba(245,158,11,0.15)":"transparent",border:`1px solid ${premioTipo===v?"rgba(245,158,11,0.4)":"#1e293b"}`,color:premioTipo===v?"#f59e0b":"#475569",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Valor do prêmio */}
            <div>
              <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>
                Prêmio {premioTipo==="usd"?"(US$/t — negativo = desconto)":"(% sobre LME)"}
              </div>
              <input value={premioValor} onChange={e=>setPremioValor(e.target.value.replace(".",","))}
                placeholder={premioTipo==="usd"?"Ex: -280 ou +70":"Ex: -3 ou 2"}
                inputMode="decimal"
                style={{width:"100%",background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"10px 12px",fontSize:16,color:"#fff",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}
                onFocus={e=>e.target.style.borderColor="#f59e0b"} onBlur={e=>e.target.style.borderColor="#374151"}/>
            </div>
          </div>
        </div>

        {/* ICMS + Quantidade */}
        {(()=>{ const pr=PRODUTOS.find(p=>p.key===produto); const isG2=pr?.grupo===2; const fatoresAtivos=isG2?FATORES_G2:FATORES_G1; const taxLabel=isG2?"ICMS":"ICMS + PIS/Cofins"; return (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
              <span style={{fontSize:10,color:isG2?"#10b981":"#f59e0b",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>{taxLabel}</span>
            </div>
            <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:5}}>
              {Object.keys(fatoresAtivos).map(k=>(
                <button key={k} onClick={()=>setIcms(k)}
                  style={{padding:"6px 8px",borderRadius:5,background:icms===k?(isG2?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)"):"transparent",border:`1px solid ${icms===k?(isG2?"rgba(16,185,129,0.4)":"rgba(245,158,11,0.4)"):"#1e293b"}`,color:icms===k?(isG2?"#10b981":"#f59e0b"):"#64748b",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
                  {k} <span style={{fontSize:10,color:"#334155"}}>(fator {fatoresAtivos[k].toFixed(4)})</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
              <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Quantidade (kg)</span>
            </div>
            <div style={{padding:"10px 12px"}}>
              <input value={qtdKg} onChange={e=>setQtdKg(e.target.value)}
                placeholder="Ex: 1000" inputMode="numeric"
                style={{width:"100%",background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"10px 10px",fontSize:15,color:"#fff",outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}
                onFocus={e=>e.target.style.borderColor="#f59e0b"} onBlur={e=>e.target.style.borderColor="#374151"}/>
              <div style={{fontSize:10,color:"#334155",marginTop:4}}>
                {parseFloat(qtdKg)>=1000?`= ${(parseFloat(qtdKg)/1000).toFixed(2)} t`:""}
              </div>
            </div>
          </div>
        </div>
        ); })()}

        {/* Botão calcular */}
        <Btn onClick={calcularClick} disabled={!lmeEfetivo || !cambioEfetivo} full>
          Calcular Preço
        </Btn>

        {/* Resultado */}
        {resultado && (
          <div style={{background:"rgba(245,158,11,0.06)",border:"2px solid rgba(245,158,11,0.3)",borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(245,158,11,0.15)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <span style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em"}}>
                {resultado.produto} · {resultado.taxLabel||"ICMS"} {resultado.icms}
              </span>
              <button onClick={()=>{
                const tl = resultado.taxLabel||"ICMS";
                const txt = [
                  `*Cotação GBM Intelligence*`,
                  `Produto: ${resultado.produto}`,
                  `LME: US$ ${fmtN(resultado.lme,2)}/t`,
                  `Câmbio: R$ ${fmtN(resultado.cambio,4)}`,
                  "Prêmio: " + (resultado.premioTipo==="usd" ? "US$ "+resultado.premioValor+"/t" : resultado.premioValor+"%"),
                  ``,
                  `*Preço sem ${tl}: ${fmtR(resultado.precoRkgSem)}/kg*`,
                  `*Preço com ${tl} ${resultado.icms}: ${fmtR(resultado.precoRkgCom)}/kg*`,
                  resultado.qtdKg>0?`Valor total (${fmtN(resultado.qtdKg,0)}kg): ${fmtR(resultado.precoRkgCom*resultado.qtdKg)}`:"",
                ].filter(Boolean).join("\n");
                window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,"_blank");
              }} style={{background:"transparent",border:"1px solid rgba(245,158,11,0.3)",color:"#f59e0b",padding:"4px 10px",borderRadius:4,fontSize:11,cursor:"pointer",fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
                📲 WhatsApp
              </button>
            </div>
            <div style={{padding:"16px"}}>
              {/* Grid principal */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                {(()=>{ const tl=resultado.taxLabel||"ICMS"; return [
                  ["LME Líquido", fmtUS(resultado.lmeLiquido), "#64748b"],
                  ["Câmbio", `R$ ${fmtN(resultado.cambio,4)}`, "#3b82f6"],
                  [`R$/kg sem ${tl}`, fmtR(resultado.precoRkgSem), "#94a3b8"],
                  [`${tl} ${resultado.icms}`, fmtR(resultado.taxValor??resultado.icmsValor), "#ef4444"],
                ]; })().map(([l,v,cor])=>(
                  <div key={l} style={{background:"#0d0f14",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:600,color:cor}}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Destaque preço final */}
              <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"14px 16px",marginBottom:12}}>
                <div style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>Preço com {resultado.taxLabel||"ICMS"} {resultado.icms}</div>
                <div style={{fontSize:32,fontWeight:700,color:"#f59e0b",lineHeight:1}}>
                  {fmtR(resultado.precoRkgCom)}<span style={{fontSize:14,color:"#64748b",fontWeight:400}}>/kg</span>
                </div>
              </div>

              {/* Total se quantidade informada */}
              {resultado.qtdKg > 0 && (
                <div style={{background:"#0d0f14",borderRadius:8,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>Total · {fmtN(resultado.qtdKg,0)} kg</div>
                    <div style={{fontSize:10,color:"#334155",marginTop:2}}>com {resultado.taxLabel||"ICMS"} {resultado.icms}</div>
                  </div>
                  <div style={{fontSize:18,fontWeight:700,color:"#ffffff"}}>
                    {resultado.precoRkgCom && resultado.qtdKg
                      ? (resultado.precoRkgCom * resultado.qtdKg).toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2})
                      : "—"}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>)}

      {/* Histórico */}
      {tab === "hist" && (
        <div>
          {historico.length === 0 ? (
            <div style={{textAlign:"center",padding:"50px 0",color:"#334155"}}>
              <div style={{fontSize:40,marginBottom:8}}>🧮</div>
              <div style={{fontSize:13,color:"#64748b"}}>Nenhum cálculo realizado ainda</div>
            </div>
          ) : (
            <>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
                <Btn variant="ghost" small onClick={()=>{setHistorico([]);localStorage.removeItem("gbm_calc_hist");}}>Limpar</Btn>
              </div>
              {historico.map((h,i)=>(
                <div key={i} style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:8,padding:"12px 14px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontSize:13,color:"#ffffff",fontWeight:600}}>{h.produto}</div>
                      <div style={{fontSize:10,color:"#475569",marginTop:2}}>
                        LME: US$ {fmtN(h.lme,2)} · Câmbio: R$ {fmtN(h.cambio,4)} · {h.taxLabel||"ICMS"}: {h.icms}
                      </div>
                      <div style={{fontSize:10,color:"#334155",marginTop:1}}>
                        {new Date(h.ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:16,fontWeight:700,color:"#f59e0b"}}>{fmtR(h.precoRkgCom)}/kg</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{fmtR(h.precoRkgSem)}/kg sem {h.taxLabel||"ICMS"}</div>
                    </div>
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


// ─── MÓDULO 4: NOTÍCIAS DO MERCADO DE COBRE ──────────────────────────────────
function NewsModule({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [cambio, setCambio]   = useState(null);

  const cacheKey = `gbm_news_${new Date().toDateString()}`;

  const fetchCambio = async () => {
    try {
      const r = await fetch("/api/cambio");
      if (r.ok) setCambio(await r.json());
    } catch {}
  };

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

  useEffect(() => { fetchNews(); fetchCambio(); }, []);

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

  const CambioCard = () => cambio ? (
    <div style={{background:"#111318",border:"1px solid rgba(59,130,246,0.3)",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700,marginBottom:2}}>💵 Dólar — PTAX Banco Central</div>
        <div style={{fontSize:22,fontWeight:700,color:"#3b82f6"}}>R$ {cambio.venda?.toFixed(4)}</div>
        <div style={{fontSize:10,color:"#475569",marginTop:2}}>
          Compra: R$ {cambio.compra?.toFixed(4)} · {new Date(cambio.dataHora).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"})}
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        {cambio.cached && <div style={{fontSize:9,color:"#475569"}}>📦 cache</div>}
        <div style={{fontSize:9,color:"#334155",marginTop:4}}>Fonte oficial BCB</div>
      </div>
    </div>
  ) : null;

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <CambioCard/>
      <div style={{textAlign:"center",padding:40}}>
        <Spinner/>
        <div style={{fontSize:12,color:"#64748b",marginTop:12}}>Pesquisando notícias e gerando análise com IA...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <CambioCard/>
      <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:14,borderRadius:8,fontSize:13}}>⚠ {error}</div>
      <Btn onClick={()=>fetchNews(true)}>Tentar novamente</Btn>
    </div>
  );

  if (!data) return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <CambioCard/>
      <div style={{textAlign:"center",padding:40}}>
        <Btn onClick={()=>fetchNews()}>Carregar Notícias</Btn>
      </div>
    </div>
  );

  const s = sentimentoConfig[data.sentimento] || sentimentoConfig.neutro;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Cotação Dólar BCB */}
      <CambioCard/>

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
          "_GBM Intelligence_",
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
  const [showMeusDados, setShowMeusDados] = useState(false);
  const [authScreen, setAuthScreen] = useState("login"); // login | register
  const [adminSecret, setAdminSecret] = useState(null);

  const handleLogin = (u) => { setUser(u); localStorage.setItem("gbm_user",JSON.stringify(u)); };
  const handleLogout = () => { setUser(null); localStorage.removeItem("gbm_user"); };

  // Painel master
  if (adminSecret) return <AdminPanel secret={adminSecret} onExit={()=>setAdminSecret(null)}/>;

  // Autenticação
  if (!user) {
    if (authScreen === "register") return <RegisterPage onGoLogin={()=>setAuthScreen("login")}/>;
    return <LoginPage onLogin={handleLogin} onGoRegister={()=>setAuthScreen("register")} onAdmin={(s)=>setAdminSecret(s)}/>;
  }

  const plan = PLANS[user.plan] || PLANS.free;
  const modulosLiberados = MODULES.filter(m => podeAcessar(user.plan, m.id));
  // Se o módulo atual não é permitido para o plano, volta ao LME
  const moduloAtivo = podeAcessar(user.plan, module) ? module : "lme";

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Georgia,serif",paddingBottom:80}}>
      {showMeusDados && <ModalMeusDados onClose={()=>setShowMeusDados(false)}/>}
      {/* Header */}
      <div style={{background:C.bg2,borderBottom:`1px solid rgba(245,158,11,0.15)`,position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.2em",textTransform:"uppercase",lineHeight:1}}>GBM</div>
            <div style={{fontSize:18,fontWeight:700,color:C.amber,letterSpacing:"-0.02em",lineHeight:1.1}}>Intelligence</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Badge label={plan.label} color={plan.color}/>
            <button onClick={()=>setShowMeusDados(true)} title="LGPD — Meus Dados"
              style={{background:"transparent",border:"1px solid rgba(100,116,139,0.3)",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:13,color:C.muted,touchAction:"manipulation"}}>
              🔒
            </button>
            <Btn small variant="ghost" onClick={handleLogout}>Sair</Btn>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:680,margin:"0 auto",padding:"16px 16px 0"}}>
        {moduloAtivo==="lme"    && <LMEModule user={user}/>}
        {moduloAtivo==="calc"   && <CalculatorModule user={user}/>}
        {moduloAtivo==="cnpj"   && <CNPJModule user={user}/>}
        {moduloAtivo==="credit" && <CreditModule user={user}/>}
        {moduloAtivo==="news"   && <NewsModule user={user}/>}
      </div>

      {/* Bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.bg2,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:50}}>
        {modulosLiberados.map(m=>(
          <button key={m.id} onClick={()=>setModule(m.id)} style={{flex:1,padding:"10px 4px 8px",background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>
            <span style={{fontSize:20}}>{m.icon}</span>
            <span style={{fontSize:9,color:moduloAtivo===m.id?C.amber:C.muted,fontWeight:moduloAtivo===m.id?700:400,textTransform:"uppercase",letterSpacing:"0.05em"}}>{m.label.split(" ")[0]}</span>
            {moduloAtivo===m.id && <div style={{width:20,height:2,background:C.amber,borderRadius:1}}/>}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── MÓDULO 5: CRÉDITO ────────────────────────────────────────────────────────
// ─── MÓDULO 5: CRÉDITO ────────────────────────────────────────────────────────
// ─── MÓDULO: PROSPECÇÕES ─────────────────────────────────────────────────────
// ─── MÓDULO: LUSHA ───────────────────────────────────────────────────────────
function LushaModule({ user, razaoSocial }) {
  const [busca, setBusca]           = useState(razaoSocial || "");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [empresa, setEmpresa]       = useState(null);
  const [decisores, setDecisores]   = useState(null);
  const [enriched, setEnriched]     = useState({});
  const [loadingEnrich, setLoadingEnrich] = useState({});
  const [subTab, setSubTab]         = useState("decisores");
  const [filtroDepto, setFiltroDepto] = useState("");
  const [filtroCargo, setFiltroCargo] = useState("");
  const [contatos, setContatos]     = useState(null);
  const [loadingCont, setLoadingCont] = useState(false);

  const isPro      = user?.plan === "pro";
  const isBusiness = user?.plan === "business";
  const [creditos, setCreditos] = useState(null); // saldo de consultas (Business); null = ilimitado/desconhecido
  const [esgotado, setEsgotado] = useState(false);

  // Consulta o saldo de créditos ao abrir (apenas Business)
  useEffect(() => {
    if (!isBusiness || !user?.id) return;
    (async () => {
      try {
        const r = await fetch("/api/prosp-credits?acao=check", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: user.id }) });
        const d = await r.json();
        if (r.ok) { setCreditos(d.saldo); setEsgotado((d.saldo ?? 0) <= 0); }
      } catch {}
    })();
  }, []);

  // Auto-busca quando recebe razaoSocial
  useEffect(() => {
    if (razaoSocial && !empresa) {
      setBusca(razaoSocial);
      buscarEmpresa(razaoSocial);
    }
  }, [razaoSocial]);

  const buscarEmpresa = async (nome) => {
    const q = (nome || busca).trim();
    if (!q) return;
    // Consome 1 crédito semanal (apenas Business; Pró é ilimitado)
    if (isBusiness) {
      try {
        const rc = await fetch("/api/prosp-credits?acao=consume", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: user.id }) });
        const dc = await rc.json();
        if (!rc.ok || dc.ok === false || dc.esgotado) {
          setEsgotado(true); setCreditos(0);
          setError("Seus créditos semanais de Prospecção Avançada acabaram. Novos créditos toda segunda-feira (saldo acumula).");
          return;
        }
        setCreditos(dc.saldo); setEsgotado((dc.saldo ?? 0) <= 0);
      } catch {
        setError("Não foi possível validar seus créditos agora. Tente novamente.");
        return;
      }
    }
    setLoading(true); setError(""); setEmpresa(null); setDecisores(null); setContatos(null);
    try {
      const r = await fetch(`/api/lusha?acao=empresa&nome=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro na busca");
      setEmpresa(d.dados);
      const comp = d.dados?.results?.[0] || d.dados?.companies?.[0] || d.dados?.data?.[0];
      if (comp) {
        const dom = (comp.domain||"").replace(/\[.*?\]\(.*?\)/g,"").replace(/https?:\/\//g,"").replace(/^www\./,"").trim();
        buscarDecisores(dom || comp.alternativeDomains?.[0], comp.id || comp.companyId, comp.name || comp.companyName);
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const buscarDecisores = async (dominio, companyId, nomeEmpresa) => {
    try {
      const params = []; if (nomeEmpresa) params.push(`companyName=${encodeURIComponent(nomeEmpresa)}`); if (dominio) params.push(`companyDomain=${encodeURIComponent(dominio)}`);
      const r = await fetch(`/api/lusha?acao=decisores&${params.join("&")}`);
      const d = await r.json();
      if (r.ok) setDecisores(d.dados);
    } catch {}
  };

  const buscarContatos = async () => {
    const q = busca.trim();
    if (!q) return;
    setLoadingCont(true);
    try {
      let params = `companyNames=${encodeURIComponent(q)}`;
      if (filtroDepto) params += `&departments=${encodeURIComponent(filtroDepto)}`;
      if (filtroCargo) params += `&jobTitles=${encodeURIComponent(filtroCargo)}`;
      const r = await fetch(`/api/lusha?acao=contatos&${params}`);
      const d = await r.json();
      if (r.ok) setContatos(d.dados);
    } catch {}
    finally { setLoadingCont(false); }
  };

  const enrichContato = async (contactId) => {
    if (enriched[contactId] || loadingEnrich[contactId]) return;
    setLoadingEnrich(p => ({...p, [contactId]: true}));
    try {
      const r = await fetch(`/api/lusha?acao=enrich&contactId=${contactId}`);
      const d = await r.json();
      if (r.ok) {
        const ct = d.dados?.results?.[0] || d.dados?.contacts?.[0] || d.dados?.data?.[0] || {};
        setEnriched(p => ({...p, [contactId]: ct}));
      }
    } catch {}
    finally { setLoadingEnrich(p => ({...p, [contactId]: false})); }
  };

  const shareWpp = (ct) => {
    const enr = enriched[ct?.id||ct?.contactId] || {};
    const em = enr?.emails?.[0]?.email || ct?.emails?.[0]?.email || "";
    const ph = enr?.phones?.[0]?.internationalNumber || enr?.phones?.[0]?.number || ct?.phones?.[0]?.internationalNumber || ct?.phones?.[0]?.number || "";
    const jobTitleStr = ct?.jobTitle?.title || (typeof ct?.jobTitle === "string" ? ct.jobTitle : "") || ct?.title || "";
    const companyStr = ct?.company?.name || ct?.companyName || "";
    const linkedinStr = ct?.socialLinks?.linkedin || ct?.linkedinUrl || "";
    const txt = [
      "*" + (ct?.firstName||"") + " " + (ct?.lastName||ct?.fullName||"") + "*",
      jobTitleStr ? "Cargo: " + jobTitleStr : "",
      companyStr ? "Empresa: " + companyStr : "",
      em ? "Email: " + em : "",
      ph ? "Tel: " + ph : "",
      linkedinStr ? "LinkedIn: " + linkedinStr : "",
      "_GBM Intelligence_",
    ].filter(Boolean).join("\n");
    window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
  };

  const ContatoCard = ({ ct }) => {
    const id = ct?.id || ct?.contactId;
    const enr = enriched[id];
    const emails = enr?.emails || ct?.emails || [];
    const phones = enr?.phones || ct?.phones || [];
    const jobTitleStr = ct?.jobTitle?.title || (typeof ct?.jobTitle === "string" ? ct.jobTitle : "") || ct?.title || "—";
    const companyStr = ct?.company?.name || ct?.companyName || "";
    const locationStr = ct?.location
      ? (typeof ct.location === "string" ? ct.location : [ct.location.city, ct.location.state, ct.location.country].filter(Boolean).join(", "))
      : "";
    const linkedinStr = ct?.socialLinks?.linkedin || ct?.linkedinUrl || "";
    return (
      <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(30,41,59,0.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{ct?.firstName||""} {ct?.lastName||ct?.fullName||""}</div>
            <div style={{fontSize:11,color:"#f59e0b",marginTop:2}}>{jobTitleStr}</div>
            {companyStr && <div style={{fontSize:11,color:"#64748b",marginTop:1}}>{companyStr}</div>}
            {locationStr && <div style={{fontSize:10,color:"#475569",marginTop:1}}>📍 {locationStr}</div>}
            {emails.length>0 && <div style={{marginTop:5}}>{emails.map((e,i)=><div key={i} style={{fontSize:11,color:"#3b82f6"}}>✉ {e.email||e}</div>)}</div>}
            {phones.length>0 && <div style={{marginTop:3}}>{phones.map((p,i)=><div key={i} style={{fontSize:11,color:"#10b981"}}>📞 {p.internationalNumber||p.number||p}</div>)}</div>}
            {linkedinStr && <a href={linkedinStr} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:5,fontSize:10,color:"#0a66c2",textDecoration:"none",border:"1px solid #0a66c233",borderRadius:4,padding:"2px 8px"}}>💼 LinkedIn</a>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
            {id && !enr && (
              <button onClick={()=>enrichContato(id)} disabled={loadingEnrich[id]}
                style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",color:"#f59e0b",padding:"5px 10px",borderRadius:4,fontSize:10,cursor:"pointer",touchAction:"manipulation"}}>
                {loadingEnrich[id] ? "..." : "📧 Revelar"}
              </button>
            )}
            <button onClick={()=>shareWpp(ct)}
              style={{background:"transparent",border:"1px solid rgba(37,211,102,0.3)",color:"#25D366",padding:"5px 10px",borderRadius:4,fontSize:10,cursor:"pointer",touchAction:"manipulation"}}>
              📲 WPP
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Extrai dados da empresa
  const comp = empresa?.results?.[0] || empresa?.companies?.[0] || empresa?.data?.[0] || null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Aviso LGPD */}
      <div style={{background:"rgba(100,116,139,0.06)",border:"1px solid rgba(100,116,139,0.2)",borderRadius:8,padding:"8px 12px",display:"flex",gap:8,alignItems:"flex-start"}}>
        <span style={{fontSize:14,flexShrink:0}}>🔒</span>
        <span style={{fontSize:10,color:C.muted,lineHeight:1.6}}>
          Os dados de contatos exibidos são de natureza profissional/corporativa, tratados com base no legítimo interesse para fins de prospecção B2B (art. 7º, IX, LGPD). Use exclusivamente para atividades comerciais lícitas.
        </span>
      </div>

      {/* Saldo de créditos / plano */}
      {isBusiness && (
        <div style={{background:esgotado?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.08)",border:`1px solid ${esgotado?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.3)"}`,borderRadius:8,padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <span style={{fontSize:11,color:esgotado?"#fca5a5":"#6ee7b7",fontWeight:600}}>
            {esgotado ? "Créditos esgotados nesta semana" : `Consultas disponíveis: ${creditos ?? "…"}`}
          </span>
          <span style={{fontSize:10,color:C.muted}}>10/semana · renova segunda · acumulativo</span>
        </div>
      )}
      {isPro && (
        <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"9px 14px",fontSize:11,color:"#f59e0b",fontWeight:600}}>
          Plano Pró · Prospecção Avançada ilimitada
        </div>
      )}

      {/* Busca */}
      <div style={{background:"#111318",border:"1px solid rgba(138,75,250,0.2)",borderRadius:10,overflow:"hidden",opacity:esgotado?0.6:1}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
          <span style={{fontSize:10,color:"#8a4bfa",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>🔍 Prospecção Avançada</span>
        </div>
        <div style={{padding:"12px 14px",display:"flex",gap:8}}>
          <input value={busca} onChange={e=>setBusca(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&buscarEmpresa()}
            placeholder="Nome da empresa ou domínio"
            style={{flex:1,background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"10px 12px",fontSize:14,color:"#fff",outline:"none"}}
            onFocus={e=>e.target.style.borderColor="#8a4bfa"} onBlur={e=>e.target.style.borderColor="#374151"}/>
          <Btn onClick={()=>buscarEmpresa()} disabled={loading}>Buscar</Btn>
        </div>
      </div>

      {loading && <div style={{textAlign:"center",padding:20}}><Spinner/><div style={{fontSize:12,color:"#64748b",marginTop:8}}>Buscando contatos...</div></div>}
      {error && <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"10px 14px",borderRadius:8,fontSize:13}}>⚠ {error}</div>}

      {/* Card empresa Lusha */}
      {comp && (
        <div style={{background:"#111318",border:"1px solid rgba(138,75,250,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
            <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>{comp.name||comp.companyName||"—"}</div>
            {comp.domain && (() => { const d = (comp.domain||"").replace(/\[.*?\]\(.*?\)/g,"").replace(/https?:\/\//g,"").replace(/^www\./,"").trim(); return d ? <a href={`https://${d}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#8a4bfa",textDecoration:"none"}}>{d} →</a> : null; })()}
          </div>
          <div style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              ["🏢", "Setor", comp.industry || comp.subIndustry || "—"],
              ["👥", "Funcionários", comp.employeeCount?.min && comp.employeeCount?.max ? `${comp.employeeCount.min.toLocaleString()}-${comp.employeeCount.max.toLocaleString()}` : (comp.employeeCount?.exact || "—")],
              ["💰", "Receita", comp.revenue || "—"],
              ["📍", "Local", [comp.location?.city, comp.location?.state, comp.location?.country].filter(Boolean).join(", ") || "—"],
              ["🏷️", "Tipo", comp.companyType || comp.type || "—"],
              ["📅", "Fundada", comp.foundedYear || "—"],
            ].map(([icon, label, val]) => (
              <div key={label}>
                <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em"}}>{icon} {label}</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{val}</div>
              </div>
            ))}
          </div>
          {comp.description && (
            <div style={{padding:"0 14px 12px",fontSize:11,color:"#475569",lineHeight:1.5}}>{comp.description.slice(0, 200)}{comp.description.length>200?"...":""}</div>
          )}
          {/* Social links */}
          <div style={{padding:"0 14px 12px",display:"flex",gap:6,flexWrap:"wrap"}}>
            {(comp.socialLinks?.linkedin||comp.linkedinUrl) && <a href={comp.socialLinks?.linkedin||comp.linkedinUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#0a66c2",border:"1px solid #0a66c233",borderRadius:4,padding:"3px 8px",textDecoration:"none"}}>💼 LinkedIn</a>}
            {(comp.socialLinks?.facebook||comp.facebookUrl) && <a href={comp.socialLinks?.facebook||comp.facebookUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#1877f2",border:"1px solid #1877f233",borderRadius:4,padding:"3px 8px",textDecoration:"none"}}>📘 Facebook</a>}
            {(comp.socialLinks?.twitter||comp.twitterUrl) && <a href={comp.socialLinks?.twitter||comp.twitterUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#1da1f2",border:"1px solid #1da1f233",borderRadius:4,padding:"3px 8px",textDecoration:"none"}}>🐦 Twitter</a>}
          </div>
        </div>
      )}

      {/* Tabs: Decisores | Contatos */}
      {comp && (
        <div style={{display:"flex",gap:0,background:"#111318",borderRadius:8,overflow:"hidden",border:"1px solid rgba(100,116,139,0.2)"}}>
          {[["decisores","Decisores"],["contatos","Buscar Contatos"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSubTab(v)} style={{flex:1,padding:"9px 8px",background:subTab===v?"#8a4bfa":"transparent",color:subTab===v?"#fff":"#64748b",border:"none",cursor:"pointer",fontSize:12,fontWeight:subTab===v?700:400,fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Lista de decisores */}
      {subTab==="decisores" && decisores && (
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
            <span style={{fontSize:10,color:"#8a4bfa",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>
              Decisores — {(decisores?.results||decisores?.contacts||decisores?.data||[]).length} contato(s)
            </span>
          </div>
          {(decisores?.results||decisores?.contacts||decisores?.data||[]).map((ct,i) => <ContatoCard key={i} ct={ct}/>)}
          {(decisores?.results||decisores?.contacts||decisores?.data||[]).length===0 && (
            <div style={{padding:20,textAlign:"center",color:"#475569",fontSize:13}}>Nenhum decisor encontrado para esta empresa</div>
          )}
        </div>
      )}

      {/* Busca de contatos por filtros */}
      {subTab==="contatos" && comp && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
              <span style={{fontSize:10,color:"#8a4bfa",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>Filtros</span>
            </div>
            <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
              <div>
                <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>Departamento</div>
                <select value={filtroDepto} onChange={e=>setFiltroDepto(e.target.value)}
                  style={{width:"100%",background:"#1e2230",border:"1px solid #374151",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#fff",outline:"none"}}>
                  <option value="">Todos</option>
                  {["Purchasing","Operations","Engineering","Management","Finance","Sales","Marketing","HR","IT","Legal"].map(d=>(
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>Cargo (ex: Director, Manager, VP)</div>
                <input value={filtroCargo} onChange={e=>setFiltroCargo(e.target.value)}
                  placeholder="Ex: Purchasing Manager"
                  style={{width:"100%",background:"#1e2230",border:"1px solid #374151",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#fff",outline:"none"}}/>
              </div>
              <Btn onClick={buscarContatos} disabled={loadingCont} small>
                {loadingCont ? "Buscando..." : "Buscar Contatos"}
              </Btn>
            </div>
          </div>

          {contatos && (
            <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
                <span style={{fontSize:10,color:"#8a4bfa",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>
                  {(contatos?.results||contatos?.contacts||contatos?.data||[]).length} contato(s) encontrado(s)
                </span>
              </div>
              {(contatos?.results||contatos?.contacts||contatos?.data||[]).map((ct,i) => <ContatoCard key={i} ct={ct}/>)}
              {(contatos?.results||contatos?.contacts||contatos?.data||[]).length===0 && (
                <div style={{padding:20,textAlign:"center",color:"#475569",fontSize:13}}>Nenhum contato encontrado com esses filtros</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function ProspeccoesModule({ user, cnpjData }) {
  const [cnaeInput, setCnaeInput] = useState("");
  const [loading, setLoading]     = useState(false);
  const [resultado, setResultado] = useState(null);
  const [pagina, setPagina]       = useState(1);
  const [error, setError]         = useState("");
  const [cnaeAtivo, setCnaeAtivo] = useState(null);

  const cnaesPrincipal = cnpjData?.atividadePrincipal
    ? [{ codigo: (cnpjData.atividadePrincipal.id||cnpjData.atividadePrincipal.subclasse||"").replace(/[^0-9]/g,""), descricao: cnpjData.atividadePrincipal.descricao||"" }]
    : [];
  const cnaesSecundarios = (cnpjData?.atividadesSecundarias||[]).map(a=>({
    codigo: (a.id||a.subclasse||"").replace(/[^0-9]/g,""), descricao: a.descricao||"",
  }));
  const todosOsCnaes = [...cnaesPrincipal, ...cnaesSecundarios].filter(c=>c.codigo&&c.codigo.length>=4);

  const buscar = async (cnae, pag=1) => {
    const cnaeClean = (cnae||cnaeInput).replace(/[^0-9]/g,"");
    if (!cnaeClean || cnaeClean.length < 4) return;
    setLoading(true); setError(""); if (pag===1) setResultado(null);
    try {
      const r = await fetch(`/api/prospeccao?cnae=${cnaeClean}&pagina=${pag}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error||`Erro ${r.status}`);
      setResultado(prev => {
        if (pag === 1) return d;
        // Deduplica por CNPJ ao carregar mais páginas
        const existentes = new Set((prev?.empresas||[]).map(e=>e.cnpj));
        const novas = (d.empresas||[]).filter(e=>!existentes.has(e.cnpj));
        // Mantém o total original e acumula empresas
        return {...prev, empresas:[...(prev?.empresas||[]), ...novas], pagina: pag};
      });
      setPagina(pag);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const [jaInicializou, setJaInicializou] = useState(false);
  useEffect(() => {
    if (todosOsCnaes.length > 0 && !jaInicializou) {
      const principal = todosOsCnaes[0];
      setJaInicializou(true);
      setCnaeAtivo(principal);
      setCnaeInput(principal.codigo);
      buscar(principal.codigo, 1);
    }
  }, [cnpjData, jaInicializou]);

  // ── Exportar Excel (busca todas as páginas) ──
  const [exportando, setExportando] = useState(false);
  const [progresso, setProgresso]   = useState("");
  const [filtroCapital, setFiltroCapital] = useState("todos");

  const FAIXAS_CAPITAL = {
    todos:   { label: "Todas as empresas",            min: 0,        max: Infinity },
    f1:      { label: "R$ 100 mil a R$ 499 mil",      min: 100000,   max: 499999 },
    f2:      { label: "R$ 500 mil a R$ 999 mil",      min: 500000,   max: 999999 },
    f3:      { label: "R$ 1 mi a R$ 4,99 mi",         min: 1000000,  max: 4999999 },
    f4:      { label: "R$ 5 mi ou mais",              min: 5000000,  max: Infinity },
    f1m:     { label: "R$ 1 milhão ou mais",          min: 1000000,  max: Infinity },
  };

  const carregarSheetJS = () => new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const exportarExcel = async () => {
    if (!resultado?.cnae) return;
    const total = resultado.total || 0;
    const totalPaginas = Math.ceil(total / 20);

    // Limite de segurança — evita estourar créditos
    const LIMITE_PAGINAS = 50; // 1000 empresas
    const paginasABuscar = Math.min(totalPaginas, LIMITE_PAGINAS);

    if (totalPaginas > LIMITE_PAGINAS) {
      const ok = window.confirm(`Esta busca tem ${total.toLocaleString("pt-BR")} empresas. Por segurança, serão exportadas as primeiras ${LIMITE_PAGINAS*20} (${LIMITE_PAGINAS} páginas). Continuar?`);
      if (!ok) return;
    }

    setExportando(true); setProgresso("Iniciando...");
    try {
      const XLSX = await carregarSheetJS();
      let todas = [];

      for (let p = 1; p <= paginasABuscar; p++) {
        setProgresso(`Buscando página ${p} de ${paginasABuscar}...`);
        const r = await fetch(`/api/prospeccao?cnae=${resultado.cnae}&pagina=${p}`);
        const d = await r.json();
        if (d.empresas) todas = [...todas, ...d.empresas];
        if (!d.empresas || d.empresas.length === 0) break;
      }

      // Aplica filtro de capital social
      const faixa = FAIXAS_CAPITAL[filtroCapital];
      const filtradas = todas.filter(e => {
        const cap = e.capitalSocial || 0;
        return cap >= faixa.min && cap <= faixa.max;
      });

      if (filtradas.length === 0) {
        alert(`Nenhuma empresa encontrada na faixa "${faixa.label}".`);
        setExportando(false); setProgresso("");
        return;
      }

      setProgresso(`Gerando Excel com ${filtradas.length} empresas (${faixa.label})...`);

      // Monta dados da planilha
      const dados = filtradas.map(e => ({
        "Razão Social": e.razaoSocial || "",
        "Nome Fantasia": e.nomeFantasia || "",
        "CNPJ": fmtCNPJ(e.cnpj || ""),
        "Situação": e.situacao || "",
        "Capital Social": e.capitalSocial || 0,
        "Porte": e.porte || "",
        "Cidade": e.cidade || "",
        "UF": e.uf || "",
        "CEP": e.cep || "",
        "Bairro": e.bairro || "",
        "Endereço": e.logradouro || "",
        "Telefone": e.telefone ? fmtPhone(e.telefone) : "",
        "E-mail": e.email || "",
        "Sócio Principal": e.socio || "",
        "Qualificação Sócio": e.socioQualificacao || "",
        "Data Abertura": e.dataAbertura ? fmtDate(e.dataAbertura) : "",
        "CNAE": e.cnae || "",
        "Atividade": e.cnaeDesc || "",
        "Natureza Jurídica": e.naturezaJuridica || "",
      }));

      const ws = XLSX.utils.json_to_sheet(dados);
      // Largura das colunas
      ws["!cols"] = [
        {wch:40},{wch:25},{wch:20},{wch:12},{wch:15},{wch:18},{wch:20},{wch:5},
        {wch:12},{wch:18},{wch:35},{wch:18},{wch:30},{wch:30},{wch:22},{wch:14},{wch:12},{wch:40},{wch:30}
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `CNAE ${resultado.cnae}`);

      const hoje = new Date().toISOString().split("T")[0];
      const sufixoFaixa = filtroCapital === "todos" ? "" : `_${filtroCapital}`;
      XLSX.writeFile(wb, `GBM_Prospeccao_CNAE_${resultado.cnae}${sufixoFaixa}_${hoje}.xlsx`);

      setProgresso("");
    } catch(e) {
      alert("Erro ao exportar: " + e.message);
    } finally {
      setExportando(false); setProgresso("");
    }
  };

  const fmtCNPJ  = (v="") => v.replace(/[^0-9]/g,"").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");
  const fmtMoney = (v) => v ? parseFloat(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:0}) : "—";
  const fmtDate  = (v) => { if(!v)return"—"; if(/^\d{4}-\d{2}-\d{2}/.test(v)){const[y,m,d]=v.split("T")[0].split("-");return`${d}/${m}/${y}`;}return v; };
  const fmtPhone = (v="") => { const d=v.replace(/[^0-9]/g,""); if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return v||"—"; };

  const shareWpp = (e) => {
    const txt = ["*"+e.razaoSocial+"*","CNPJ: "+fmtCNPJ(e.cnpj),e.cidade?"Cidade: "+e.cidade+"/"+(e.uf||""):"",e.telefone?"Tel: "+fmtPhone(e.telefone):"",e.email?"Email: "+e.email:"",e.capitalSocial?"Capital: "+fmtMoney(e.capitalSocial):"",e.socio?"Sócio: "+e.socio:"","_GBM Intelligence_"].filter(Boolean).join("\n");
    window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");
  };

  // Ordena por capital social (maior primeiro)
  const empresasOrdenadas = resultado?.empresas
    ? Array.from(new Map(resultado.empresas.map(e=>[e.cnpj,e])).values()).sort((a,b)=>(b.capitalSocial||0)-(a.capitalSocial||0))
    : [];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Busca por CNAE */}
      <div style={{background:"#111318",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
          <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700}}>Buscar por CNAE</span>
        </div>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          {todosOsCnaes.length>0 && (
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>CNAEs da empresa consultada</div>
              {todosOsCnaes.map((c,i)=>(
                <button key={i} onClick={()=>{ setCnaeAtivo(c); setCnaeInput(c.codigo); buscar(c.codigo,1); }}
                  style={{background:cnaeAtivo?.codigo===c.codigo?"rgba(245,158,11,0.15)":"#0d0f14",border:`1px solid ${cnaeAtivo?.codigo===c.codigo?"rgba(245,158,11,0.4)":"#1e293b"}`,borderRadius:6,padding:"8px 12px",cursor:"pointer",textAlign:"left",touchAction:"manipulation"}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#f59e0b",fontWeight:700,fontFamily:"monospace"}}>{c.codigo}</span>
                    {i===0&&<span style={{fontSize:9,color:"#475569",background:"#1e293b",padding:"1px 5px",borderRadius:3}}>Principal</span>}
                  </div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{c.descricao}</div>
                </button>
              ))}
            </div>
          )}
          <div>
            <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Ou buscar outro CNAE</div>
            <div style={{display:"flex",gap:8}}>
              <input value={cnaeInput} onChange={e=>setCnaeInput(e.target.value.replace(/[^0-9]/g,"").slice(0,7))}
                onKeyDown={e=>e.key==="Enter"&&buscar(cnaeInput,1)}
                placeholder="Ex: 2443100" inputMode="numeric" maxLength={7}
                style={{flex:1,background:"#1e2230",border:"2px solid #374151",borderRadius:8,padding:"10px 12px",fontSize:15,color:"#fff",outline:"none",fontFamily:"monospace"}}
                onFocus={e=>e.target.style.borderColor="#f59e0b"} onBlur={e=>e.target.style.borderColor="#374151"}/>
              <Btn onClick={()=>buscar(cnaeInput,1)} disabled={loading||cnaeInput.length<4}>Buscar</Btn>
            </div>
          </div>
        </div>
      </div>

      {loading && <div style={{textAlign:"center",padding:20}}><Spinner/><div style={{fontSize:12,color:"#64748b",marginTop:8}}>Buscando empresas ativas...</div></div>}
      {error && <div style={{background:"rgba(127,29,29,0.4)",border:"1px solid rgba(248,113,113,0.3)",color:"#fca5a5",padding:"10px 14px",borderRadius:8,fontSize:13}}>⚠ {error}</div>}

      {resultado && (
        <div style={{background:"#111318",border:"1px solid rgba(100,116,139,0.2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(100,116,139,0.12)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6,marginBottom:8}}>
              <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>
                {resultado.total?.toLocaleString("pt-BR")||resultado.empresas?.length} empresas · CNAE {resultado.cnae}
              </span>
              <span style={{fontSize:10,color:"#334155"}}>Ordenado por capital</span>
            </div>
            {/* Filtro de capital + Exportar */}
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <select value={filtroCapital} onChange={e=>setFiltroCapital(e.target.value)}
                style={{flex:1,minWidth:160,background:"#1e2230",border:"1px solid #374151",borderRadius:6,padding:"7px 10px",fontSize:11,color:"#fff",outline:"none",fontFamily:"Georgia,serif"}}>
                {Object.entries(FAIXAS_CAPITAL).map(([k,v])=>(
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button onClick={exportarExcel} disabled={exportando}
                style={{background:exportando?"#1e293b":"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.4)",color:"#10b981",padding:"7px 14px",borderRadius:6,fontSize:11,cursor:exportando?"default":"pointer",fontFamily:"Georgia,serif",fontWeight:600,touchAction:"manipulation",whiteSpace:"nowrap"}}>
                {exportando ? "⏳..." : "📊 Excel"}
              </button>
            </div>
          </div>
          {progresso && (
            <div style={{padding:"8px 14px",background:"rgba(16,185,129,0.05)",borderBottom:"1px solid rgba(16,185,129,0.15)",fontSize:11,color:"#10b981"}}>
              {progresso}
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column"}}>
            {empresasOrdenadas.map((e,i)=>(
              <div key={i} style={{padding:"12px 14px",borderBottom:"1px solid rgba(30,41,59,0.5)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#ffffff",marginBottom:2}}>{e.razaoSocial||"—"}</div>
                    {e.nomeFantasia&&<div style={{fontSize:11,color:"#64748b",marginBottom:4}}>{e.nomeFantasia}</div>}
                    <div style={{fontSize:11,color:"#475569",fontFamily:"monospace",marginBottom:6}}>{fmtCNPJ(e.cnpj||"")}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                      <div style={{fontSize:11,color:"#94a3b8"}}>📍 {e.cidade||"—"}/{e.uf||"—"}</div>
                      <div style={{fontSize:11,color:e.capitalSocial>=500000?"#10b981":"#94a3b8",fontWeight:e.capitalSocial>=500000?600:400}}>💰 {fmtMoney(e.capitalSocial)}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>📞 {fmtPhone(e.telefone||"")}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>📅 {fmtDate(e.dataAbertura)}</div>
                    </div>
                    {e.socio&&<div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>👤 {e.socio}</div>}
                    {e.email&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>✉ {e.email}</div>}
                    {/* Botões de busca online */}
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      {(() => {
                        const nome = encodeURIComponent((e.razaoSocial||"").trim());
                        const cid = encodeURIComponent((e.cidade||"").trim());
                        const links = [
                          { l:"🌐", t:"Site", url:`https://www.google.com/search?q=${nome}+${cid}+site+oficial`, c:"#f59e0b" },
                          { l:"💼", t:"LinkedIn", url:`https://www.google.com/search?q=${nome}+linkedin`, c:"#0a66c2" },
                          { l:"📷", t:"Insta", url:`https://www.google.com/search?q=${nome}+instagram`, c:"#e1306c" },
                        ];
                        return links.map((x,j)=>(
                          <a key={j} href={x.url} target="_blank" rel="noreferrer"
                            style={{display:"inline-flex",alignItems:"center",gap:3,background:"#0d0f14",border:`1px solid ${x.c}33`,borderRadius:5,padding:"3px 8px",textDecoration:"none",fontSize:10,color:x.c,touchAction:"manipulation"}}>
                            {x.l} {x.t}
                          </a>
                        ));
                      })()}
                    </div>
                  </div>
                  <button onClick={()=>shareWpp(e)}
                    style={{background:"transparent",border:"1px solid rgba(37,211,102,0.3)",color:"#25D366",padding:"5px 10px",borderRadius:4,fontSize:11,cursor:"pointer",flexShrink:0,touchAction:"manipulation"}}>
                    📲 WPP
                  </button>
                </div>
              </div>
            ))}
          </div>

          {empresasOrdenadas.length>0 && empresasOrdenadas.length<(resultado.total||0) && (
            <div style={{padding:"12px 14px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:8}}>
                Mostrando {empresasOrdenadas.length} de {(resultado.total||0).toLocaleString("pt-BR")}
              </div>
              <Btn variant="secondary" small onClick={()=>buscar(resultado.cnae,pagina+1)} disabled={loading}>
                {loading?"Carregando...":"Carregar mais 20 empresas"}
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
      `_GBM International — ${new Date().toLocaleDateString("pt-BR")}_`,
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
