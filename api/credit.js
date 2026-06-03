// ─── GBM Intelligence — Módulo de Crédito ────────────────────────────────────
// Arquitetura modular: cada provider é independente e plugável
// Para adicionar API paga: implemente o provider correspondente e remova o mock

// ── Configuração de providers (ative conforme contratar) ──────────────────────
const PROVIDERS = {
  serasa:  { enabled: false, apiKey: process.env.SERASA_API_KEY  || "" },
  netrin:  { enabled: false, apiKey: process.env.NETRIN_API_KEY  || "" },
  boavista:{ enabled: false, apiKey: process.env.BOAVISTA_API_KEY|| "" },
  cnj:     { enabled: true  }, // gratuito
  cenprot: { enabled: true  }, // gratuito
  receita: { enabled: true  }, // gratuito
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { cnpj } = req.query;
  if (!cnpj || cnpj.replace(/\D/g,"").length !== 14)
    return res.status(400).json({ error: "CNPJ inválido." });

  const raw = cnpj.replace(/\D/g,"");
  const report = {
    cnpj: raw,
    geradoEm: new Date().toISOString(),
    providers: {},
    dadosCadastrais: null,
    restricaoFinanceira: null,
    protestos: null,
    cheques: null,
    acoesEmpresa: null,
    acoesSocios: null,
    socios: null,
    funcionarios: null,
    enderecos: null,
    score: null,
    errors: [],
  };

  // ── 1. RECEITA FEDERAL (gratuito) ─────────────────────────────────────────
  if (PROVIDERS.receita.enabled) {
    try {
      const r = await fetch(`https://publica.cnpj.ws/cnpj/${raw}`, {
        headers: { "Accept":"application/json","User-Agent":"gbm-intelligence/1.0" },
        signal: AbortSignal.timeout(10000)
      });
      if (r.ok) {
        const d = await r.json();
        report.dadosCadastrais = {
          cnpj: raw,
          razaoSocial: d.razao_social,
          nomeFantasia: d.nome_fantasia,
          situacao: d.estabelecimento?.situacao_cadastral?.descricao,
          dataAbertura: d.estabelecimento?.data_inicio_atividade,
          dataFechamento: d.estabelecimento?.data_situacao_cadastral,
          regimeFiscal: d.regime_tributario?.descricao || null,
          naturezaJuridica: d.natureza_juridica?.descricao,
          capitalSocial: parseFloat(d.capital_social || "0"),
          porte: d.porte?.descricao,
          atividadePrincipal: d.estabelecimento?.atividade_principal,
          atividadesSecundarias: d.estabelecimento?.atividades_secundarias || [],
          logradouro: [d.estabelecimento?.tipo_logradouro,d.estabelecimento?.logradouro,d.estabelecimento?.numero,d.estabelecimento?.complemento].filter(Boolean).join(" "),
          bairro: d.estabelecimento?.bairro,
          cep: d.estabelecimento?.cep,
          cidade: d.estabelecimento?.cidade?.nome,
          uf: d.estabelecimento?.estado?.sigla,
          telefone: d.estabelecimento?.ddd1&&d.estabelecimento?.telefone1 ? d.estabelecimento.ddd1+d.estabelecimento.telefone1 : null,
          email: d.estabelecimento?.email,
        };
        // Sócios da RF
        report.socios = (d.socios || d.qsa || []).map(s => ({
          nome: s.nome || s.nome_socio,
          documento: s.cpf_representante_legal || s.cnpj_cpf_do_socio,
          qualificacao: s.qualificacao_socio?.descricao || s.qualificacao,
          dataInicio: s.data_entrada_sociedade,
          dataFim: null,
          fonte: "Receita Federal",
        }));
        report.providers.receita = "ok";
      }
    } catch(e) {
      report.errors.push({ provider:"Receita Federal", msg: e.message });
      report.providers.receita = "error";
    }
  }

  // ── 2. PROTESTOS — CENPROT (gratuito, indicativo) ────────────────────────
  if (PROVIDERS.cenprot.enabled) {
    try {
      const r = await fetch("https://pesquisaprotesto.com.br/consulta", {
        method: "POST",
        headers: { "Content-Type":"application/x-www-form-urlencoded","User-Agent":"Mozilla/5.0" },
        body: new URLSearchParams({ documento: raw, tipo:"J" }).toString(),
        signal: AbortSignal.timeout(8000)
      });
      const html = await r.text();
      const limpo = /n[ãa]o\s+possui|sem\s+protesto|nenhum\s+protesto/i.test(html);
      const protestado = /possui\s+protesto|cartório|tabelionato/i.test(html);
      const qtd = (html.match(/(\d+)\s+protesto/i)||[])[1];

      report.protestos = {
        status: limpo ? "limpo" : protestado ? "protestado" : "verificar",
        quantidade: limpo ? 0 : qtd ? parseInt(qtd) : null,
        valorTotal: null,       // ← Preenchido pela API paga (Serasa/Netrin)
        registros: [],          // ← Preenchido pela API paga (valor, cartório, vencimento)
        fonte: "CENPROT (indicativo)",
        linkManual: "https://pesquisaprotesto.com.br",
        providerPago: null,     // ← "serasa" | "netrin" quando ativo
      };
      report.providers.cenprot = "ok";
    } catch(e) {
      report.protestos = { status:"indisponivel", quantidade:null, valorTotal:null, registros:[], fonte:"CENPROT", linkManual:"https://pesquisaprotesto.com.br" };
      report.errors.push({ provider:"CENPROT", msg: e.message });
      report.providers.cenprot = "error";
    }
  }

  // ── 3. SERASA / NETRIN (pago — descomente quando ativar) ─────────────────
  // SLOT SERASA:
  // if (PROVIDERS.serasa.enabled && PROVIDERS.serasa.apiKey) {
  //   try {
  //     const r = await fetch(`https://api.serasaexperian.com.br/background-check/v2/consumers/${raw}`, {
  //       headers: { "Authorization": `Bearer ${PROVIDERS.serasa.apiKey}`, "Accept":"application/json" }
  //     });
  //     const d = await r.json();
  //     report.restricaoFinanceira = {
  //       score: d.scores?.[0]?.score,
  //       classificacao: d.scores?.[0]?.scoreModel,
  //       mensagem: d.scores?.[0]?.message,
  //       totalDebitos: d.negativeData?.debts?.summary?.count,
  //       valorDebitos: d.negativeData?.debts?.summary?.balance,
  //       fonte: "Serasa Experian",
  //     };
  //     // Protestos com valor detalhado
  //     report.protestos.registros = (d.negativeData?.protests?.protestList || []).map(p => ({
  //       valor: p.amount, cartorio: p.notaryOffice, cidade: p.city, uf: p.state, vencimento: p.occurrenceDate
  //     }));
  //     report.protestos.valorTotal = d.negativeData?.protests?.summary?.balance;
  //     report.protestos.quantidade = d.negativeData?.protests?.summary?.count;
  //     report.protestos.providerPago = "serasa";
  //     report.providers.serasa = "ok";
  //   } catch(e) { report.errors.push({ provider:"Serasa", msg: e.message }); report.providers.serasa = "error"; }
  // }

  // SLOT NETRIN (alternativa mais acessível ao Serasa):
  // if (PROVIDERS.netrin.enabled && PROVIDERS.netrin.apiKey) {
  //   try {
  //     const r = await fetch(`https://api.netrin.com.br/v1/cnpj/${raw}/credito`, {
  //       headers: { "x-api-key": PROVIDERS.netrin.apiKey, "Accept":"application/json" }
  //     });
  //     const d = await r.json();
  //     report.restricaoFinanceira = {
  //       score: d.score?.valor,
  //       classificacao: d.score?.classificacao,
  //       mensagem: d.score?.descricao,
  //       totalDebitos: d.debitos?.quantidade,
  //       valorDebitos: d.debitos?.valor_total,
  //       fonte: "Netrin",
  //     };
  //     report.protestos.registros = (d.protestos?.lista || []).map(p => ({
  //       valor: p.valor, cartorio: p.cartorio, cidade: p.cidade, uf: p.uf, vencimento: p.data_vencimento
  //     }));
  //     report.protestos.valorTotal = d.protestos?.valor_total;
  //     report.protestos.quantidade = d.protestos?.quantidade;
  //     report.protestos.providerPago = "netrin";
  //     report.providers.netrin = "ok";
  //   } catch(e) { report.errors.push({ provider:"Netrin", msg: e.message }); report.providers.netrin = "error"; }
  // }

  // ── 4. PROCESSOS JUDICIAIS — CNJ DataJud (gratuito) ──────────────────────
  if (PROVIDERS.cnj.enabled) {
    const tribunais = [
      { index:"api_publica_tjsp", nome:"TJSP" },
      { index:"api_publica_trt15", nome:"TRT15" },
      { index:"api_publica_trf3", nome:"TRF3/JFSP" },
    ];
    const cnpjFormatado = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5");

    const fetchTribunal = async (t) => {
      try {
        const r = await fetch(`https://api-publica.datajud.cnj.jus.br/${t.index}/_search`, {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            "Authorization":"ApiKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TaEctcWRRbWx4ODZTdw=="
          },
          body: JSON.stringify({
            query:{ bool:{ should:[
              { match_phrase:{ "partes.nome": report.dadosCadastrais?.razaoSocial || "" }},
              { match_phrase:{ "partes.documento": raw }},
              { match_phrase:{ "partes.documento": cnpjFormatado }},
            ]}},
            size:20,
            sort:[{ "dataAjuizamento":{ order:"desc" }}]
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) return { tribunal: t.nome, total:0, lista:[] };
        const d = await r.json();
        return {
          tribunal: t.nome,
          total: d.hits?.total?.value || 0,
          lista: (d.hits?.hits||[]).map(h => ({
            numero: h._source?.numeroProcesso,
            classe: h._source?.classe?.nome,
            assunto: h._source?.assuntos?.[0]?.nome,
            tribunal: h._source?.tribunal || t.nome,
            grau: h._source?.grau,
            dataAjuizamento: h._source?.dataAjuizamento,
            situacao: h._source?.movimentos?.[0]?.nome,
            partes: (h._source?.partes||[]).map(p=>({ nome:p.nome, polo:p.polo, documento:p.documento })),
          }))
        };
      } catch { return { tribunal: t.nome, total:0, lista:[] }; }
    };

    const resultados = await Promise.all(tribunais.map(fetchTribunal));
    const todos = resultados.flatMap(r => r.lista);
    const totalGeral = resultados.reduce((s,r)=>s+r.total,0);

    // Separa: empresa vs sócios
    const razao = (report.dadosCadastrais?.razaoSocial||"").toUpperCase();
    const acoesEmpresa = todos.filter(p =>
      p.partes?.some(pt => pt.nome?.toUpperCase().includes(razao.slice(0,15)) || pt.documento===raw)
    );
    const acoesSocios = todos.filter(p =>
      !acoesEmpresa.includes(p) &&
      p.partes?.some(pt => pt.polo?.toLowerCase()==="passivo"||pt.polo?.toLowerCase()==="ativo")
    );

    report.acoesEmpresa = { total: acoesEmpresa.length, lista: acoesEmpresa, fonte:"CNJ DataJud" };
    report.acoesSocios  = { total: acoesSocios.length,  lista: acoesSocios,  fonte:"CNJ DataJud" };
    report.providers.cnj = "ok";
  }

  // ── 5. CHEQUES DEVOLVIDOS — Banco Central (requer cadastro) ──────────────
  // SLOT BCB:
  // if (PROVIDERS.bcb?.enabled) {
  //   // API do Banco Central — requer credencial institucional
  //   // https://opendata.bcb.gov.br/
  //   report.cheques = { total:0, valor:0, lista:[], fonte:"Banco Central" };
  // }
  report.cheques = { total:0, valor:0, lista:[], fonte:"Banco Central", status:"slot_disponivel" };

  // ── 6. SCORE GBM (calculado) ──────────────────────────────────────────────
  report.score = calcularScore(report);

  return res.status(200).json(report);
}

function calcularScore(r) {
  let pts = 1000;
  const fatores = [];

  const rf = r.dadosCadastrais;
  if (!rf) return { pontos:0, classificacao:"Sem dados", cor:"#64748b", fatores:[], recomendacao:"Dados insuficientes." };

  // Situação cadastral
  const sit = (rf.situacao||"").toUpperCase();
  if (sit.includes("ATIVA")) fatores.push({ label:"Situação cadastral ativa", impacto:0, positivo:true });
  else { pts-=300; fatores.push({ label:`Situação: ${rf.situacao}`, impacto:-300, positivo:false }); }

  // Tempo de empresa
  const anos = rf.dataAbertura ? (Date.now()-new Date(rf.dataAbertura))/(1000*60*60*24*365) : 0;
  if (anos>=5) fatores.push({ label:`${Math.floor(anos)} anos de atividade`, impacto:0, positivo:true });
  else if (anos>=2) { pts-=50; fatores.push({ label:"Empresa entre 2-5 anos", impacto:-50, positivo:false }); }
  else { pts-=150; fatores.push({ label:"Empresa com menos de 2 anos", impacto:-150, positivo:false }); }

  // Capital social
  const cap = rf.capitalSocial||0;
  if (cap>=1000000) fatores.push({ label:`Capital social R$${(cap/1e6).toFixed(1)}M`, impacto:0, positivo:true });
  else if (cap>=100000) { pts-=30; fatores.push({ label:"Capital social entre R$100K–1M", impacto:-30, positivo:false }); }
  else { pts-=100; fatores.push({ label:"Capital social baixo", impacto:-100, positivo:false }); }

  // Protestos
  const prot = r.protestos;
  if (prot?.status==="limpo") {
    fatores.push({ label:"Sem protestos em cartório", impacto:0, positivo:true });
  } else if (prot?.status==="protestado") {
    const qtd = prot.quantidade||1;
    const val = prot.valorTotal;
    const ded = Math.min(qtd*80, 350);
    pts-=ded;
    fatores.push({ label:`${qtd} protesto(s)${val?` — R$${val.toLocaleString("pt-BR",{minimumFractionDigits:2})}`:""}`, impacto:-ded, positivo:false });
  } else if (prot?.status==="indisponivel") {
    pts-=30;
    fatores.push({ label:"Protestos não verificados", impacto:-30, positivo:false });
  }

  // Processos judiciais empresa
  const procEmp = r.acoesEmpresa?.total||0;
  if (procEmp===0) fatores.push({ label:"Sem processos judiciais da empresa", impacto:0, positivo:true });
  else if (procEmp<=5) { pts-=80; fatores.push({ label:`${procEmp} processo(s) da empresa`, impacto:-80, positivo:false }); }
  else { pts-=200; fatores.push({ label:`${procEmp} processos da empresa`, impacto:-200, positivo:false }); }

  // Processos sócios
  const procSoc = r.acoesSocios?.total||0;
  if (procSoc>5) { pts-=100; fatores.push({ label:`${procSoc} processos dos sócios`, impacto:-100, positivo:false }); }
  else if (procSoc>0) { pts-=40; fatores.push({ label:`${procSoc} processo(s) dos sócios`, impacto:-40, positivo:false }); }

  // Cheques devolvidos
  if (r.cheques?.total>0) { pts-=150; fatores.push({ label:`${r.cheques.total} cheque(s) devolvido(s)`, impacto:-150, positivo:false }); }

  // Score externo (Serasa/Netrin) se disponível
  if (r.restricaoFinanceira?.score) {
    const scoreExt = parseInt(r.restricaoFinanceira.score);
    if (scoreExt<300) { pts-=200; fatores.push({ label:`Score ${r.restricaoFinanceira.fonte}: ${scoreExt}`, impacto:-200, positivo:false }); }
    else if (scoreExt<600) { pts-=80; fatores.push({ label:`Score ${r.restricaoFinanceira.fonte}: ${scoreExt}`, impacto:-80, positivo:false }); }
    else fatores.push({ label:`Score ${r.restricaoFinanceira.fonte}: ${scoreExt}`, impacto:0, positivo:true });
  }

  pts = Math.max(0, Math.min(1000, pts));

  let cl, cor, rec;
  if      (pts>=800){ cl="A — Excelente"; cor="#10b981"; rec="Baixo risco. Crédito recomendado sem restrições."; }
  else if (pts>=600){ cl="B — Bom";       cor="#84cc16"; rec="Risco baixo. Crédito recomendado com monitoramento."; }
  else if (pts>=400){ cl="C — Regular";   cor="#f59e0b"; rec="Risco moderado. Exigir garantias e limitar prazo."; }
  else if (pts>=200){ cl="D — Alto risco";cor="#f97316"; rec="Risco elevado. Venda apenas à vista ou com garantia real."; }
  else              { cl="E — Crítico";   cor="#ef4444"; rec="Risco muito alto. Não conceder crédito."; }

  return { pontos:pts, classificacao:cl, cor, recomendacao:rec, fatores, fonte:"Score GBM Intelligence (indicativo)" };
}
