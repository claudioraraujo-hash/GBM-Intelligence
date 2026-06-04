// GBM Intelligence — Crédito v4 — Valida API

const isCNPJ = (d) => d.replace(/\D/g,"").length === 14;
const isCPF  = (d) => d.replace(/\D/g,"").length === 11;
const fmtCNPJ = (v) => v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");
const fmtCPF  = (v) => v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,"$1.$2.$3-$4");

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

  // ── 1. VALIDA API ─────────────────────────────────────────────────────────
  if (VALIDA_KEY) {
    try {
      const r = await fetch("https://valida.api.br/api/v1/cnpj/consult", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${VALIDA_KEY}`,
        },
        body: JSON.stringify({
          cnpj: docFmt,
          protestos: true,
          receita_federal: true,
          simples: true,
        }),
        signal: AbortSignal.timeout(45000),
      });

      const responseText = await r.text();

      if (!r.ok) {
        throw new Error(`Valida API ${r.status}: ${responseText.slice(0,200)}`);
      }

      const d = JSON.parse(responseText);

      // Dados cadastrais
      const rf = d.dados_receita || d.receita || d;
      report.dadosCadastrais = {
        doc:raw, docFmt, tipo,
        razaoSocial: rf.basico?.razao_social || rf.razao_social || d.razao_social,
        nomeFantasia: rf.basico?.nome_fantasia || rf.nome_fantasia || d.nome_fantasia,
        situacao: rf.basico?.situacao || rf.situacao || d.situacao,
        dataAbertura: rf.basico?.data_fundacao || rf.data_abertura || d.data_abertura,
        regimeFiscal: d.simples?.simples==="Sim"?"Simples Nacional":d.simples?.mei==="Sim"?"MEI":null,
        naturezaJuridica: rf.basico?.natureza_juridica || rf.natureza_juridica,
        capitalSocial: parseFloat(rf.basico?.capital_social || rf.capital_social || d.capital_social || "0"),
        porte: rf.basico?.porte || rf.porte || d.porte,
        atividadePrincipal: rf.atividades?.principal?.[0] || rf.atividade_principal || d.atividade_principal,
        atividadesSecundarias: rf.atividades?.secundarias || rf.atividades_secundarias || [],
        logradouro: [rf.endereco?.logradouro||d.logradouro, rf.endereco?.numero||d.numero, rf.endereco?.complemento||d.complemento].filter(Boolean).join(", "),
        bairro: rf.endereco?.bairro || d.bairro,
        cep: rf.endereco?.cep || d.cep,
        cidade: rf.endereco?.cidade || d.municipio,
        uf: rf.endereco?.uf || d.uf,
        telefone: rf.contato?.telefones?.[0]?.telefone || d.ddd_telefone_1 || null,
        email: rf.contato?.emails?.[0]?.email || d.email || null,
        _rawKeys: Object.keys(d), // diagnóstico — remove depois
      };

      // Sócios
      report.socios = (rf.socios || d.socios || d.qsa || []).map(s=>({
        nome: s.nome || s.nome_socio,
        documento: s.cpf_cnpj || s.cpf_representante_legal,
        qualificacao: s.qualificacao?.descricao || s.qualificacao,
        dataInicio: s.data_entrada,
      }));

      // Protestos — lê has_protests/total_protests da raiz + cenprotProtestos quando disponível
      // Log expandido — ver estrutura real do array d.data
      const dataArr = Array.isArray(d.data) ? d.data : null;
      report._validaRaw = {
        has_protests: d.has_protests,
        total_protests: d.total_protests,
        success: d.success,
        error: d.error,
        data_is_array: Array.isArray(d.data),
        data_length: dataArr?.length,
        data_sample: dataArr ? dataArr.slice(0,3) : d.data,
        protestos_type: typeof d.protestos,
        protestos_value: d.protestos,
      };

      const hasProtests   = d.has_protests === true;
      const totalProtests = parseInt(d.total_protests || "0") || 0;
      const protestosData = d.data || d.protestos?.cenprotProtestos || d.cenprotProtestos || null;
      const protestosObj  = d.protestos || {};
      const isOffline     = !d.has_protests && d.has_protests !== false && !protestosData;

      if (isOffline) {
        // Serviço offline — sem campo has_protests nem dados
        report.protestos = {
          status: "offline",
          quantidade: null,
          valorTotal: null,
          registros: [],
          fontes: ["CenProt Nacional (Valida API)"],
          providerPago: "valida.api.br",
          linkManual: "https://pesquisaprotesto.com.br",
          obs: "Serviço de protestos temporariamente offline. Consulte manualmente.",
        };
      } else if (hasProtests && protestosData && typeof protestosData === "object") {
        // Tem protestos com detalhes
        const registros = [];
        let totalTitulos = 0;
        let totalValor = 0;

        const entries = Array.isArray(protestosData)
          ? protestosData.map(p => [p.uf || "BR", [p]])
          : Object.entries(protestosData);

        for (const [uf, cartoriosList] of entries) {
          const lista = Array.isArray(cartoriosList) ? cartoriosList : [cartoriosList];
          for (const cartorio of lista) {
            const protestosList = cartorio.protestos || (cartorio.valor ? [cartorio] : []);
            for (const p of protestosList) {
              totalTitulos++;
              const valorNum = parseFloat(
                String(p.valor||"0").replace(/[R$\s.]/g,"").replace(",",".")
              ) || 0;
              totalValor += valorNum;
              registros.push({
                valor: valorNum,
                cartorio: cartorio.cartorio || p.cartorio || "—",
                cidade: cartorio.cidade || p.cidade || "—",
                uf: uf,
                vencimento: p.dataVencimento || p.data_vencimento || "—",
                dataProtesto: p.dataProtesto || p.data_protesto || null,
              });
            }
          }
        }
        report.protestos = {
          status: "protestado",
          quantidade: totalTitulos || totalProtests,
          valorTotal: totalValor || null,
          registros,
          fontes: ["CenProt Nacional (Valida API)"],
          providerPago: "valida.api.br",
          linkManual: "https://pesquisaprotesto.com.br",
        };
      } else if (hasProtests && !protestosData) {
        // Tem protestos mas sem detalhes (serviço parcialmente online)
        report.protestos = {
          status: "protestado",
          quantidade: totalProtests || null,
          valorTotal: null,
          registros: [],
          fontes: ["CenProt Nacional (Valida API)"],
          providerPago: "valida.api.br",
          linkManual: "https://pesquisaprotesto.com.br",
          obs: `${totalProtests} protesto(s) encontrado(s). Detalhes indisponíveis no momento — consulte pesquisaprotesto.com.br`,
        };
      } else {
        // Sem protestos
        report.protestos = {
          status: "limpo",
          quantidade: 0,
          valorTotal: 0,
          registros: [],
          fontes: ["CenProt Nacional (Valida API)"],
          providerPago: "valida.api.br",
          linkManual: "https://pesquisaprotesto.com.br",
        };
      }

      report.providers.validaApi = "ok";

    } catch(e) {
      report.errors.push({ provider:"Valida API", msg: e.message });
      report.providers.validaApi = "error:" + e.message.slice(0,100);
      // Fallback RF gratuita
      await fetchRF(raw, report);
    }
  } else {
    report.errors.push({ provider:"Valida API", msg:"VALIDA_API_KEY não encontrada nas variáveis de ambiente" });
    await fetchRF(raw, report);
  }

  // ── 2. PROCESSOS CNJ ──────────────────────────────────────────────────────
  const tribunais = [
    {index:"api_publica_tjsp",nome:"TJSP"},
    {index:"api_publica_trt15",nome:"TRT15"},
    {index:"api_publica_trf3",nome:"TRF3"},
    {index:"api_publica_tjmg",nome:"TJMG"},
  ];

  const fetchTribunal = async (t) => {
    try {
      const should = [{match_phrase:{"partes.documento":raw}},{match_phrase:{"partes.documento":docFmt}}];
      if (report.dadosCadastrais?.razaoSocial) {
        // Usa os primeiros 15 chars para match parcial (evita diferenças de grafia)
        const nomeSlice = report.dadosCadastrais.razaoSocial.slice(0,15);
        should.push({match_phrase:{"partes.nome":nomeSlice}});
      }
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
  const acoesEmpresa = unicos.filter(p=>p.partes?.some(pt=>pt.documento===raw||pt.documento===docFmt||(razao&&pt.nome?.toUpperCase().includes(razao))));
  const acoesSocios  = unicos.filter(p=>!acoesEmpresa.includes(p));
  report.acoesEmpresa={total:resultados.reduce((s,r)=>s+r.total,0),lista:acoesEmpresa,fonte:"CNJ DataJud"};
  report.acoesSocios ={total:acoesSocios.length,lista:acoesSocios,fonte:"CNJ DataJud"};
  report.providers.cnj="ok";

  // ── 3. SCORE ──────────────────────────────────────────────────────────────
  report.score = calcularScore(report);

  return res.status(200).json(report);
}

async function fetchRF(raw, report) {
  try {
    const r = await fetch(`https://publica.cnpj.ws/cnpj/${raw}`,{
      headers:{"Accept":"application/json","User-Agent":"gbm-intelligence/1.0"},
      signal:AbortSignal.timeout(10000),
    });
    if (!r.ok) return;
    const d = await r.json();
    const docFmt = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");
    report.dadosCadastrais = {
      doc:raw,docFmt,tipo:"CNPJ",
      razaoSocial:d.razao_social,nomeFantasia:d.nome_fantasia,
      situacao:d.estabelecimento?.situacao_cadastral?.descricao,
      dataAbertura:d.estabelecimento?.data_inicio_atividade,
      naturezaJuridica:d.natureza_juridica?.descricao,
      capitalSocial:parseFloat(d.capital_social||"0"),
      porte:d.porte?.descricao,
      atividadePrincipal:d.estabelecimento?.atividade_principal,
      atividadesSecundarias:d.estabelecimento?.atividades_secundarias||[],
      logradouro:[d.estabelecimento?.tipo_logradouro,d.estabelecimento?.logradouro,d.estabelecimento?.numero,d.estabelecimento?.complemento].filter(Boolean).join(" "),
      bairro:d.estabelecimento?.bairro,cep:d.estabelecimento?.cep,
      cidade:d.estabelecimento?.cidade?.nome,uf:d.estabelecimento?.estado?.sigla,
      telefone:d.estabelecimento?.ddd1&&d.estabelecimento?.telefone1?d.estabelecimento.ddd1+d.estabelecimento.telefone1:null,
      email:d.estabelecimento?.email,
    };
    report.socios=(d.socios||d.qsa||[]).map(s=>({nome:s.nome||s.nome_socio,documento:s.cpf_representante_legal||s.cnpj_cpf_do_socio,qualificacao:s.qualificacao_socio?.descricao||s.qualificacao,dataInicio:s.data_entrada_sociedade}));
    if (!report.protestos) report.protestos={status:"indisponivel",quantidade:null,valorTotal:null,registros:[],fontes:["CENPROT"],linkManual:"https://pesquisaprotesto.com.br",obs:"Ative VALIDA_API_KEY para protestos."};
    report.providers.receita="ok (fallback)";
  } catch(e) { report.errors.push({provider:"Receita Federal",msg:e.message}); }
}

function calcularScore(r) {
  let pts=1000; const fatores=[];
  const rf=r.dadosCadastrais;
  if (!rf) return {pontos:0,classificacao:"Sem dados",cor:"#64748b",fatores:[],recomendacao:"Dados insuficientes."};

  const sit=(rf.situacao||"").toUpperCase();
  if(sit.includes("ATIVA")) fatores.push({label:"Situação cadastral ativa",impacto:0,positivo:true});
  else{pts-=300;fatores.push({label:`Situação: ${rf.situacao}`,impacto:-300,positivo:false});}

  const anos=rf.dataAbertura?(Date.now()-new Date(rf.dataAbertura))/(1000*60*60*24*365):0;
  if(anos>=5) fatores.push({label:`${Math.floor(anos)} anos de atividade`,impacto:0,positivo:true});
  else if(anos>=2){pts-=50;fatores.push({label:"Empresa 2–5 anos",impacto:-50,positivo:false});}
  else{pts-=150;fatores.push({label:"Empresa < 2 anos",impacto:-150,positivo:false});}

  const cap=rf.capitalSocial||0;
  if(cap>=1000000) fatores.push({label:`Capital R$${(cap/1e6).toFixed(1)}M`,impacto:0,positivo:true});
  else if(cap>=100000){pts-=30;fatores.push({label:"Capital R$100K–1M",impacto:-30,positivo:false});}
  else{pts-=100;fatores.push({label:"Capital baixo",impacto:-100,positivo:false});}

  const prot=r.protestos;
  if(prot?.status==="limpo") fatores.push({label:"Sem protestos em cartório",impacto:0,positivo:true});
  else if(prot?.status==="protestado"){const qtd=prot.quantidade||1,ded=Math.min(qtd*80,350);pts-=ded;fatores.push({label:`${qtd} protesto(s)${prot.valorTotal?` — R$${prot.valorTotal.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:""}`,impacto:-ded,positivo:false});}
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
