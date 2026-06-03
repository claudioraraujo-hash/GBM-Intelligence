// ─── GBM Intelligence — Módulo de Crédito v3 ─────────────────────────────────
// Suporta CNPJ e CPF | Providers modulares — ative APIs pagas descomentando slots

const PROVIDERS = {
  serasa:   { enabled: false, apiKey: process.env.SERASA_API_KEY   || "" },
  netrin:   { enabled: false, apiKey: process.env.NETRIN_API_KEY   || "" },
  boavista: { enabled: false, apiKey: process.env.BOAVISTA_API_KEY || "" },
  cnj:     { enabled: true },
  receita: { enabled: true },
};

const isCNPJ = (d) => d.replace(/\D/g,"").length === 14;
const isCPF  = (d) => d.replace(/\D/g,"").length === 11;
const fmtCNPJ = (v) => v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");
const fmtCPF  = (v) => v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,"$1.$2.$3-$4");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  if (req.method==="OPTIONS") return res.status(200).end();

  // Aceita ?doc= (novo) ou ?cnpj= (compatibilidade)
  const docParam = req.query.doc || req.query.cnpj || "";
  if (!docParam) return res.status(400).json({ error:"Informe CNPJ ou CPF." });

  const raw  = docParam.replace(/\D/g,"");
  const tipo = isCNPJ(raw)?"CNPJ":isCPF(raw)?"CPF":null;
  if (!tipo) return res.status(400).json({ error:"Documento inválido. Informe CNPJ (14 dígitos) ou CPF (11 dígitos)." });

  const docFmt = tipo==="CNPJ" ? fmtCNPJ(raw) : fmtCPF(raw);

  const report = {
    doc:raw, docFmt, tipo,
    geradoEm: new Date().toISOString(),
    providers: {},
    dadosCadastrais: null,
    restricaoFinanceira: null,
    protestos: null,
    cheques: null,
    acoesEmpresa: null,
    acoesSocios: null,
    socios: null,
    score: null,
    errors: [],
  };

  // ── 1. DADOS CADASTRAIS (CNPJ) ────────────────────────────────────────────
  if (tipo==="CNPJ" && PROVIDERS.receita.enabled) {
    try {
      const r = await fetch(`https://publica.cnpj.ws/cnpj/${raw}`,{
        headers:{"Accept":"application/json","User-Agent":"gbm-intelligence/1.0"},
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        const d = await r.json();
        report.dadosCadastrais = {
          doc:raw, docFmt, tipo,
          razaoSocial: d.razao_social,
          nomeFantasia: d.nome_fantasia,
          situacao: d.estabelecimento?.situacao_cadastral?.descricao,
          dataAbertura: d.estabelecimento?.data_inicio_atividade,
          regimeFiscal: d.regime_tributario?.descricao||null,
          naturezaJuridica: d.natureza_juridica?.descricao,
          capitalSocial: parseFloat(d.capital_social||"0"),
          porte: d.porte?.descricao,
          atividadePrincipal: d.estabelecimento?.atividade_principal,
          atividadesSecundarias: d.estabelecimento?.atividades_secundarias||[],
          logradouro:[d.estabelecimento?.tipo_logradouro,d.estabelecimento?.logradouro,d.estabelecimento?.numero,d.estabelecimento?.complemento].filter(Boolean).join(" "),
          bairro: d.estabelecimento?.bairro,
          cep: d.estabelecimento?.cep,
          cidade: d.estabelecimento?.cidade?.nome,
          uf: d.estabelecimento?.estado?.sigla,
          telefone: d.estabelecimento?.ddd1&&d.estabelecimento?.telefone1?d.estabelecimento.ddd1+d.estabelecimento.telefone1:null,
          email: d.estabelecimento?.email,
        };
        report.socios = (d.socios||d.qsa||[]).map(s=>({
          nome:s.nome||s.nome_socio,
          documento:s.cpf_representante_legal||s.cnpj_cpf_do_socio,
          qualificacao:s.qualificacao_socio?.descricao||s.qualificacao,
          dataInicio:s.data_entrada_sociedade,
        }));
        report.providers.receita="ok";
      }
    } catch(e) {
      report.errors.push({provider:"Receita Federal",msg:e.message});
      report.providers.receita="error";
    }
  }

  if (tipo==="CPF") {
    report.dadosCadastrais = {doc:raw,docFmt,tipo,razaoSocial:null,situacao:"Pessoa Física"};
  }

  // ── 2. PROTESTOS via Claude AI + web search ───────────────────────────────
  try {
    const nome = report.dadosCadastrais?.razaoSocial||"";
    const prompt = `Consulte protestos em cartório para o ${tipo} ${docFmt}${nome?` (${nome})`:""}.

Acesse e busque informações nestas fontes:
- pesquisaprotesto.com.br
- protestosp.com.br
- resolve.cenprot.org.br

Retorne SOMENTE este JSON sem texto antes ou depois:
{
  "status": "limpo" | "protestado" | "nao_encontrado",
  "quantidade": número ou null,
  "valorTotal": número decimal em reais ou null,
  "registros": [
    { "valor": número, "cartorio": "cartório", "cidade": "cidade", "uf": "UF", "vencimento": "DD/MM/AAAA" }
  ],
  "fontes": ["fontes consultadas"],
  "obs": "observação ou null"
}

Se encontrar protestos, inclua TODOS com valores e cartórios. Não invente dados.`;

    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:2000,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        system:"Você é um assistente de consulta de crédito. Retorne APENAS JSON puro, sem markdown.",
        messages:[{role:"user",content:prompt}],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (r.ok) {
      const data = await r.json();
      const texts = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      const clean = texts.replace(/```(?:json)?/gi,"").trim();
      let parsed = null;
      try { parsed = JSON.parse(clean); } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) try { parsed = JSON.parse(match[0]); } catch {}
      }
      if (parsed?.status) {
        report.protestos = {
          status:parsed.status,
          quantidade:parsed.quantidade??null,
          valorTotal:parsed.valorTotal??null,
          registros:Array.isArray(parsed.registros)?parsed.registros:[],
          fontes:parsed.fontes||["Pesquisa web"],
          obs:parsed.obs||null,
          linkManual:"https://pesquisaprotesto.com.br",
          providerPago:null,
        };
        report.providers.protestos="ok";
      } else throw new Error("JSON inválido");
    } else throw new Error(`Claude API: ${r.status}`);
  } catch(e) {
    report.protestos = {
      status:"indisponivel",quantidade:null,valorTotal:null,registros:[],
      fontes:["CENPROT"],linkManual:"https://pesquisaprotesto.com.br",
      obs:"Consulta indisponível no momento.",
    };
    report.errors.push({provider:"Protestos",msg:e.message});
    report.providers.protestos="error";
  }

  // ── SLOT SERASA ───────────────────────────────────────────────────────────
  // if (PROVIDERS.serasa.enabled && PROVIDERS.serasa.apiKey) {
  //   const url = tipo==="CNPJ"
  //     ? `https://api.serasaexperian.com.br/background-check/v2/companies/${raw}`
  //     : `https://api.serasaexperian.com.br/background-check/v2/consumers/${raw}`;
  //   try {
  //     const r = await fetch(url,{headers:{"Authorization":`Bearer ${PROVIDERS.serasa.apiKey}`}});
  //     const d = await r.json();
  //     report.restricaoFinanceira = {
  //       score:d.scores?.[0]?.score, classificacao:d.scores?.[0]?.scoreModel,
  //       mensagem:d.scores?.[0]?.message, totalDebitos:d.negativeData?.debts?.summary?.count,
  //       valorDebitos:d.negativeData?.debts?.summary?.balance, fonte:"Serasa Experian",
  //     };
  //     report.protestos.registros=(d.negativeData?.protests?.protestList||[]).map(p=>({valor:p.amount,cartorio:p.notaryOffice,cidade:p.city,uf:p.state,vencimento:p.occurrenceDate}));
  //     report.protestos.valorTotal=d.negativeData?.protests?.summary?.balance;
  //     report.protestos.quantidade=d.negativeData?.protests?.summary?.count;
  //     report.protestos.providerPago="serasa";
  //   } catch(e){report.errors.push({provider:"Serasa",msg:e.message});}
  // }

  // ── SLOT NETRIN ───────────────────────────────────────────────────────────
  // if (PROVIDERS.netrin.enabled && PROVIDERS.netrin.apiKey) {
  //   const url = tipo==="CNPJ"
  //     ? `https://api.netrin.com.br/v1/cnpj/${raw}/credito`
  //     : `https://api.netrin.com.br/v1/cpf/${raw}/credito`;
  //   try {
  //     const r = await fetch(url,{headers:{"x-api-key":PROVIDERS.netrin.apiKey}});
  //     const d = await r.json();
  //     report.restricaoFinanceira = {score:d.score?.valor,classificacao:d.score?.classificacao,mensagem:d.score?.descricao,totalDebitos:d.debitos?.quantidade,valorDebitos:d.debitos?.valor_total,fonte:"Netrin"};
  //     report.protestos.registros=(d.protestos?.lista||[]).map(p=>({valor:p.valor,cartorio:p.cartorio,cidade:p.cidade,uf:p.uf,vencimento:p.data_vencimento}));
  //     report.protestos.valorTotal=d.protestos?.valor_total;
  //     report.protestos.quantidade=d.protestos?.quantidade;
  //     report.protestos.providerPago="netrin";
  //   } catch(e){report.errors.push({provider:"Netrin",msg:e.message});}
  // }

  // ── 3. PROCESSOS JUDICIAIS ────────────────────────────────────────────────
  if (PROVIDERS.cnj.enabled) {
    const tribunais = [
      {index:"api_publica_tjsp", nome:"TJSP"},
      {index:"api_publica_trt15",nome:"TRT15"},
      {index:"api_publica_trf3", nome:"TRF3"},
      {index:"api_publica_tjmg", nome:"TJMG"},
      {index:"api_publica_trt2", nome:"TRT2"},
    ];

    const fetchTribunal = async (t) => {
      try {
        const should = [
          {match_phrase:{"partes.documento":raw}},
          {match_phrase:{"partes.documento":docFmt}},
        ];
        if (report.dadosCadastrais?.razaoSocial)
          should.push({match_phrase:{"partes.nome":report.dadosCadastrais.razaoSocial}});

        const r = await fetch(`https://api-publica.datajud.cnj.jus.br/${t.index}/_search`,{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"ApiKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TaEctcWRRbWx4ODZTdw=="},
          body:JSON.stringify({query:{bool:{should}},size:20,sort:[{"dataAjuizamento":{order:"desc"}}]}),
          signal:AbortSignal.timeout(8000),
        });
        if (!r.ok) return {tribunal:t.nome,total:0,lista:[]};
        const d = await r.json();
        return {
          tribunal:t.nome,
          total:d.hits?.total?.value||0,
          lista:(d.hits?.hits||[]).map(h=>({
            numero:h._source?.numeroProcesso,
            classe:h._source?.classe?.nome,
            assunto:h._source?.assuntos?.[0]?.nome,
            tribunal:h._source?.tribunal||t.nome,
            grau:h._source?.grau,
            dataAjuizamento:h._source?.dataAjuizamento,
            classificacao:h._source?.movimentos?.[0]?.nome,
            partes:(h._source?.partes||[]).map(p=>({nome:p.nome,polo:p.polo,documento:p.documento})),
          })),
        };
      } catch { return {tribunal:t.nome,total:0,lista:[]}; }
    };

    const resultados = await Promise.all(tribunais.map(fetchTribunal));
    const todos = resultados.flatMap(r=>r.lista);
    const dedup = {};
    todos.forEach(p=>{if(p.numero)dedup[p.numero]=p;});
    const unicos = Object.values(dedup);

    const razao = (report.dadosCadastrais?.razaoSocial||"").toUpperCase().slice(0,20);
    const acoesEmpresa = unicos.filter(p=>
      p.partes?.some(pt=>pt.documento===raw||pt.documento===docFmt||(razao&&pt.nome?.toUpperCase().includes(razao)))
    );
    const acoesSocios = unicos.filter(p=>!acoesEmpresa.includes(p));

    report.acoesEmpresa={total:resultados.reduce((s,r)=>s+r.total,0),lista:acoesEmpresa,fonte:"CNJ DataJud"};
    report.acoesSocios ={total:acoesSocios.length,lista:acoesSocios,fonte:"CNJ DataJud"};
    report.providers.cnj="ok";
  }

  // ── 4. CHEQUES ────────────────────────────────────────────────────────────
  report.cheques={total:0,valor:0,lista:[],fonte:"Banco Central",status:"slot_disponivel"};

  // ── 5. SCORE ──────────────────────────────────────────────────────────────
  report.score = calcularScore(report);

  return res.status(200).json(report);
}

function calcularScore(r) {
  let pts=1000;
  const fatores=[];
  const rf=r.dadosCadastrais;
  if (!rf) return {pontos:0,classificacao:"Sem dados",cor:"#64748b",fatores:[],recomendacao:"Dados insuficientes."};

  if (r.tipo==="CPF") {
    const prot=r.protestos;
    if (prot?.status==="limpo") fatores.push({label:"Sem protestos",impacto:0,positivo:true});
    else if (prot?.status==="protestado"){
      const qtd=prot.quantidade||1,ded=Math.min(qtd*100,400);
      pts-=ded; fatores.push({label:`${qtd} protesto(s)${prot.valorTotal?` — R$${prot.valorTotal.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:""}`,impacto:-ded,positivo:false});
    }
    const proc=(r.acoesEmpresa?.total||0)+(r.acoesSocios?.total||0);
    if (proc===0) fatores.push({label:"Sem processos judiciais",impacto:0,positivo:true});
    else if (proc<=3){pts-=100;fatores.push({label:`${proc} processo(s)`,impacto:-100,positivo:false});}
    else {pts-=250;fatores.push({label:`${proc} processos`,impacto:-250,positivo:false});}
  } else {
    const sit=(rf.situacao||"").toUpperCase();
    if (sit.includes("ATIVA")) fatores.push({label:"Situação cadastral ativa",impacto:0,positivo:true});
    else {pts-=300;fatores.push({label:`Situação: ${rf.situacao}`,impacto:-300,positivo:false});}

    const anos=rf.dataAbertura?(Date.now()-new Date(rf.dataAbertura))/(1000*60*60*24*365):0;
    if (anos>=5) fatores.push({label:`${Math.floor(anos)} anos de atividade`,impacto:0,positivo:true});
    else if (anos>=2){pts-=50;fatores.push({label:"Empresa 2–5 anos",impacto:-50,positivo:false});}
    else {pts-=150;fatores.push({label:"Empresa < 2 anos",impacto:-150,positivo:false});}

    const cap=rf.capitalSocial||0;
    if (cap>=1000000) fatores.push({label:`Capital R$${(cap/1e6).toFixed(1)}M`,impacto:0,positivo:true});
    else if (cap>=100000){pts-=30;fatores.push({label:"Capital R$100K–1M",impacto:-30,positivo:false});}
    else {pts-=100;fatores.push({label:"Capital baixo",impacto:-100,positivo:false});}

    const prot=r.protestos;
    if (prot?.status==="limpo") fatores.push({label:"Sem protestos",impacto:0,positivo:true});
    else if (prot?.status==="protestado"){
      const qtd=prot.quantidade||1,ded=Math.min(qtd*80,350);
      pts-=ded; fatores.push({label:`${qtd} protesto(s)${prot.valorTotal?` — R$${prot.valorTotal.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:""}`,impacto:-ded,positivo:false});
    } else {pts-=30;fatores.push({label:"Protestos não verificados",impacto:-30,positivo:false});}

    const pe=r.acoesEmpresa?.total||0;
    if (pe===0) fatores.push({label:"Sem processos da empresa",impacto:0,positivo:true});
    else if (pe<=5){pts-=80;fatores.push({label:`${pe} processo(s) da empresa`,impacto:-80,positivo:false});}
    else {pts-=200;fatores.push({label:`${pe} processos da empresa`,impacto:-200,positivo:false});}

    const ps=r.acoesSocios?.total||0;
    if (ps>5){pts-=100;fatores.push({label:`${ps} processos dos sócios`,impacto:-100,positivo:false});}
    else if (ps>0){pts-=40;fatores.push({label:`${ps} processo(s) dos sócios`,impacto:-40,positivo:false});}

    if (r.restricaoFinanceira?.score){
      const se=parseInt(r.restricaoFinanceira.score);
      if (se<300){pts-=200;fatores.push({label:`Score ${r.restricaoFinanceira.fonte}: ${se}`,impacto:-200,positivo:false});}
      else if (se<600){pts-=80;fatores.push({label:`Score ${r.restricaoFinanceira.fonte}: ${se}`,impacto:-80,positivo:false});}
      else fatores.push({label:`Score ${r.restricaoFinanceira.fonte}: ${se}`,impacto:0,positivo:true});
    }
  }

  pts=Math.max(0,Math.min(1000,pts));
  let cl,cor,rec;
  if      (pts>=800){cl="A — Excelente"; cor="#10b981";rec="Baixo risco. Crédito recomendado.";}
  else if (pts>=600){cl="B — Bom";       cor="#84cc16";rec="Risco baixo. Crédito com monitoramento.";}
  else if (pts>=400){cl="C — Regular";   cor="#f59e0b";rec="Risco moderado. Exigir garantias.";}
  else if (pts>=200){cl="D — Alto risco";cor="#f97316";rec="Risco elevado. Venda apenas à vista.";}
  else              {cl="E — Crítico";   cor="#ef4444";rec="Risco muito alto. Não conceder crédito.";}

  return {pontos:pts,classificacao:cl,cor,recomendacao:rec,fatores};
}
