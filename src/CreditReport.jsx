import { useState } from "react";

const fmt = {
  cnpj: v => { const d=(v||"").replace(/\D/g,"").slice(0,14); return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2"); },
  cpf:  v => { const d=(v||"").replace(/\D/g,"").slice(0,11); return d.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2"); },
  doc:  v => v?.replace(/\D/g,"").length > 11 ? fmt.cnpj(v) : fmt.cpf(v),
  cep:  v => (v||"").replace(/\D/g,"").replace(/(\d{5})(\d)/,"$1-$2"),
  date: v => { if(!v)return"—"; if(/^\d{4}-\d{2}-\d{2}/.test(v)){const[y,m,d]=v.split("T")[0].split("-");return`${d}/${m}/${y}`;}return v; },
  money: v => { const n=parseFloat(v); return isNaN(n)?"—":n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); },
  phone: v => { const d=(v||"").replace(/\D/g,""); if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return v||"—"; },
};

// ─── Score Gauge (escala E → AAA estilo Boa Vista) ────────────────────────────
function ScoreGauge({ restricaoFinanceira, scoreGbm }) {
  const escalas = ["E","D","C","CC","CCC","B","BB","BBB","A","AA","AAA"];
  const classif = restricaoFinanceira?.classificacao || scoreGbm?.classificacao?.split("—")[0]?.trim() || "—";
  const score   = restricaoFinanceira?.score || scoreGbm?.pontos;
  const prob    = restricaoFinanceira?.probabilidade;
  const fonte   = restricaoFinanceira?.fonte || "Score GBM Intelligence";

  // Cor baseada na classificação
  const corScore = (c) => {
    if (!c) return "#64748b";
    const u = c.toUpperCase();
    if (u.startsWith("A"))  return "#10b981";
    if (u.startsWith("B"))  return "#f59e0b";
    if (u.startsWith("C"))  return "#f97316";
    return "#ef4444";
  };
  const cor = corScore(classif);

  // Posição na escala
  const idx = escalas.findIndex(e => e === classif.toUpperCase());
  const pct = idx >= 0 ? ((idx + 0.5) / escalas.length) * 100 : 50;

  return (
    <div style={{background:"#0d0f14",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:20,marginBottom:16}}>
      <div style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.15em",fontWeight:700,marginBottom:14}}>Score de Crédito</div>
      <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
        {/* Círculo de rating */}
        <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="6"/>
            <circle cx="40" cy="40" r="34" fill="none" stroke={cor} strokeWidth="6"
              strokeDasharray={`${pct*2.14} 214`} strokeLinecap="round"
              transform="rotate(-90 40 40)"/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:22,fontWeight:700,color:cor,fontFamily:"Georgia,serif"}}>{classif}</span>
          </div>
        </div>

        {/* Descrição */}
        <div style={{flex:1,minWidth:0}}>
          {restricaoFinanceira?.mensagem ? (
            <p style={{fontSize:12,color:"#94a3b8",lineHeight:1.5,marginBottom:6}}>
              {restricaoFinanceira.mensagem.charAt(0) + restricaoFinanceira.mensagem.slice(1).toLowerCase()}
            </p>
          ) : null}
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:4}}>
            {score && <span style={{fontSize:11,color:"#64748b"}}>Score: <strong style={{color:cor}}>{score}</strong></span>}
            {prob  && <span style={{fontSize:11,color:"#64748b"}}>Prob. inadimplência: <strong style={{color:cor}}>{prob}</strong></span>}
          </div>
          <div style={{fontSize:10,color:"#334155",marginTop:4}}>{fonte}</div>
        </div>
      </div>

      {/* Barra de escala */}
      <div style={{marginTop:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:9,color:"#ef4444",textTransform:"uppercase",letterSpacing:"0.1em"}}>Extremamente Baixa</span>
          <span style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em"}}>Média</span>
          <span style={{fontSize:9,color:"#10b981",textTransform:"uppercase",letterSpacing:"0.1em"}}>Extremamente Alta</span>
        </div>
        <div style={{position:"relative",height:20,background:"linear-gradient(to right,#ef4444,#f97316,#f59e0b,#84cc16,#10b981)",borderRadius:10}}>
          {/* Marcadores */}
          {escalas.map((e,i)=>(
            <div key={e} style={{position:"absolute",top:"50%",transform:"translateY(-50%)",left:`${(i/escalas.length)*100+4.5}%`,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              {e === classif.toUpperCase() && (
                <div style={{background:"#fff",border:`2px solid ${cor}`,borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700,color:"#0a0c10",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>
                  {score||classif}
                </div>
              )}
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-around",position:"absolute",inset:0,alignItems:"center"}}>
            {escalas.map(e=>(
              <span key={e} style={{fontSize:8,color:e===classif.toUpperCase()?"#0a0c10":"rgba(0,0,0,0.5)",fontWeight:e===classif.toUpperCase()?700:400}}>{e}</span>
            ))}
          </div>
        </div>
        {idx>=0&&<div style={{fontSize:9,color:"#475569",marginTop:4,textAlign:"center"}}>Classificação: {classif} ({idx+1}º de {escalas.length} níveis)</div>}
      </div>
    </div>
  );
}

// ─── Bloco de seção (negativações, protestos, etc.) ───────────────────────────
function Secao({ titulo, status, badge, badgeColor, children }) {
  const [open, setOpen] = useState(true);
  const limpo = status === "limpo" || status === "ok" || badge === "NADA CONSTA";

  return (
    <div style={{marginBottom:12,border:`1px solid ${limpo?"rgba(16,185,129,0.2)":"rgba(245,158,11,0.2)"}`,borderRadius:8,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",background:limpo?"rgba(16,185,129,0.05)":"rgba(245,158,11,0.05)",border:"none",cursor:"pointer",padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,touchAction:"manipulation"}}>
        <span style={{fontSize:11,fontWeight:700,color:"#f1f5f9",textTransform:"uppercase",letterSpacing:"0.1em"}}>{titulo}</span>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {badge && (
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:3,background:`${badgeColor||"#64748b"}22`,color:badgeColor||"#64748b",border:`1px solid ${badgeColor||"#64748b"}44`,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{badge}</span>
          )}
          <span style={{color:"#475569",fontSize:12}}>{open?"▾":"▸"}</span>
        </div>
      </button>
      {open && <div style={{padding:"12px 16px",background:"#0d0f14"}}>{children}</div>}
    </div>
  );
}

function NadaConsta({ msg="Nada consta" }) {
  return (
    <div style={{display:"flex",gap:10,alignItems:"center"}}>
      <span style={{fontSize:18}}>✅</span>
      <div>
        <div style={{fontSize:13,color:"#10b981",fontWeight:600}}>{msg}</div>
        <div style={{fontSize:11,color:"#475569",marginTop:2}}>Nenhuma ocorrência registrada neste bloco.</div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CreditReport({ data }) {
  if (!data) return null;

  const rf = data.dadosCadastrais;
  const protestos = data.protestos;
  const cheques = data.cheques;
  const score = data.score;
  const restricao = data.restricaoFinanceira;
  const socios = data.socios || [];
  const pendencias = data._pendencias;
  const pdfLink = data._relatorioPdf;

  const statusSit = (s="") => {
    const u=s.toUpperCase();
    if(u.includes("ATIV")) return "#10b981";
    if(u.includes("BAIXAD")||u.includes("CANCEL")) return "#ef4444";
    return "#f59e0b";
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>

      {/* ── Cabeçalho ── */}
      <div style={{background:"#0d0f14",border:"1px solid rgba(245,158,11,0.15)",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{fontSize:9,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:4}}>
          Análise de Crédito — GBM Intelligence
        </div>
        <div style={{fontSize:20,fontWeight:700,color:"#ffffff",lineHeight:1.2,marginBottom:6}}>
          {rf?.razaoSocial || (data.tipo==="CPF" ? "Pessoa Física" : "—")}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:11,color:"#64748b",fontFamily:"monospace"}}>{data.docFmt}</span>
          <span style={{fontSize:10,padding:"2px 8px",borderRadius:3,background:`${statusSit(rf?.situacao||"")}22`,color:statusSit(rf?.situacao||""),border:`1px solid ${statusSit(rf?.situacao||"")}44`,fontWeight:700}}>{rf?.situacao||"—"}</span>
          {rf?.porte && <span style={{fontSize:10,color:"#475569"}}>{rf.porte}</span>}
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          {rf?.dataAbertura && <span style={{fontSize:11,color:"#64748b"}}>Abertura: <strong style={{color:"#94a3b8"}}>{fmt.date(rf.dataAbertura)}</strong></span>}
          {rf?.capitalSocial>0 && <span style={{fontSize:11,color:"#64748b"}}>Capital: <strong style={{color:"#94a3b8"}}>{fmt.money(rf.capitalSocial)}</strong></span>}
          {rf?.naturezaJuridica && <span style={{fontSize:11,color:"#64748b"}}>{rf.naturezaJuridica}</span>}
        </div>
        {/* PDF link */}
        {pdfLink && (
          <a href={pdfLink} target="_blank" rel="noreferrer"
            style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:10,fontSize:11,color:"#f59e0b",textDecoration:"none",border:"1px solid rgba(245,158,11,0.3)",borderRadius:4,padding:"4px 10px"}}>
            📄 Ver relatório PDF completo →
          </a>
        )}
      </div>

      {/* ── Score ── */}
      <ScoreGauge restricaoFinanceira={restricao} scoreGbm={score}/>

      {/* ── Score GBM detalhado ── */}
      {score && (
        <div style={{background:"#0d0f14",border:`1px solid ${score.cor}33`,borderRadius:8,padding:14,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:10,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:700}}>Score GBM Intelligence</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:20,fontWeight:700,color:score.cor}}>{score.pontos}</span>
              <span style={{fontSize:11,color:score.cor,fontWeight:600}}>{score.classificacao}</span>
            </div>
          </div>
          <div style={{background:`${score.cor}12`,border:`1px solid ${score.cor}30`,borderRadius:6,padding:"8px 12px",marginBottom:10}}>
            <span style={{fontSize:12,color:score.cor}}>{score.recomendacao}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {score.fatores?.map((f,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",borderBottom:"1px solid rgba(30,41,59,0.6)"}}>
                <span style={{fontSize:11,color:"#94a3b8"}}>{f.positivo?"✅":"❌"} {f.label}</span>
                {f.impacto!==0&&<span style={{fontSize:11,color:"#ef4444",fontWeight:600,flexShrink:0,marginLeft:8}}>{f.impacto}</span>}
              </div>
            ))}
          </div>
          <div style={{fontSize:9,color:"#334155",marginTop:8,fontStyle:"italic"}}>Indicativo — baseado em dados públicos e Boa Vista SCPC</div>
        </div>
      )}

      {/* ── Negativações ── */}
      <Secao titulo="Negativações Registradas"
        status={pendencias?.quantidade>0?"pendente":"limpo"}
        badge={pendencias?.quantidade>0?`${pendencias.quantidade} registro(s)`:"NADA CONSTA"}
        badgeColor={pendencias?.quantidade>0?"#ef4444":"#10b981"}>
        {pendencias?.quantidade>0 ? (
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:18}}>❌</span>
            <div>
              <div style={{fontSize:13,color:"#ef4444",fontWeight:600}}>{pendencias.quantidade} pendência(s) — {fmt.money(pendencias.valor)}</div>
              <div style={{fontSize:11,color:"#475569",marginTop:2}}>Fonte: {pendencias.fonte}</div>
            </div>
          </div>
        ) : <NadaConsta/>}
      </Secao>

      {/* ── Títulos Protestados ── */}
      <Secao titulo="Títulos Protestados"
        status={protestos?.status}
        badge={protestos?.status==="protestado"?`${protestos.quantidade} PROTESTO(S)`:protestos?.status==="offline"?"⏳ OFFLINE":"NADA CONSTA"}
        badgeColor={protestos?.status==="protestado"?"#ef4444":protestos?.status==="offline"?"#f59e0b":"#10b981"}>

        {protestos?.status==="limpo" && <NadaConsta/>}

        {protestos?.status==="protestado" && (
          <div>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:18}}>❌</span>
              <div>
                <div style={{fontSize:14,color:"#ef4444",fontWeight:700}}>{protestos.quantidade} protesto(s) — {fmt.money(protestos.valorTotal)}</div>
                <div style={{fontSize:11,color:"#475569"}}>Fonte: {protestos.fontes?.join(", ")}</div>
              </div>
            </div>
            {protestos.registros?.length>0 && (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(100,116,139,0.2)"}}>
                      {["Valor","Cidade/UF","Data Protesto","Vencimento"].map(h=>(
                        <th key={h} style={{padding:"5px 8px",color:"#64748b",fontWeight:600,textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {protestos.registros.map((p,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid rgba(30,41,59,0.5)"}}>
                        <td style={{padding:"6px 8px",color:"#ef4444",fontWeight:600}}>{fmt.money(p.valor)}</td>
                        <td style={{padding:"6px 8px",color:"#94a3b8"}}>{p.cidade}{p.uf?`/${p.uf}`:""}</td>
                        <td style={{padding:"6px 8px",color:"#94a3b8"}}>{p.dataProtesto||"—"}</td>
                        <td style={{padding:"6px 8px",color:"#94a3b8"}}>{p.vencimento||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(protestos?.status==="offline"||protestos?.status==="indisponivel") && (
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:18}}>⏳</span>
            <div>
              <div style={{fontSize:12,color:"#f59e0b",fontWeight:600,marginBottom:4}}>Serviço temporariamente indisponível</div>
              <a href="https://pesquisaprotesto.com.br" target="_blank" rel="noreferrer"
                style={{fontSize:11,color:"#f59e0b",textDecoration:"underline"}}>Consultar manualmente em pesquisaprotesto.com.br →</a>
            </div>
          </div>
        )}
      </Secao>

      {/* ── Ações Cíveis ── */}
      <Secao titulo="Ações Cíveis / Judiciais"
        status={data.acoesEmpresa?.total>0?"pendente":"limpo"}
        badge={data.acoesEmpresa?.total>0?`${data.acoesEmpresa.total} PROCESSO(S)`:"NADA CONSTA"}
        badgeColor={data.acoesEmpresa?.total>0?"#ef4444":"#10b981"}>
        {data.acoesEmpresa?.total===0 ? <NadaConsta/> : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {data.acoesEmpresa.lista?.slice(0,5).map((p,i)=>(
              <div key={i} style={{background:"#111318",border:"1px solid rgba(100,116,139,0.15)",borderRadius:6,padding:"10px 12px"}}>
                <div style={{fontSize:11,color:"#64748b",fontFamily:"monospace",marginBottom:4}}>{p.numero||"—"}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[["Classe",p.classe],["Assunto",p.assunto],["Tribunal",p.tribunal],["Data",fmt.date(p.dataAjuizamento)]].map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data.acoesEmpresa.total>5&&<div style={{fontSize:11,color:"#475569",textAlign:"center"}}>... e mais {data.acoesEmpresa.total-5} processo(s)</div>}
          </div>
        )}
      </Secao>

      {/* ── Cheques sem fundos ── */}
      <Secao titulo="Cheques Sem Fundos"
        status={cheques?.total>0?"pendente":"limpo"}
        badge={cheques?.total>0?`${cheques.total} registro(s)`:"NADA CONSTA"}
        badgeColor={cheques?.total>0?"#ef4444":"#10b981"}>
        {cheques?.total===0 ? <NadaConsta/> : (
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:18}}>❌</span>
            <div style={{fontSize:13,color:"#ef4444",fontWeight:600}}>{cheques.total} cheque(s) devolvido(s)</div>
          </div>
        )}
      </Secao>

      {/* ── Cheques sustados ── */}
      <Secao titulo="Cheques Sustados" status="limpo" badge="NÃO INFORMADO" badgeColor="#64748b">
        <div style={{fontSize:12,color:"#475569"}}>Este produto não retornou detalhes de cheque sustado.</div>
      </Secao>

      {/* ── Falências / Recuperações ── */}
      <Secao titulo="Falências / Recuperações Judiciais" status="limpo" badge="NADA CONSTA" badgeColor="#10b981">
        <NadaConsta/>
      </Secao>

      {/* ── Dados Cadastrais ── */}
      <Secao titulo="Dados Cadastrais" status="ok" badge={rf?.situacao||"—"} badgeColor={statusSit(rf?.situacao||"")}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            ["Razão Social / Nome", rf?.razaoSocial],
            [data.tipo==="CNPJ"?"CNPJ":"CPF", data.docFmt],
            ["Situação", rf?.situacao],
            ["Data Abertura/Nasc.", fmt.date(rf?.dataAbertura)],
            ["Natureza Jurídica", rf?.naturezaJuridica],
            ["Capital Social", rf?.capitalSocial>0?fmt.money(rf.capitalSocial):null],
            ["Porte", rf?.porte],
            ["Regime Fiscal", rf?.regimeFiscal],
            ["CNAE Principal", rf?.cnae||rf?.atividadePrincipal?.descricao],
            ["Inscrição Estadual", rf?.inscricaoEstadual],
            ["Telefone", fmt.phone(rf?.telefone||"")],
            ["E-mail", rf?.email],
          ].filter(([,v])=>v).map(([l,v])=>(
            <div key={l} style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontSize:9,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>{l}</span>
              <span style={{fontSize:12,color:"#ffffff",wordBreak:"break-word",lineHeight:1.4}}>{v}</span>
            </div>
          ))}
        </div>
        {rf?.logradouro && (
          <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid rgba(30,41,59,0.6)"}}>
            <div style={{fontSize:9,color:"#f59e0b",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:4}}>Endereço</div>
            <div style={{fontSize:12,color:"#94a3b8"}}>{rf.logradouro}{rf.bairro?`, ${rf.bairro}`:""} — {rf.cidade}/{rf.uf} — CEP {fmt.cep(rf.cep||"")}</div>
          </div>
        )}
      </Secao>

      {/* ── Quadro societário ── */}
      {socios.length>0 && (
        <Secao titulo="Quadro Societário" status="ok" badge={`${socios.length} sócio(s)`} badgeColor="#64748b">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {socios.map((s,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(30,41,59,0.5)",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:13,color:"#ffffff",fontWeight:600}}>{s.nome||"—"}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{s.qualificacao||"—"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  {s.documento&&<div style={{fontSize:11,color:"#475569",fontFamily:"monospace"}}>{fmt.doc(s.documento)}</div>}
                  {s.dataInicio&&<div style={{fontSize:10,color:"#334155"}}>Desde {fmt.date(s.dataInicio)}</div>}
                </div>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* ── Sócios — processos ── */}
      {data.acoesSocios?.total>0 && (
        <Secao titulo="Ações Judiciais dos Sócios"
          status="pendente"
          badge={`${data.acoesSocios.total} processo(s)`}
          badgeColor="#f59e0b">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {data.acoesSocios.lista?.slice(0,5).map((p,i)=>(
              <div key={i} style={{background:"#111318",border:"1px solid rgba(100,116,139,0.15)",borderRadius:6,padding:"10px 12px"}}>
                <div style={{fontSize:11,color:"#64748b",fontFamily:"monospace",marginBottom:4}}>{p.numero||"—"}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {[["Classe",p.classe],["Tribunal",p.tribunal],["Data",fmt.date(p.dataAjuizamento)]].map(([l,v])=>(
                    <div key={l}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                      <div style={{fontSize:11,color:"#94a3b8"}}>{v||"—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* ── Rodapé ── */}
      <div style={{background:"#0d0f14",border:"1px solid rgba(30,41,59,0.5)",borderRadius:8,padding:12,marginTop:4}}>
        <div style={{fontSize:10,color:"#334155",lineHeight:1.6}}>
          <strong style={{color:"#475569"}}>Observação:</strong> Esta análise utiliza dados da Receita Federal, Boa Vista SCPC e CNJ DataJud. O Score GBM tem caráter indicativo. Para dados completos, acesse o relatório PDF acima.
        </div>
        {data.errors?.length>0 && (
          <div style={{marginTop:6,fontSize:10,color:"#1e293b"}}>
            ⚠ {data.errors.map(e=>`${e.provider}: ${e.msg?.slice(0,50)}`).join(" · ")}
          </div>
        )}
        <div style={{fontSize:9,color:"#1e293b",marginTop:4}}>
          Gerado em {new Date(data.geradoEm).toLocaleString("pt-BR")} · Fontes: {Object.entries(data.providers||{}).filter(([,v])=>v==="ok").map(([k])=>k).join(", ")}
        </div>
      </div>
    </div>
  );
}
