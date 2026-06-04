import { useState } from "react";

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = {
  cnpj: v => { const d=(v||"").replace(/\D/g,"").slice(0,14); return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2"); },
  cpf:  v => { const d=(v||"").replace(/\D/g,"").slice(0,11); return d.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2"); },
  doc:  v => v?.length>11 ? fmt.cnpj(v) : fmt.cpf(v),
  cep:  v => (v||"").replace(/\D/g,"").replace(/(\d{5})(\d)/,"$1-$2"),
  date: v => { if(!v)return"—"; if(/^\d{4}-\d{2}-\d{2}/.test(v)){const[y,m,d]=v.split("T")[0].split("-");return`${d}/${m}/${y}`;}return v; },
  money: v => { const n=parseFloat(v); return isNaN(n)?"—":n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); },
  phone: v => { const d=(v||"").replace(/\D/g,""); if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return v||"—"; },
};

const C = {
  bg:"#0a0c10",bg2:"#0d0f14",card:"#111318",border:"rgba(100,116,139,0.2)",
  amber:"#f59e0b",white:"#ffffff",muted:"#64748b",text:"#f1f5f9",textSoft:"#94a3b8",
  green:"#10b981",red:"#ef4444",orange:"#f97316",yellow:"#eab308",
};

// ─── Componentes base ─────────────────────────────────────────────────────────
const Section = ({title, icon, badge, badgeColor, children}) => (
  <div style={{marginBottom:16}}>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:`2px solid ${C.amber}`,marginBottom:12,flexWrap:"wrap",gap:8}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:13,fontWeight:700,color:C.white,textTransform:"uppercase",letterSpacing:"0.08em",flex:1}}>{title}</span>
      {badge && <span style={{fontSize:11,padding:"2px 10px",borderRadius:4,background:`${badgeColor||C.amber}22`,color:badgeColor||C.amber,border:`1px solid ${badgeColor||C.amber}44`,fontWeight:700}}>{badge}</span>}
    </div>
    {children}
  </div>
);

const Row = ({label, value, highlight, full}) => (
  <div style={{display:"flex",gap:8,padding:"5px 0",borderBottom:`1px solid rgba(100,116,139,0.08)`,alignItems:"flex-start",gridColumn:full?"1/-1":"auto"}}>
    <span style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",minWidth:120,flexShrink:0,paddingTop:1,lineHeight:1.4}}>{label}</span>
    <span style={{color:highlight?C.amber:C.white,fontSize:12,fontWeight:highlight?600:400,wordBreak:"break-word",lineHeight:1.5}}>{value||"—"}</span>
  </div>
);

const Grid = ({children, cols=2}) => (
  <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:"0 16px"}}>{children}</div>
);

const Tag = ({label, color=C.muted}) => (
  <span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:`${color}22`,color,border:`1px solid ${color}44`,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
);

const SlotPago = ({titulo, descricao, providers=[]}) => (
  <div style={{background:"rgba(245,158,11,0.04)",border:`1px dashed ${C.amber}44`,borderRadius:8,padding:14,display:"flex",gap:12,alignItems:"flex-start"}}>
    <span style={{fontSize:20,flexShrink:0}}>🔌</span>
    <div>
      <div style={{fontSize:12,color:C.amber,fontWeight:700,marginBottom:2}}>{titulo}</div>
      <div style={{fontSize:11,color:C.muted,marginBottom:6}}>{descricao}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {providers.map(p=><Tag key={p} label={p} color={C.amber}/>)}
      </div>
    </div>
  </div>
);

// ─── Score Visual (gauge) ─────────────────────────────────────────────────────
const ScoreGauge = ({pontos, classificacao, cor, recomendacao, fatores}) => {
  const [showFatores, setShowFatores] = useState(false);
  const letra = classificacao?.split(" ")[0] || "?";
  const pct = pontos/10;

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",marginBottom:16}}>
      {/* Topo colorido */}
      <div style={{background:`${cor}18`,borderBottom:`3px solid ${cor}`,padding:"20px 16px",display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
        {/* Gauge semicircular */}
        <div style={{position:"relative",width:100,height:54,flexShrink:0}}>
          <svg width="100" height="54" viewBox="0 0 100 54">
            <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"/>
            <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke={cor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${pct*1.41} 141`}/>
          </svg>
          <div style={{position:"absolute",bottom:0,left:0,right:0,textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:700,color:cor,lineHeight:1}}>{pontos}</div>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:22,fontWeight:700,color:cor,lineHeight:1,marginBottom:4}}>{classificacao}</div>
          <div style={{fontSize:12,color:C.textSoft,lineHeight:1.5}}>{recomendacao}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:48,fontWeight:700,color:cor,lineHeight:1,opacity:0.3}}>{letra}</div>
        </div>
      </div>
      {/* Fatores */}
      <div style={{padding:"10px 16px"}}>
        <button onClick={()=>setShowFatores(!showFatores)}
          style={{fontSize:11,color:C.amber,background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:showFatores?10:0}}>
          {showFatores?"▾ Ocultar fatores":"▸ Ver fatores do score"}
        </button>
        {showFatores && (
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {fatores.map((f,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:`1px solid rgba(100,116,139,0.08)`}}>
                <span style={{fontSize:12,color:C.textSoft}}>{f.positivo?"✅":"❌"} {f.label}</span>
                {f.impacto!==0&&<span style={{fontSize:12,color:C.red,fontWeight:600,flexShrink:0,marginLeft:8}}>{f.impacto}</span>}
              </div>
            ))}
            <div style={{fontSize:10,color:C.muted,marginTop:6,fontStyle:"italic"}}>{fatores.fonte||"Score GBM Intelligence — indicativo"}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Componente principal do relatório ────────────────────────────────────────
export default function CreditReport({ data, onShare }) {
  const [tabProcessos, setTabProcessos] = useState("empresa");
  if (!data) return null;

  const { dadosCadastrais:rf, score, protestos, cheques, acoesEmpresa, acoesSocios, socios, restricaoFinanceira } = data;

  const statusSit = (s="") => {
    const u=s.toUpperCase();
    if(u.includes("ATIVA")) return C.green;
    if(u.includes("BAIXADA")||u.includes("CANCELADA")) return C.red;
    return C.amber;
  };

  const classProc = (c="") => {
    const u=c.toUpperCase();
    if(u.includes("PASSIVO")) return {color:C.red,label:"Passivo"};
    if(u.includes("ATIVO")) return {color:C.green,label:"Ativo"};
    return {color:C.muted,label:"Neutro"};
  };

  const totalProcessos = (acoesEmpresa?.total||0)+(acoesSocios?.total||0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>

      {/* ── CABEÇALHO DO RELATÓRIO ── */}
      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:16}}>
        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:4}}>Análise de Crédito — GBM Intelligence</div>
        <div style={{fontSize:18,fontWeight:700,color:C.white,lineHeight:1.2,marginBottom:6}}>{rf?.razaoSocial||"—"}</div>
        {rf?.nomeFantasia&&<div style={{fontSize:12,color:C.muted,fontStyle:"italic",marginBottom:6}}>"{rf.nomeFantasia}"</div>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <Tag label={fmt.cnpj(data.cnpj)} color={C.muted}/>
          <Tag label={rf?.situacao||"—"} color={statusSit(rf?.situacao||"")}/>
          {rf?.porte&&<Tag label={rf.porte} color={C.muted}/>}
          {rf?.regimeFiscal&&<Tag label={rf.regimeFiscal} color={C.muted}/>}
        </div>
        <div style={{fontSize:10,color:C.muted,marginTop:8}}>Gerado em {new Date(data.geradoEm).toLocaleString("pt-BR")} • Fontes: {Object.entries(data.providers||{}).filter(([,v])=>v==="ok").map(([k])=>k).join(", ") || "—"}</div>
      </div>

      {/* ── SCORE GBM ── */}
      {score && <ScoreGauge {...score}/>}

      {/* ── RESTRIÇÃO FINANCEIRA ── */}
      <Section title="Restrição Financeira" icon="💳"
        badge={restricaoFinanceira ? `Score ${restricaoFinanceira.fonte}: ${restricaoFinanceira.score}` : "Score externo não ativo"}
        badgeColor={restricaoFinanceira ? C.amber : C.muted}>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
          {[
            { label:"Score GBM", value:`${score?.pontos||"—"}/1000`, color:score?.cor },
            { label:"Débitos e Protestos", value:protestos?.valorTotal!=null?fmt.money(protestos.valorTotal):"—", color:protestos?.valorTotal>0?C.red:C.green },
            { label:"Cheques Devolvidos", value:cheques?.status==="slot_disponivel"?"—":fmt.money(cheques?.valor), color:cheques?.total>0?C.red:C.green },
          ].map(({label,value,color})=>(
            <div key={label} style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 10px",textAlign:"center"}}>
              <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{label}</div>
              <div style={{fontSize:16,fontWeight:700,color:color||C.white,lineHeight:1}}>{value}</div>
            </div>
          ))}
        </div>

        {/* Slot Score Externo */}
        {!restricaoFinanceira && (
          <SlotPago
            titulo="Score + Dívidas Detalhadas (API Paga)"
            descricao="Score Serasa/SPC, valor total de dívidas, cheques devolvidos e histórico de inadimplência."
            providers={["Serasa Experian","Netrin","Boa Vista"]}
          />
        )}
      </Section>

      {/* ── PROTESTOS ── */}
      <Section title="Protestos em Cartório" icon="🔴"
        badge={
          protestos?.status==="limpo"?"LIMPO":
          protestos?.status==="protestado"?(protestos.quantidade ? `${protestos.quantidade} PROTESTO(S)` : "PROTESTADO"):
          protestos?.status==="offline"?"⏳ OFFLINE":
          "VERIFICAR"
        }
        badgeColor={
          protestos?.status==="limpo"?C.green:
          protestos?.status==="protestado"?C.red:
          protestos?.status==="offline"?C.amber:
          C.amber
        }>

        {protestos?.status==="limpo" && (
          <div style={{display:"flex",gap:10,alignItems:"center",padding:"10px 0"}}>
            <span style={{fontSize:24}}>✅</span>
            <span style={{fontSize:13,color:C.textSoft}}>Nenhum protesto localizado. Fonte: {protestos.fonte}</span>
          </div>
        )}

        {protestos?.status==="protestado" && (
          <>
            {/* Tabela de protestos com valor (vem da API paga) */}
            {protestos.registros?.length>0 ? (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.border}`}}>
                      {["Valor","Cartório","Cidade/UF","Vencimento"].map(h=>(
                        <th key={h} style={{padding:"6px 8px",color:C.muted,fontWeight:600,textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {protestos.registros.map((p,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid rgba(100,116,139,0.08)`}}>
                        <td style={{padding:"7px 8px",color:C.red,fontWeight:600}}>{fmt.money(p.valor)}</td>
                        <td style={{padding:"7px 8px",color:C.textSoft}}>{p.cartorio||"—"}</td>
                        <td style={{padding:"7px 8px",color:C.textSoft}}>{p.cidade}{p.uf?` / ${p.uf}`:""}</td>
                        <td style={{padding:"7px 8px",color:C.textSoft}}>{fmt.date(p.vencimento)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Sem detalhes — API paga não ativa
              <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",marginBottom:10}}>
                <span style={{fontSize:20}}>❌</span>
                <div>
                  <div style={{fontSize:13,color:C.red,fontWeight:600}}>{protestos.quantidade} protesto(s) localizado(s)</div>
                  <div style={{fontSize:11,color:C.muted}}>Fonte: {protestos.fonte}</div>
                  <a href={protestos.linkManual} target="_blank" rel="noreferrer"
                    style={{fontSize:11,color:C.amber,textDecoration:"underline",display:"block",marginTop:4}}>
                    Ver detalhes em pesquisaprotesto.com.br →
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {(protestos?.status==="verificar"||protestos?.status==="indisponivel") && (
          <div style={{padding:"8px 0"}}>
            <div style={{fontSize:12,color:C.textSoft,marginBottom:6}}>⚠ Não foi possível verificar automaticamente.</div>
            <a href="https://pesquisaprotesto.com.br" target="_blank" rel="noreferrer"
              style={{fontSize:12,color:C.amber,textDecoration:"underline"}}>Consultar manualmente →</a>
          </div>
        )}

        {protestos?.status==="offline" && (
          <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:14}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:20}}>⏳</span>
              <div>
                <div style={{fontSize:13,color:C.amber,fontWeight:600,marginBottom:4}}>Serviço de Protestos Temporariamente Offline</div>
                <div style={{fontSize:12,color:C.textSoft,marginBottom:8}}>O provedor CenProt/Valida API está fora do ar no momento. Os demais dados do relatório estão corretos.</div>
                <a href="https://pesquisaprotesto.com.br" target="_blank" rel="noreferrer"
                  style={{fontSize:12,color:C.amber,textDecoration:"underline",display:"block"}}>
                  Consultar manualmente em pesquisaprotesto.com.br →
                </a>
              </div>
            </div>
          </div>
        )}

        {protestos?.status==="protestado" && protestos?.registros?.length===0 && protestos?.obs && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:24}}>❌</span>
              <div>
                <div style={{fontSize:14,color:C.red,fontWeight:600}}>
                  {protestos.quantidade ? `${protestos.quantidade} protesto(s) encontrado(s)` : "Protestos encontrados"}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{protestos.obs}</div>
              </div>
            </div>
            <a href="https://pesquisaprotesto.com.br" target="_blank" rel="noreferrer"
              style={{fontSize:12,color:C.amber,textDecoration:"underline"}}>
              Ver detalhes em pesquisaprotesto.com.br →
            </a>
          </div>
        )}

        {/* Slot API paga para detalhamento */}
        {protestos?.status!=="limpo" && !protestos?.providerPago && (
          <div style={{marginTop:10}}>
            <SlotPago
              titulo="Detalhamento de Protestos (API Paga)"
              descricao="Valor por cartório, data de vencimento e cidade. Cobertura nacional em +2.000 cartórios."
              providers={["Serasa Experian","Netrin","CRC Brasil"]}
            />
          </div>
        )}
      </Section>

      {/* ── CHEQUES DEVOLVIDOS ── */}
      <Section title="Cheques Devolvidos" icon="📋"
        badge={cheques?.status==="slot_disponivel"?"—":cheques?.total>0?`${cheques.total} registro(s)`:"NENHUM"}
        badgeColor={cheques?.total>0?C.red:C.green}>

        {cheques?.status==="slot_disponivel" ? (
          <SlotPago
            titulo="Cheques Devolvidos (API Paga)"
            descricao="Histórico de cheques devolvidos via base do Banco Central / Serasa."
            providers={["Serasa Experian","Netrin","Boa Vista"]}
          />
        ) : (
          <div style={{padding:"8px 0",fontSize:13,color:cheques?.total>0?C.red:C.textSoft}}>
            {cheques?.total>0 ? `${cheques.total} cheque(s) devolvido(s) — ${fmt.money(cheques?.valor)}` : "✅ Nenhum cheque devolvido encontrado."}
          </div>
        )}
      </Section>

      {/* ── PROCESSOS JUDICIAIS ── */}
      <Section title="Ações Judiciais" icon="⚖️"
        badge={`${totalProcessos} processo(s)`}
        badgeColor={totalProcessos>5?C.red:totalProcessos>0?C.amber:C.green}>

        {/* Tabs empresa / sócios */}
        <div style={{display:"flex",gap:0,marginBottom:12,background:"#0d0f14",borderRadius:6,overflow:"hidden",border:`1px solid ${C.border}`}}>
          {[
            {id:"empresa",label:`Da Empresa (${acoesEmpresa?.total||0})`},
            {id:"socios", label:`Dos Sócios (${acoesSocios?.total||0})`},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTabProcessos(t.id)}
              style={{flex:1,padding:"8px 6px",background:tabProcessos===t.id?C.amber:"transparent",color:tabProcessos===t.id?C.bg:C.muted,border:"none",cursor:"pointer",fontSize:12,fontWeight:tabProcessos===t.id?700:400,fontFamily:"Georgia,serif",touchAction:"manipulation"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista de processos */}
        {(() => {
          const lista = tabProcessos==="empresa" ? acoesEmpresa?.lista : acoesSocios?.lista;
          const total = tabProcessos==="empresa" ? acoesEmpresa?.total : acoesSocios?.total;
          if(!lista?.length) return <div style={{padding:"16px 0",textAlign:"center",color:C.muted,fontSize:13}}>✅ Nenhum processo encontrado</div>;
          return (
            <>
              {lista.map((p,i)=>{
                const cls = classProc(p.classificacao||"");
                return (
                  <div key={i} style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{p.numero||"—"}</span>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {p.grau&&<Tag label={p.grau} color={C.muted}/>}
                        <Tag label={cls.label} color={cls.color}/>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {[
                        ["Classe",p.classe],["Assunto",p.assunto],
                        ["Tribunal",p.tribunal],["Ajuizamento",fmt.date(p.dataAjuizamento)],
                      ].map(([l,v])=>(
                        <div key={l}>
                          <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                          <div style={{fontSize:11,color:C.textSoft,lineHeight:1.4}}>{v||"—"}</div>
                        </div>
                      ))}
                    </div>
                    {p.partes?.length>0&&(
                      <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid rgba(100,116,139,0.1)`}}>
                        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>Partes</div>
                        {p.partes.slice(0,4).map((pt,j)=>(
                          <div key={j} style={{fontSize:10,color:C.textSoft,display:"flex",gap:6}}>
                            <Tag label={pt.polo||"?"} color={pt.polo?.toLowerCase()==="passivo"?C.red:pt.polo?.toLowerCase()==="ativo"?C.green:C.muted}/>
                            <span>{pt.nome}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {total > lista.length && <div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"6px 0"}}>... e mais {total-lista.length} processo(s)</div>}
            </>
          );
        })()}
      </Section>

      {/* ── QUADRO SOCIETÁRIO ── */}
      <Section title="Quadro Societário e Funcionários" icon="👥"
        badge={`${socios?.length||0} sócio(s)`} badgeColor={C.muted}>
        {socios?.length>0 ? (
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
            {socios.map((s,i)=>(
              <div key={i} style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:13,color:C.white,fontWeight:600}}>{s.nome||"—"}</div>
                    <div style={{fontSize:11,color:C.muted}}>{s.qualificacao||"—"}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    {s.documento&&<div style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{fmt.doc(s.documento)}</div>}
                    <div style={{fontSize:10,color:C.muted}}>Desde {fmt.date(s.dataInicio)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div style={{fontSize:13,color:C.muted,padding:"10px 0"}}>Nenhum sócio localizado</div>}
      </Section>

      {/* ── DADOS CADASTRAIS ── */}
      <Section title="Dados Cadastrais" icon="🏢">
        <Grid cols={2}>
          <Row label="CNPJ" value={fmt.cnpj(data.cnpj)}/>
          <Row label="Situação" value={rf?.situacao} highlight/>
          <Row label="Abertura" value={fmt.date(rf?.dataAbertura)}/>
          <Row label="Regime Fiscal" value={rf?.regimeFiscal}/>
          <Row label="Natureza Jurídica" value={rf?.naturezaJuridica}/>
          <Row label="Capital Social" value={fmt.money(rf?.capitalSocial)} highlight/>
          <Row label="Porte" value={rf?.porte}/>
          <Row label="Telefone" value={fmt.phone(rf?.telefone)}/>
          <Row label="E-mail" value={rf?.email}/>
          <Row label="Logradouro" value={[rf?.logradouro,rf?.bairro].filter(Boolean).join(", ")} full/>
          <Row label="Cidade/UF" value={[rf?.cidade,rf?.uf].filter(Boolean).join(" / ")}/>
          <Row label="CEP" value={fmt.cep(rf?.cep||"")}/>
        </Grid>

        {/* CNAEs */}
        {rf?.atividadePrincipal && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:9,color:C.amber,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700,marginBottom:6}}>Atividades Econômicas</div>
            <div style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
              <div style={{display:"flex",gap:8,padding:"7px 10px",borderBottom:`1px solid ${C.border}`,background:"rgba(245,158,11,0.05)"}}>
                <span style={{fontSize:11,color:C.amber,fontFamily:"monospace",flexShrink:0}}>{rf.atividadePrincipal.id}</span>
                <span style={{fontSize:11,color:C.white}}>{rf.atividadePrincipal.descricao}</span>
                <Tag label="Principal" color={C.amber}/>
              </div>
              {(rf.atividadesSecundarias||[]).slice(0,5).map((a,i)=>(
                <div key={i} style={{display:"flex",gap:8,padding:"5px 10px",borderBottom:`1px solid rgba(100,116,139,0.06)`}}>
                  <span style={{fontSize:10,color:C.muted,fontFamily:"monospace",flexShrink:0}}>{a.id}</span>
                  <span style={{fontSize:10,color:C.textSoft}}>{a.descricao}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── RODAPÉ ── */}
      <div style={{background:"#0d0f14",border:`1px solid ${C.border}`,borderRadius:8,padding:12,marginTop:4}}>
        <div style={{fontSize:10,color:C.muted,lineHeight:1.6}}>
          <strong style={{color:C.textSoft}}>Observação:</strong> O módulo de Crédito do GBM Intelligence utiliza dados de fontes públicas (Receita Federal, CNJ DataJud, CENPROT) e pode apresentar imprecisões. O Score GBM tem caráter indicativo e não substitui análise de crédito formal. Para dados completos de restrição financeira, ative a integração com Serasa Experian ou Netrin.
        </div>
        {data.errors?.length>0&&(
          <div style={{marginTop:8,fontSize:10,color:"#475569"}}>
            ⚠ Erros: {data.errors.map(e=>`${e.provider}: ${e.msg}`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
