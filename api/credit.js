// GBM Intelligence — Crédito v5
// Consultas paralelas: RF + Valida API simultâneas

const isCNPJ = (d) => d.replace(/\D/g,"").length === 14;
const isCPF  = (d) => d.replace(/\D/g,"").length === 11;
const fmtCNPJ = (v) => v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");
const fmtCPF  = (v) => v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,"$1.$2.$3-$4");

const parseValor = (v) => parseFloat(String(v||"0").replace(/[R$\s.]/g,"").replace(",",".")) || 0;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  if (req.method==="OPTIONS") return res.status(200).end();

  const docParam = req.query.doc || req.query.cnpj || "";
  if (!docParam) return res.status(400).json({ error:"Informe CNPJ ou CPF." });

  const raw  = docParam.replace(/\D/g,"");
  const tipo = isCNPJ(raw)?"CNPJ":isCPF(raw)?"CPF":null;
  if (!tipo) return res.status(400).json({ error:"Documento inválido. CNPJ (14) ou CPF (11) dígitos." });

  const docFmt = tipo==="CNPJ" ? fmtCNPJ(raw) : fmtCPF(raw);
  const VALIDA_KEY = process.env.VALIDA_API_KEY || "";

  const report = {
    doc:raw, docFmt, tipo,
    geradoEm: new Date().toISOString(),
    providers: {},
    dadosCadastrais: null,
    protestos: null,
    cheques: { total:0, valor:0, lista:[], status:"slot_disponivel" },
    acoesEmpresa: null,
    acoesSocios: null,
    socios: null,
    score: null,
    errors: [],
  };

  // ── Executa RF + Valida + CNJ em paralelo ────────────────────────────────
  const [rfResult, validaResult, cnjResult] = await Promise.allSettled([
    fetchRF(raw),
    VALIDA_KEY && tipo==="CNPJ" ? fetchValida(docFmt, VALIDA_KEY) : Promise.resolve(null),
    fetchCNJ(raw, docFmt, ""),
  ]);

  // ── Processa Receita Federal ──────────────────────────────────────────────
  if (rfResult.status==="fulfilled" && rfResult.value) {
    const d = rfResult.value;
    report.dadosCadastrais = {
      doc:raw, docFmt, tipo,
      razaoSocial: d.razao_social,
      nomeFantasia: d.nome_fantasia,
      situacao: d.estabelecimento?.situacao_cadastral?.descricao || "—",
      dataAbertura: d.estabelecimento?.data_inicio_atividade,
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
      telefone: d.estabelecimento?.ddd1&&d.estabelecimento?.telefone1 ? d.estabelecimento.ddd1+d.estabelecimento.telefone1 : null,
      email: d.estabelecimento?.email,
    };
    report.socios = (d.socios||d.qsa||[]).map(s=>({
      nome: s.nome||s.nome_socio,
      documento: s.cpf_representante_legal||s.cnpj_cpf_do_socio,
      qualificacao: s.qualificacao_socio?.descricao||s.qualificacao,
      dataInicio: s.data_entrada_sociedade,
    }));
    report.providers.receita="ok";
  } else {
    report.errors.push({provider:"Receita Federal", msg: rfResult.reason?.message||"Falha"});
  }

  // ── Processa Valida API ───────────────────────────────────────────────────
  if (validaResult.status==="fulfilled" && validaResult.value) {
    const d = validaResult.value;

    // Dados cadastrais da Valida (substitui RF se disponível — mais completo)
    const rf = d.dados_receita;
    if (rf) {
      report.dadosCadastrais = {
        doc:raw, docFmt, tipo,
        razaoSocial: rf.basico?.razao_social || report.dadosCadastrais?.razaoSocial,
        nomeFantasia: rf.basico?.nome_fantasia,
        situacao: rf.basico?.situacao || report.dadosCadastrais?.situacao || "—",
        dataAbertura: rf.basico?.data_fundacao || report.dadosCadastrais?.dataAbertura,
        regimeFiscal: d.simples?.simples==="Sim"?"Simples Nacional":d.simples?.mei==="Sim"?"MEI":null,
        naturezaJuridica: rf.basico?.natureza_juridica || report.dadosCadastrais?.naturezaJuridica,
        capitalSocial: parseFloat(rf.basico?.capital_social||report.dadosCadastrais?.capitalSocial||"0"),
        porte: rf.basico?.porte || report.dadosCadastrais?.porte,
        atividadePrincipal: rf.atividades?.principal?.[0] || report.dadosCadastrais?.atividadePrincipal,
        atividadesSecundarias: rf.atividades?.secundarias || report.dadosCadastrais?.atividadesSecundarias || [],
        logradouro: [rf.endereco?.logradouro,rf.endereco?.numero,rf.endereco?.complemento].filter(Boolean).join(", ") || report.dadosCadastrais?.logradouro,
        bairro: rf.endereco?.bairro || report.dadosCadastrais?.bairro,
        cep: rf.endereco?.cep || report.dadosCadastrais?.cep,
        cidade: rf.endereco?.cidade || report.dadosCadastrais?.cidade,
        uf: rf.endereco?.uf || report.dadosCadastrais?.uf,
        telefone: rf.contato?.telefones?.[0]?.telefone || report.dadosCadastrais?.telefone,
        email: rf.contato?.emails?.[0]?.email || report.dadosCadastrais?.email,
      };
      report.socios = (rf.socios||[]).map(s=>({
        nome: s.nome, documento: s.cpf_cnpj,
        qualificacao: s.qualificacao?.descricao||s.qualificacao,
        dataInicio: s.data_entrada,
      }));
    }

    // Protestos
    report.protestos = parseProtestos(d);
    report.providers.validaApi="ok";

  } else if (validaResult.status==="rejected") {
    report.errors.push({provider:"Valida API", msg: validaResult.reason?.message||"Timeout"});
    report.providers.validaApi="timeout";
    // Sem dados de protesto
    report.protestos = {
      status:"indisponivel", quantidade:null, valorTotal:null, registros:[],
      fontes:["CenProt"], linkManual:"https://pesquisaprotesto.com.br",
      obs:"Consulta de protestos demorou mais de 25s. Consulte manualmente.",
    };
  } else if (!VALIDA_KEY) {
    report.protestos = {
      status:"indisponivel", quantidade:null, valorTotal:null, registros:[],
      fontes:["CenProt"], linkManual:"https://pesquisaprotesto.com.br",
      obs:"Configure VALIDA_API_KEY para consulta de protestos.",
    };
  }

  // ── Processa CNJ ──────────────────────────────────────────────────────────
  if (cnjResult.status==="fulfilled" && cnjResult.value) {
    const { acoesEmpresa, acoesSocios } = cnjResult.value;
    // Re-executa com nome da empresa agora disponível
    const nome = report.dadosCadastrais?.razaoSocial || "";
    const cnjResult2 = await fetchCNJ(raw, docFmt, nome).catch(()=>null);
    if (cnjResult2) {
      report.acoesEmpresa = cnjResult2.acoesEmpresa;
      report.acoesSocios  = cnjResult2.acoesSocios;
    } else {
      report.acoesEmpresa = acoesEmpresa;
      report.acoesSocios  = acoesSocios;
    }
    report.providers.cnj="ok";
  } else {
    report.acoesEmpresa = {total:0,lista:[],fonte:"CNJ DataJud"};
    report.acoesSocios  = {total:0,lista:[],fonte:"CNJ DataJud"};
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  report.score = calcularScore(report);

  return res.status(200).json(report);
}

// ── Fetch Receita Federal ─────────────────────────────────────────────────────
async function fetchRF(raw) {
  const r = await fetch(`https://publica.cnpj.ws/cnpj/${raw}`,{
    headers:{"Accept":"application/json","User-Agent":"gbm-intelligence/1.0"},
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`RF: ${r.status}`);
  return r.json();
}

// ── Fetch Valida API ──────────────────────────────────────────────────────────
async function fetchValida(docFmt, key) {
  const r = await fetch("https://valida.api.br/api/v1/cnpj/consult",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
    body: JSON.stringify({cnpj:docFmt, protestos:true, receita_federal:true, simples:true}),
    signal: AbortSignal.timeout(25000), // 25s — deixa tempo para CNJ também
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Valida ${r.status}: ${txt.slice(0,100)}`);
  }
  return r.json();
}

// ── Parse protestos da Valida API ─────────────────────────────────────────────
function parseProtestos(d) {
  const dataArr = Array.isArray(d.data) ? d.data : null;
  const cenprotData = dataArr || d.protestos?.cenprotProtestos || d.cenprotProtestos || null;
  const hasProtests = d.has_protests === true || (dataArr && dataArr.length > 0);
  const totalProtests = parseInt(d.total_protests||dataArr?.length||"0") || 0;

  if (!cenprotData && !hasProtests && d.has_protests === false) {
    return { status:"limpo", quantidade:0, valorTotal:0, registros:[], fontes:["CenProt (Valida API)"], providerPago:"valida.api.br", linkManual:"https://pesquisaprotesto.com.br" };
  }

  if (!cenprotData && hasProtests) {
    return { status:"protestado", quantidade:totalProtests, valorTotal:null, registros:[], fontes:["CenProt (Valida API)"], providerPago:"valida.api.br", linkManual:"https://pesquisaprotesto.com.br", obs:`${totalProtests} protesto(s). Detalhe indisponível — consulte pesquisaprotesto.com.br` };
  }

  if (!cenprotData) {
    return { status:"offline", quantidade:null, valorTotal:null, registros:[], fontes:["CenProt (Valida API)"], providerPago:"valida.api.br", linkManual:"https://pesquisaprotesto.com.br", obs:"Serviço de protestos temporariamente offline." };
  }

  const registros = [];
  let totalTitulos = 0;
  let totalValor = 0;

  if (Array.isArray(cenprotData)) {
    for (const p of cenprotData) {
      totalTitulos++;
      const v = parseValor(p.valor||p.amount||"0");
      totalValor += v;
      registros.push({ valor:v, cartorio:p.cartorio||p.notaryOffice||"—", cidade:p.cidade||p.city||"—", uf:p.uf||p.state||"—", vencimento:p.dataVencimento||p.data_vencimento||"—", dataProtesto:p.dataProtesto||null });
    }
  } else {
    for (const [uf, lista] of Object.entries(cenprotData)) {
      for (const cartorio of (Array.isArray(lista)?lista:[lista])) {
        for (const p of (cartorio.protestos||(cartorio.valor?[cartorio]:[]))) {
          totalTitulos++;
          const v = parseValor(p.valor||"0");
          totalValor += v;
          registros.push({ valor:v, cartorio:cartorio.cartorio||p.cartorio||"—", cidade:cartorio.cidade||p.cidade||"—", uf, vencimento:p.dataVencimento||p.data_vencimento||"—", dataProtesto:p.dataProtesto||null });
        }
      }
    }
  }

  return {
    status: totalTitulos>0?"protestado":"limpo",
    quantidade: totalTitulos, valorTotal: totalValor, registros,
    fontes:["CenProt Nacional (Valida API)"], providerPago:"valida.api.br",
    linkManual:"https://pesquisaprotesto.com.br",
  };
}

// ── Fetch CNJ DataJud ─────────────────────────────────────────────────────────
async function fetchCNJ(raw, docFmt, razaoSocial) {
  const tribunais = [
    {index:"api_publica_tjsp",nome:"TJSP"},
    {index:"api_publica_trt15",nome:"TRT15"},
    {index:"api_publica_trf3",nome:"TRF3"},
    {index:"api_publica_tjmg",nome:"TJMG"},
    {index:"api_publica_trt2",nome:"TRT2"},
  ];

  const fetchTribunal = async (t) => {
    try {
      const should = [{match_phrase:{"partes.documento":raw}},{match_phrase:{"partes.documento":docFmt}}];
      if (razaoSocial) should.push({match_phrase:{"partes.nome":razaoSocial.slice(0,20)}});
      const r = await fetch(`https://api-publica.datajud.cnj.jus.br/${t.index}/_search`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"ApiKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TaEctcWRRbWx4ODZTdw=="},
        body:JSON.stringify({query:{bool:{should}},size:20,sort:[{"dataAjuizamento":{order:"desc"}}]}),
        signal:AbortSignal.timeout(8000),
      });
      if (!r.ok) return {tribunal:t.nome,total:0,lista:[]};
      const d = await r.json();
      return {
        tribunal:t.nome, total:d.hits?.total?.value||0,
        lista:(d.hits?.hits||[]).map(h=>({
          numero:h._source?.numeroProcesso, classe:h._source?.classe?.nome,
          assunto:h._source?.assuntos?.[0]?.nome, tribunal:h._source?.tribunal||t.nome,
          grau:h._source?.grau, dataAjuizamento:h._source?.dataAjuizamento,
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
  const razao = razaoSocial.toUpperCase().slice(0,20);
  const acoesEmpresa = unicos.filter(p=>p.partes?.some(pt=>pt.documento===raw||pt.documento===docFmt||(razao&&pt.nome?.toUpperCase().includes(razao))));
  const acoesSocios  = unicos.filter(p=>!acoesEmpresa.includes(p));
  return {
    acoesEmpresa:{total:resultados.reduce((s,r)=>s+r.total,0),lista:acoesEmpresa,fonte:"CNJ DataJud"},
    acoesSocios:{total:acoesSocios.length,lista:acoesSocios,fonte:"CNJ DataJud"},
  };
}

// ── Score GBM ─────────────────────────────────────────────────────────────────
function calcularScore(r) {
  let pts=1000; const fatores=[];
  const rf=r.dadosCadastrais;
  if (!rf) return {pontos:0,classificacao:"Sem dados",cor:"#64748b",fatores:[],recomendacao:"Dados insuficientes."};

  const sit=(rf.situacao||"").toUpperCase();
  if(sit.includes("ATIVA")) fatores.push({label:"Situação cadastral ativa",impacto:0,positivo:true});
  else if(sit&&sit!=="—"){pts-=300;fatores.push({label:`Situação: ${rf.situacao}`,impacto:-300,positivo:false});}

  const anos=rf.dataAbertura?(Date.now()-new Date(rf.dataAbertura))/(1000*60*60*24*365):0;
  if(anos>=5) fatores.push({label:`${Math.floor(anos)} anos de atividade`,impacto:0,positivo:true});
  else if(anos>=2){pts-=50;fatores.push({label:"Empresa 2–5 anos",impacto:-50,positivo:false});}
  else if(anos>0){pts-=150;fatores.push({label:"Empresa < 2 anos",impacto:-150,positivo:false});}

  const cap=rf.capitalSocial||0;
  if(cap>=1000000) fatores.push({label:`Capital R$${(cap/1e6).toFixed(1)}M`,impacto:0,positivo:true});
  else if(cap>=100000){pts-=30;fatores.push({label:"Capital R$100K–1M",impacto:-30,positivo:false});}
  else if(cap>0){pts-=100;fatores.push({label:"Capital baixo",impacto:-100,positivo:false});}

  const prot=r.protestos;
  if(prot?.status==="limpo") fatores.push({label:"Sem protestos em cartório",impacto:0,positivo:true});
  else if(prot?.status==="protestado"){
    const qtd=prot.quantidade||1, ded=Math.min(qtd*80,350);
    pts-=ded;
    const val=prot.valorTotal?` — R$${prot.valorTotal.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"";
    fatores.push({label:`${qtd} protesto(s)${val}`,impacto:-ded,positivo:false});
  } else if(prot?.status==="offline"){pts-=50;fatores.push({label:"Protestos: serviço offline — verificar",impacto:-50,positivo:false});}
  else{pts-=30;fatores.push({label:"Protestos: verificar manualmente",impacto:-30,positivo:false});}

  const pe=r.acoesEmpresa?.total||0;
  if(pe===0) fatores.push({label:"Sem processos da empresa",impacto:0,positivo:true});
  else if(pe<=5){pts-=80;fatores.push({label:`${pe} processo(s) da empresa`,impacto:-80,positivo:false});}
  else{pts-=200;fatores.push({label:`${pe} processos da empresa`,impacto:-200,positivo:false});}

  const ps=r.acoesSocios?.total||0;
  if(ps>5){pts-=100;fatores.push({label:`${ps} processos dos sócios`,impacto:-100,positivo:false});}
  else if(ps>0){pts-=40;fatores.push({label:`${ps} processo(s) dos sócios`,impacto:-40,positivo:false});}

  pts=Math.max(0,Math.min(1000,pts));
  let cl,cor,rec;
  if(pts>=800){cl="A — Excelente";cor="#10b981";rec="Baixo risco. Crédito recomendado.";}
  else if(pts>=600){cl="B — Bom";cor="#84cc16";rec="Risco baixo. Crédito com monitoramento.";}
  else if(pts>=400){cl="C — Regular";cor="#f59e0b";rec="Risco moderado. Exigir garantias.";}
  else if(pts>=200){cl="D — Alto risco";cor="#f97316";rec="Risco elevado. Venda apenas à vista.";}
  else{cl="E — Crítico";cor="#ef4444";rec="Risco muito alto. Não conceder crédito.";}
  return{pontos:pts,classificacao:cl,cor,recomendacao:rec,fatores};
}
