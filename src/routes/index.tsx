import { createFileRoute } from "@tanstack/react-router";
import TrackupDashboard, { type MetaDashboardSummary } from "../components/TrackupDashboard";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Megaphone, Plug, Pencil, RefreshCw, Eye, EyeOff, Download, X, Menu, Facebook, Search } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });
const metaOauthEndpoint = "https://ystxfmrhbqybdilmuzwc.supabase.co/functions/v1/meta-oauth-callback";
const allCards = ["Faturamento", "Lucro operacional", "Gasto em Ads", "CPA", "ARPU", "ROAS", "ROI", "CPC", "CTR", "CPM", "Vendas aprovadas", "Vendas pendentes", "Chargeback", "Margem", "Cliques", "Impressões", "Checkouts iniciados"];
const allCols = ["Status", "Campanha", "Última atualização", "Orçamento", "Gasto", "Vendas Meta", "Vendas TrackUp", "Vendas pendentes", "Faturamento", "Lucro", "ROAS", "CPA", "ARPU", "Impressões", "Cliques", "CPC", "CTR"];
const periods = ["Hoje", "Ontem", "7 dias", "15 dias", "30 dias", "Personalizado"];
const defaults = ["Gasto em Ads","Faturamento","Vendas aprovadas","ROAS","CPA","ARPU","CPC","CTR","CPM","Cliques","Impressões","Checkouts iniciados"];
const defaultCols = ["Status","Campanha","Orçamento","Gasto","Vendas Meta","Faturamento","ROAS","CPA","ARPU","Impressões","Cliques","CPC","CTR"];
function Home() {
  const [page, setPage] = useState("Painel");
  const [period, setPeriod] = useState("Hoje");
  const [cards, setCards] = useState<string[]>(defaults);
  const [cols, setCols] = useState<string[]>(defaultCols);
  const [edit, setEdit] = useState<"cards" | "cols" | null>(null);
  const [hide, setHide] = useState(false);
  const [tab, setTab] = useState("Campanhas");
  const [integration, setIntegration] = useState("Facebook Ads");
  const [status, setStatus] = useState("Qualquer");
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [updated, setUpdated] = useState("");
  const [metaSession, setMetaSession] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<{email:string;name:string|null}|null>(null);
  const [metaTokenExpiresAt, setMetaTokenExpiresAt] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [oauthMessage, setOauthMessage] = useState("");
  const [metaConnections, setMetaConnections] = useState<Array<{meta_user_id:string;name:string|null;expires_at:string|null}>>([]);
  const [adAccounts, setAdAccounts] = useState<Array<{id:string;name:string;account_status:number;currency:string}>>([]);
  const [hiddenAccountIds,setHiddenAccountIds]=useState<string[]>([]);
  const [visibilityLoaded,setVisibilityLoaded]=useState(false);
  useEffect(()=>{
    try{
      const stored=JSON.parse(localStorage.getItem("trackup.meta.hidden-accounts.v1")||"[]");
      if(Array.isArray(stored))setHiddenAccountIds(stored.filter((id):id is string=>typeof id==="string"&&/^act_\d+$/.test(id)));
    }catch{}
    setVisibilityLoaded(true);
  },[]);
  useEffect(()=>{
    if(visibilityLoaded)localStorage.setItem("trackup.meta.hidden-accounts.v1",JSON.stringify(hiddenAccountIds));
  },[visibilityLoaded,hiddenAccountIds]);
  const visibleAccounts=adAccounts.filter(a=>visibilityLoaded&&!hiddenAccountIds.includes(a.id));
  const setAccountEnabled=(id:string,enabled:boolean)=>{
    setHiddenAccountIds(old=>enabled?old.filter(x=>x!==id):Array.from(new Set([...old,id])));
    if(!enabled && selectedAccount===id){
      setSummary(null);setCampaigns([]);setEntityRows([]);setLastMetaUpdate("");
    }
  };
  const enableAllAccounts=()=>setHiddenAccountIds([]);
  const hideAllAccounts=()=>setHiddenAccountIds(old=>Array.from(new Set([...old,...adAccounts.map(a=>a.id)])));
  const [accountWarning, setAccountWarning] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [summary, setSummary] = useState<MetaDashboardSummary|null>(null);
  const [lastMetaUpdate, setLastMetaUpdate] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncIssue, setSyncIssue] = useState("");
  const summaryLock = useRef(false);
  const campaignsLock = useRef(false);
  const accountsLock = useRef(false);
  const throttleUntil = useRef(0);
  const syncAccount = useRef("");

  const [selectedAccount, setSelectedAccount] = useState("");
  const [campaigns, setCampaigns] = useState<Array<{id:string;name:string;status:string;effective_status:string;daily_budget:string|null;lifetime_budget:string|null;spend:number;impressions:number;clicks:number;cpc:number;ctr:number;cpm:number;purchases:number|null;purchase_value:number|null;checkouts:number|null;link_clicks:number|null;meta_roas:number|null;meta_cpa:number|null;meta_arpu:number|null;purchase_action_type:string|null;attribution_source:string}>>([]);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  type MetaLevel="campaign"|"adset"|"ad";
  type MetaRow={id:string;name:string;status:string;effective_status:string;campaign_id:string|null;adset_id:string|null;daily_budget:string|null;lifetime_budget:string|null;spend:number;impressions:number;clicks:number;cpc:number;ctr:number;cpm:number;purchases:number|null;purchase_value:number|null;checkouts:number|null;link_clicks:number|null;meta_roas:number|null;meta_cpa:number|null;meta_arpu:number|null};
  const [entityRows,setEntityRows]=useState<MetaRow[]>([]);
  const [entityBusy,setEntityBusy]=useState(false);
  const [entityError,setEntityError]=useState("");
  const [entityPartial,setEntityPartial]=useState(false);
  const [campaignFocus,setCampaignFocus]=useState("");
  const [adsetFocus,setAdsetFocus]=useState("");
  const [showSelectedOnly,setShowSelectedOnly]=useState(false);
  const [selectedEntities,setSelectedEntities]=useState<Record<string,string[]>>({});
  const entityRequest=useRef(0);
  const currentLevel:MetaLevel=tab==="Conjuntos"?"adset":tab==="Anúncios"?"ad":"campaign";
  const selectionKey=(level:MetaLevel)=>selectedAccount+":"+level;
  const chosenIds=selectedEntities[selectionKey(currentLevel)]||[];
  const selectedAccountIds=selectedEntities["accounts"]||[];
  const filteredAccounts=visibleAccounts.filter(a=>
    (status==="Qualquer"||(status==="Ativo"?a.account_status===1:a.account_status!==1)) &&
    a.name.toLowerCase().includes(query.toLowerCase()) &&
    (!showSelectedOnly||selectedAccountIds.includes(a.id))
  );
  const selectAccountForTracking=(id:string,checked:boolean)=>{
    setSelectedEntities(old=>({...old,accounts:checked?Array.from(new Set([...(old.accounts||[]),id])):(old.accounts||[]).filter(x=>x!==id)}));
    if(checked)setSelectedAccount(id);
  };

  const selectOne=(id:string,checked:boolean)=>{
    const key=selectionKey(currentLevel);
    setSelectedEntities(old=>({...old,[key]:checked?Array.from(new Set([...(old[key]||[]),id])):(old[key]||[]).filter(x=>x!==id)}));
  };
  useEffect(()=>{
    try{const saved=localStorage.getItem("trackup.meta.selection.v1");if(saved){const value=JSON.parse(saved);if(value&&typeof value==="object"&&!Array.isArray(value))setSelectedEntities(value);}}catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem("trackup.meta.selection.v1",JSON.stringify(selectedEntities));}catch{}},[selectedEntities]);
  useEffect(()=>{
    if(!visibilityLoaded)return;
    setSelectedAccount(current=>visibleAccounts.some(a=>a.id===current)?current:(visibleAccounts[0]?.id||""));
    if(!visibleAccounts.length){setSummary(null);setCampaigns([]);setEntityRows([]);setLastMetaUpdate("");}
  },[visibilityLoaded,hiddenAccountIds,adAccounts]);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const rangeDates = () => {
    const today=new Date();
    const format=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
    const start=new Date(today);
    if(period==="Ontem")start.setDate(today.getDate()-1);
    else if(period==="7 dias")start.setDate(today.getDate()-6);
    else if(period==="15 dias")start.setDate(today.getDate()-14);
    else if(period==="30 dias")start.setDate(today.getDate()-29);
    return {since:period==="Personalizado"?(since||format(today)):format(start),until:period==="Personalizado"?(until||format(today)):period==="Ontem"?format(start):format(today)};
  };

  const api = async (action:string, other:Record<string,string>={},token?:string) => {
    const response=await fetch(metaOauthEndpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json",...(token?{"Authorization":"Bearer "+token}:{})},
      body:JSON.stringify({action,...other})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Não foi possível comunicar com a Meta.");
    return result;
  };
  const loadMetaAccounts=async (token:string) => {
    if(accountsLock.current)return;
    accountsLock.current=true;
    setLoadingAccounts(true);
    try{
      const status=await api("status",{},token);
      setMetaConnections(status.connections||[]);
      if(status.profile)setOwnerProfile({email:status.profile.email,name:status.profile.name||null});
      setMetaTokenExpiresAt(status.meta_token_expires_at||null);
      const result=await api("accounts",{},token);
      setAdAccounts(result.accounts||[]);
      // The visible accounts effect selects an enabled account, never a hidden one.
      setAccountWarning(result.warnings||[]);
    }catch(e){
      setOauthMessage(e instanceof Error?e.message:"Erro ao carregar contas do Facebook.");
      if(e instanceof Error && /expired|connect facebook/i.test(e.message)){
        localStorage.removeItem("trackup.meta.session");
        setMetaSession(null);
      }
    }finally{setLoadingAccounts(false);accountsLock.current=false;}
  };
  useEffect(()=>{
    const parameters=new URLSearchParams(window.location.search);
    const result=parameters.get("meta");
    const returnedState=parameters.get("state");
    if(result){
      setPage("Integrações");
      setIntegration("Facebook Ads");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if(result==="error"){setOauthMessage("Autorização cancelada no Facebook.");return;}
    if(result==="connected" && returnedState){
      const verifier=sessionStorage.getItem("trackup.meta.verifier");
      const expected=sessionStorage.getItem("trackup.meta.state");
      if(!verifier || expected!==returnedState){
        setOauthMessage("A sessão de autorização não corresponde a este navegador. Tente novamente.");
        return;
      }
      void api("finish",{state:returnedState,verifier}).then(data=>{
        sessionStorage.removeItem("trackup.meta.verifier");
        sessionStorage.removeItem("trackup.meta.state");
        localStorage.setItem("trackup.meta.session",data.session);
        setMetaSession(data.session);
        setOauthMessage("Facebook conectado! Carregando contas de anúncios...");
      }).catch(e=>setOauthMessage(e instanceof Error?e.message:"Erro ao concluir login Facebook."));
      return;
    }
    const saved=localStorage.getItem("trackup.meta.session");
    if(saved)setMetaSession(saved);
  },[]);
  useEffect(()=>{
    if(metaSession)void loadMetaAccounts(metaSession);
    else {setMetaConnections([]);setAdAccounts([]);setCampaigns([]);setSelectedAccount("");setOwnerProfile(null);setMetaTokenExpiresAt(null);}
  },[metaSession]);
  const loadCampaigns=async()=>{
    if(!metaSession || !selectedAccount || !visibleAccounts.some(a=>a.id===selectedAccount)){setCampaigns([]);return;}
    if(campaignsLock.current || Date.now()<throttleUntil.current)return;
    campaignsLock.current=true;
    setCampaignBusy(true);
    setCampaignError("");
    const dates=rangeDates();
    try{
      const result=await api("campaigns",{account_id:selectedAccount,since:dates.since,until:dates.until},metaSession);
      setCampaigns(result.campaigns||[]);
    }catch(e){
      setCampaignError(e instanceof Error?e.message:"Não foi possível consultar campanhas da Meta.");
      setCampaigns([]);
    }finally{setCampaignBusy(false);campaignsLock.current=false;}
  };
  const loadSummary=async()=>{
    if(!metaSession || !selectedAccount || !visibleAccounts.some(a=>a.id===selectedAccount) || summaryLock.current || Date.now()<throttleUntil.current)return;
    summaryLock.current=true;
    try{
      const range=rangeDates();
      const response=await api("summary",{account_id:selectedAccount,period,since:range.since,until:range.until},metaSession);
      if(syncAccount.current===selectedAccount){
        setSummary(response.summary);
        setLastMetaUpdate(response.fetched_at||new Date().toISOString());
        setSyncIssue("");
      }
    }catch(error){
      const errorText=error instanceof Error?error.message:"Falha ao consultar Meta";
      if(errorText.includes("Limite de consultas"))throttleUntil.current=Date.now()+300000;
      setSyncIssue(errorText);
    }finally{summaryLock.current=false;}
  };
  useEffect(()=>{
    syncAccount.current=selectedAccount;
    setSummary(null);
    setLastMetaUpdate("");
    if(selectedAccount && metaSession){void loadSummary();void loadCampaigns();}
  },[selectedAccount,metaSession,period,since,until]);
  useEffect(()=>{
    if(!autoRefresh || !metaSession || !selectedAccount)return;
    const active=()=>document.visibilityState==="visible" && navigator.onLine;
    const summaryTimer=window.setInterval(()=>{if(active())void loadSummary();},60000);
    const campaignTimer=window.setInterval(()=>{if(active())void loadCampaigns();},120000);
    const accountsTimer=window.setInterval(()=>{if(active() && metaSession)void loadMetaAccounts(metaSession);},300000);
    const resume=()=>{if(active()){void loadSummary();void loadCampaigns();}};
    document.addEventListener("visibilitychange",resume);
    window.addEventListener("online",resume);
    return ()=>{
      window.clearInterval(summaryTimer);
      window.clearInterval(campaignTimer);
      window.clearInterval(accountsTimer);
      document.removeEventListener("visibilitychange",resume);
      window.removeEventListener("online",resume);
    };
  },[autoRefresh,metaSession,selectedAccount,period,since,until]);

  const loadEntities=async()=>{
    if(!metaSession||!selectedAccount||!visibleAccounts.some(a=>a.id===selectedAccount)||tab==="Contas"){setEntityRows([]);return;}
    if(Date.now()<throttleUntil.current)return;
    const request=++entityRequest.current;
    setEntityBusy(true);setEntityError("");
    const dates=rangeDates();
    try{
      const response=await api("entities",{level:currentLevel,account_id:selectedAccount,since:dates.since,until:dates.until},metaSession);
      if(request===entityRequest.current){setEntityRows(response.items||[]);setEntityPartial(!!response.partial);}
    }catch(error){
      if(request===entityRequest.current){setEntityRows([]);setEntityError(error instanceof Error?error.message:"Erro ao carregar itens da Meta.");}
    }finally{if(request===entityRequest.current)setEntityBusy(false);}
  };
  useEffect(()=>{
    setCampaignFocus("");
    setAdsetFocus("");
  },[selectedAccount]);
  useEffect(()=>{
    entityRequest.current+=1;
    setEntityRows([]);
    if(selectedAccount && metaSession && tab!=="Contas")void loadEntities();
  },[selectedAccount,metaSession,tab,period,since,until]);
  useEffect(()=>{
    if(page!=="Campanhas"||!autoRefresh||!metaSession||!selectedAccount||tab==="Contas")return;
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible"&&navigator.onLine)void loadEntities();},120000);
    return ()=>window.clearInterval(timer);
  },[page,autoRefresh,selectedAccount,metaSession,tab,period,since,until]);
  const filteredEntities=entityRows.filter(item=>
    (status==="Qualquer"||(status==="Ativo"?item.effective_status==="ACTIVE":item.effective_status.includes("PAUSED"))) &&
    item.name.toLowerCase().includes(query.toLowerCase()) &&
    (currentLevel==="campaign"||!campaignFocus||item.campaign_id===campaignFocus) &&
    (currentLevel!=="ad"||!adsetFocus||item.adset_id===adsetFocus) &&
    (!showSelectedOnly||chosenIds.includes(item.id))
  );
  const sum=(key:"spend"|"clicks"|"impressions")=>summary?.[key]??0;
  const money=(value:number,currency="BRL")=>new Intl.NumberFormat("pt-BR",{style:"currency",currency}).format(value);
  const currency=adAccounts.find(a=>a.id===selectedAccount)?.currency||"BRL";
  const metricValue=(name:string)=>{
    if(!summary||!visibleAccounts.some(a=>a.id===selectedAccount))return "—";
    const count=(n:number|null)=>n===null?"—":n.toLocaleString("pt-BR");
    const currencyValue=(n:number|null)=>n===null?"—":money(n,currency);
    const percentage=(n:number|null)=>n===null?"—":n.toFixed(2)+"%";
    const decimal=(n:number|null)=>n===null?"—":n.toFixed(2)+"x";
    switch(name){
      case "Faturamento":return currencyValue(summary.purchase_value);
      case "Gasto em Ads":return currencyValue(summary.spend);
      case "CPA":return currencyValue(summary.meta_cpa);
      case "ARPU":return currencyValue(summary.meta_arpu);
      case "ROAS":return decimal(summary.meta_roas);
      case "CPC":return currencyValue(summary.cpc);
      case "CTR":return percentage(summary.ctr);
      case "CPM":return currencyValue(summary.cpm);
      case "Vendas aprovadas":return count(summary.purchases);
      case "Cliques":return count(summary.clicks);
      case "Impressões":return count(summary.impressions);
      case "Checkouts iniciados":return count(summary.checkouts);
      default:return "—";
    }
  };
  const metricTitle=(name:string)=>name==="Faturamento"?"Valor de compras (Meta)":name==="Vendas aprovadas"?"Compras atribuídas (Meta)":name==="CPA"?"CPA (Meta)":name==="ARPU"?"Ticket médio (Meta)":name==="ROAS"?"ROAS (Meta)":name;
  const metricOrigin=(name:string)=>{
    if(!summary)return !visibleAccounts.length?"Ative contas em Integrações → Facebook Ads":selectedAccount?"Aguardando dados da Meta":"Selecione uma conta";
    if(["Faturamento","CPA","ARPU","ROAS","Vendas aprovadas","Checkouts iniciados"].includes(name))
      return "Conversões atribuídas pela Meta · não são vendas confirmadas";
    if(["Gasto em Ads","CPC","CTR","CPM","Cliques","Impressões"].includes(name))
      return "Meta Ads Insights · conta e período selecionados";
    return "Indisponível na Meta · requer integração do checkout";
  };

  const startMetaConnection=async()=>{
    setOauthMessage("");
    setConnectBusy(true);
    try{
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const verifier=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier));
      const verifier_hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
      const result=await api("authorize",{verifier_hash});
      if(!result.authorization_url?.startsWith("https://www.facebook.com/"))throw new Error("A Meta não retornou a URL de autorização.");
      sessionStorage.setItem("trackup.meta.verifier",verifier);
      sessionStorage.setItem("trackup.meta.state",result.state);
      window.location.assign(result.authorization_url);
    }catch(e){
      setOauthMessage(e instanceof Error?e.message:"Não foi possível conectar ao Facebook.");
      setConnectBusy(false);
    }
  };
  const disconnectMeta=async()=>{
    if(metaSession)await api("logout",{},metaSession).catch(()=>{});
    localStorage.removeItem("trackup.meta.session");
    setMetaSession(null);
    setOwnerProfile(null);
    setMetaTokenExpiresAt(null);
    setSummary(null);
    setOauthMessage("Facebook desconectado deste navegador.");
  };
  useEffect(() => { try { const c = localStorage.getItem("trackup.cards"); const d = localStorage.getItem("trackup.cols"); if(c) setCards(JSON.parse(c)); if(d) setCols(JSON.parse(d)); } catch {} }, []);
  const change = (kind:"cards"|"cols", value:string) => {
    const current = kind==="cards"?cards:cols;
    const next = current.includes(value)?current.filter(x=>x!==value):[...current,value];
    if(kind==="cards") setCards(next); else setCols(next);
    try { localStorage.setItem("trackup."+kind, JSON.stringify(next)); } catch {}
  };
  const refresh = () => setUpdated(new Date().toLocaleTimeString("pt-BR"));
  const btn = "rounded-md border border-[#d9e1ef] bg-white px-3 py-2 text-sm font-medium hover:bg-[#f2f6ff] disabled:opacity-40";
  const input = "rounded-md border border-[#d9e1ef] bg-white px-3 py-2 text-sm";
  return <div className="min-h-screen bg-[#f4f6fb] text-[#102142]">
    <div className="flex min-h-screen">
      <aside className={`w-56 shrink-0 border-r border-[#dce3f1] bg-white p-3 ${mobile?"fixed inset-y-0 left-0 z-30 shadow-xl":"hidden md:block"}`}>
        <div className="mb-10 flex items-center justify-between px-3 py-4 text-xl font-semibold"><span><span className="text-blue-600">◢</span> trackup</span><button className="md:hidden" onClick={()=>setMobile(false)}><X size={19}/></button></div>
        <div className="mb-2 px-3 text-xs uppercase tracking-wide text-slate-400">Dashboard Principal</div>
        {([{label:"Painel",Icon:BarChart3},{label:"Campanhas",Icon:Megaphone},{label:"Integrações",Icon:Plug}]).map(({label,Icon})=><button key={label} onClick={()=>{setPage(label);setMobile(false)}} className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm ${page===label?"bg-[#e1e9fa] font-semibold text-blue-700":"text-[#587096] hover:bg-slate-50"}`}><Icon size={17}/>{label}</button>)}
        <div className="mt-12 rounded-lg border border-[#dce3f1] bg-[#f6f8fc] p-3 text-xs text-slate-500"><strong className="block text-[#182d53]">Integração pendente</strong>Conecte sua conta Meta para visualizar os dados reais.</div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-7">
        <header className="mb-5 flex flex-wrap items-center gap-3"><button className={btn+" md:hidden"} onClick={()=>setMobile(true)} aria-label="Abrir menu"><Menu size={18}/></button><h1 className="mr-auto text-xl font-bold md:text-2xl">{page==="Painel"?"Dashboard Principal":page}</h1>{page==="Painel"&&<div className="flex flex-wrap gap-1">{periods.map(p=><button className={btn+(period===p?" border-blue-500 bg-blue-50 text-blue-700":"")} key={p} onClick={()=>setPeriod(p)}>{p}</button>)}</div>}</header>
        {page==="Painel"&&<div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">{period==="Personalizado"&&<><input aria-label="Data inicial" type="date" className={input} value={since} onChange={e=>setSince(e.target.value)}/><input aria-label="Data final" type="date" className={input} value={until} onChange={e=>setUntil(e.target.value)}/></>}<select aria-label="Produto" className={input}><option>Todos os produtos</option></select><select aria-label="Conta" className={input} value={visibleAccounts.some(a=>a.id===selectedAccount)?selectedAccount:""} onChange={e=>setSelectedAccount(e.target.value)} disabled={!visibleAccounts.length}><option value="">{visibleAccounts.length?"Selecione uma conta":"Nenhuma conta ativada"}</option>{visibleAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className={btn} onClick={()=>{refresh();void loadSummary();void loadCampaigns();}}><RefreshCw className="inline" size={15}/> Atualizar</button><button className={btn} onClick={()=>setHide(!hide)} aria-label={hide?"Mostrar valores":"Ocultar valores"}>{hide?<Eye size={16}/>:<EyeOff size={16}/>}</button><button className={btn} onClick={()=>setEdit("cards")}><Pencil className="inline" size={15}/> Editar</button><button disabled title="Aguardando dados reais" className={btn}><Download className="inline" size={15}/> Exportar</button></div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
  <span className="font-semibold text-slate-800">{metaSession?"Meta Ads conectada":"Meta Ads desconectada"}</span>
  {ownerProfile&&<span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-800">Perfil pessoal: {ownerProfile.email}</span>}
  <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/> Atualização automática</label>
  <span>Indicadores: 60 s · campanhas: 120 s · contas: 5 min</span>
  <span>Última consulta: {lastMetaUpdate?new Date(lastMetaUpdate).toLocaleTimeString("pt-BR"):"aguardando"}</span>
  {syncIssue&&<span role="alert" className="text-amber-700">{syncIssue}</span>}
  <span className="text-slate-500">Os dados podem ter atraso de processamento na Meta.</span>
</div>
<TrackupDashboard
  summary={visibleAccounts.some(a=>a.id===selectedAccount)?summary:null}
  accountId={visibleAccounts.some(a=>a.id===selectedAccount)?selectedAccount:""}
  accountName={visibleAccounts.find(a=>a.id===selectedAccount)?.name||""}
  enabledAccountCount={visibleAccounts.length}
  currency={currency}
  hide={hide}
  onManageAccounts={()=>{setPage("Integrações");setIntegration("Facebook Ads");}}
/>
        </div>}
        {page==="Campanhas"&&<div className="space-y-4">
          <div className="flex overflow-x-auto border-b border-[#dce3f1]">
            {["Contas","Campanhas","Conjuntos","Anúncios"].map(t=><button key={t} onClick={()=>{setTab(t);setShowSelectedOnly(false);}} className={"whitespace-nowrap border-b-2 px-5 py-3 text-sm "+(tab===t?"border-blue-600 font-semibold text-blue-600":"border-transparent text-slate-500")}>{t}</button>)}
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#dae3f2] bg-white p-4">
            <label className="flex flex-col gap-1 text-xs text-slate-500">Conta de anúncios<select className={input} value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)}><option value="">Selecione uma conta</option>{visibleAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <button className={btn} onClick={()=>{setTab("Contas");setShowSelectedOnly(false);}}>Selecionar contas ({selectedAccountIds.length})</button>
            <label className="flex flex-col gap-1 text-xs text-slate-500">Status<select value={status} onChange={e=>setStatus(e.target.value)} className={input}><option>Qualquer</option><option>Ativo</option><option>Pausado</option></select></label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">Período<select value={period} onChange={e=>setPeriod(e.target.value)} className={input}>{periods.map(p=><option key={p}>{p}</option>)}</select></label>
            {period==="Personalizado"&&<><input aria-label="Data inicial" type="date" className={input} value={since} onChange={e=>setSince(e.target.value)}/><input aria-label="Data final" type="date" className={input} value={until} onChange={e=>setUntil(e.target.value)}/></>}
            {tab==="Conjuntos"&&<label className="flex flex-col gap-1 text-xs text-slate-500">Campanha<select className={input} value={campaignFocus} onChange={e=>setCampaignFocus(e.target.value)}><option value="">Todas as campanhas</option>{Array.from(new Map(entityRows.map(a=>[a.campaign_id,a])).entries()).filter(([id])=>!!id).map(([id])=><option key={id} value={id!}>{id}</option>)}</select></label>}
            {tab==="Anúncios"&&<><label className="flex flex-col gap-1 text-xs text-slate-500">Campanha<select className={input} value={campaignFocus} onChange={e=>{setCampaignFocus(e.target.value);setAdsetFocus("");}}><option value="">Todas as campanhas</option>{Array.from(new Set(entityRows.map(a=>a.campaign_id).filter(Boolean))).map(id=><option key={id} value={id!}>{id}</option>)}</select></label><label className="flex flex-col gap-1 text-xs text-slate-500">Conjunto<select className={input} value={adsetFocus} onChange={e=>setAdsetFocus(e.target.value)}><option value="">Todos os conjuntos</option>{Array.from(new Set(entityRows.filter(a=>!campaignFocus||a.campaign_id===campaignFocus).map(a=>a.adset_id).filter(Boolean))).map(id=><option key={id} value={id!}>{id}</option>)}</select></label></>}
            <label className="flex min-w-36 flex-1 items-center gap-2 rounded-md border border-[#d9e1ef] bg-white px-3"><Search size={15}/><input className="min-w-0 flex-1 py-2 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar pelo nome"/></label>
            <button className={btn} onClick={()=>setEdit("cols")}>Colunas</button>
            <button className={btn} disabled={entityBusy} onClick={()=>tab==="Contas"?(metaSession&&void loadMetaAccounts(metaSession)):void loadEntities()}>{entityBusy?"Consultando...":"Atualizar"}</button>
          </div>
          {tab==="Contas"&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dae3f2] bg-white px-4 py-3 text-xs">
            <div><strong>{selectedAccountIds.length}</strong> conta(s) de anúncios selecionada(s) · <strong>{filteredAccounts.length}</strong> exibida(s). Marque as contas que deseja acompanhar e clique no nome para abrir as campanhas.</div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showSelectedOnly} onChange={e=>setShowSelectedOnly(e.target.checked)}/> Mostrar somente selecionadas</label>
              <button className="font-medium text-blue-700 underline" onClick={()=>setSelectedEntities(old=>({...old,accounts:[]}))}>Limpar seleção de contas</button>
            </div>
          </div>}
          {tab!=="Contas"&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dae3f2] bg-white px-4 py-3 text-xs">
            <div><strong>{filteredEntities.length}</strong> {tab.toLowerCase()} exibidos · <strong>{chosenIds.length}</strong> marcados para acompanhar</div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showSelectedOnly} onChange={e=>setShowSelectedOnly(e.target.checked)}/> Mostrar somente selecionados</label>
              <button onClick={()=>{const key=selectionKey(currentLevel);setSelectedEntities(old=>({...old,[key]:[]}));}} className="font-medium text-blue-700 underline">Limpar seleção</button>
            </div>
          </div>}
          {entityError&&tab!=="Contas"&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{entityError}</p>}
          {entityPartial&&tab!=="Contas"&&<p className="text-xs text-amber-700">A Meta tem mais itens do que o limite desta consulta; a lista pode estar incompleta.</p>}
          <div className="overflow-x-auto rounded-xl border border-[#dae3f2] bg-white">
            <table className="w-full min-w-max text-left text-xs">
              <thead className="border-b bg-[#fcfdff] text-slate-500"><tr>
                <th className="p-4">{tab==="Contas"?<input type="checkbox" aria-label="Selecionar todas as contas exibidas" checked={filteredAccounts.length>0&&filteredAccounts.every(a=>selectedAccountIds.includes(a.id))} onChange={e=>setSelectedEntities(old=>({...old,accounts:e.target.checked?Array.from(new Set([...(old.accounts||[]),...filteredAccounts.map(a=>a.id)])):(old.accounts||[]).filter(id=>!filteredAccounts.some(a=>a.id===id))}))}/>:<input type="checkbox" aria-label="Selecionar itens exibidos" checked={filteredEntities.length>0&&filteredEntities.every(a=>chosenIds.includes(a.id))} onChange={e=>{const key=selectionKey(currentLevel);setSelectedEntities(old=>({...old,[key]:e.target.checked?Array.from(new Set([...(old[key]||[]),...filteredEntities.map(a=>a.id)])):(old[key]||[]).filter(id=>!filteredEntities.some(a=>a.id===id))}));}}/>}</th>
                {cols.map(c=><th className="px-4 py-4 uppercase" key={c}>{c==="Campanha"?(tab==="Contas"?"Conta":tab==="Conjuntos"?"Conjunto":tab==="Anúncios"?"Anúncio":"Campanha"):c==="Vendas Meta"?"Compras Meta":c==="Faturamento"?"Valor compras Meta":c}</th>)}
                {tab!=="Contas"&&<th className="px-4 py-4">Detalhar</th>}
              </tr></thead>
              <tbody>
                {tab==="Contas"?filteredAccounts.map(a=><tr key={a.id} className={"border-b "+(selectedAccountIds.includes(a.id)?"bg-blue-50/60":"")}><td className="p-4"><input type="checkbox" aria-label={"Selecionar conta "+a.name} checked={selectedAccountIds.includes(a.id)} onChange={e=>selectAccountForTracking(a.id,e.target.checked)}/></td>{cols.map(column=><td key={column} className="px-4 py-4">{column==="Campanha"?<button className="font-semibold text-blue-700" onClick={()=>{setSelectedAccount(a.id);setTab("Campanhas");}}>{a.name}</button>:column==="Status"?(a.account_status===1?"Ativa":"Status "+a.account_status):"—"}</td>)}</tr>):
                  filteredEntities.map(a=><tr key={a.id} className={"border-b "+(chosenIds.includes(a.id)?"bg-blue-50/60":"")}>
                    <td className="p-4"><input type="checkbox" aria-label={"Selecionar "+a.name} checked={chosenIds.includes(a.id)} onChange={e=>selectOne(a.id,e.target.checked)}/></td>
                    {cols.map(column=><td key={column} className="px-4 py-4">{column==="Campanha"?<span className="max-w-80 break-words font-semibold">{a.name}</span>:
                      column==="Status"?a.effective_status:
                      column==="Orçamento"?(a.daily_budget?money(Number(a.daily_budget)/100,currency)+" / dia":a.lifetime_budget?money(Number(a.lifetime_budget)/100,currency):"—"):
                      column==="Gasto"?money(a.spend,currency):
                      column==="Vendas Meta"?(a.purchases===null?"—":a.purchases.toLocaleString("pt-BR")):
                      column==="Faturamento"?(a.purchase_value===null?"—":money(a.purchase_value,currency)):
                      column==="ROAS"?(a.meta_roas===null?"—":a.meta_roas.toFixed(2)+"x"):
                      column==="CPA"?(a.meta_cpa===null?"—":money(a.meta_cpa,currency)):
                      column==="ARPU"?(a.meta_arpu===null?"—":money(a.meta_arpu,currency)):
                      column==="Impressões"?a.impressions.toLocaleString("pt-BR"):
                      column==="Cliques"?a.clicks.toLocaleString("pt-BR"):
                      column==="CPC"?money(a.cpc,currency):
                      column==="CTR"?a.ctr.toFixed(2)+"%":"—"}</td>)}
                    <td className="px-4 py-4">{currentLevel==="campaign"?<button className="font-semibold text-blue-700 underline" onClick={()=>{setTab("Conjuntos");setCampaignFocus(a.id);}}>Ver conjuntos</button>:currentLevel==="adset"?<button className="font-semibold text-blue-700 underline" onClick={()=>{setTab("Anúncios");setCampaignFocus(a.campaign_id||"");setAdsetFocus(a.id);}}>Ver anúncios</button>:"—"}</td>
                  </tr>)}
                {(tab==="Contas"?filteredAccounts.length===0:filteredEntities.length===0)&&<tr><td colSpan={cols.length+(tab==="Contas"?1:2)} className="px-6 py-16 text-center text-sm text-slate-500">{tab==="Contas"?"Nenhuma conta corresponde aos filtros ou à seleção atual.":entityBusy?"Buscando dados na Meta...":entityError||"Nenhum item corresponde aos filtros atuais."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
        {page==="Integrações"&&<div className="space-y-5"><p className="text-sm text-slate-500">Conecte suas contas de anúncios e configure o rastreamento.</p><div className="flex gap-1 overflow-auto border-b border-[#dce3f1]">{["Facebook Ads","Pixel de Rastreio","UTMs","Webhook API"].map(t=><button key={t} onClick={()=>setIntegration(t)} className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm ${t===integration?"border-blue-600 font-semibold text-blue-600":"border-transparent text-slate-500"}`}>{t}</button>)}</div><div className="max-w-4xl rounded-xl border border-[#dae3f2] bg-white p-6">{integration==="Facebook Ads"?<><h2 className="mb-3 flex items-center gap-2 font-semibold"><Facebook size={22} className="text-blue-600"/> Conectar com Facebook</h2><p className="mb-5 text-sm leading-6 text-slate-600">O login será realizado pelo Facebook Login for Business oficial. Com as permissões necessárias, o sistema poderá listar contas de anúncios, campanhas ativas e pausadas e controlar os status pela Marketing API.</p>
<div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
  <strong>TrackUp pessoal — ryanpena108@gmail.com.</strong> Acesse com seu Facebook, sem cadastrar senha. A sessão permanece salva neste navegador; quando o token da Meta expirar ou for revogado, será necessário autorizar o Facebook novamente.
</div>
{metaSession&&ownerProfile&&<div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
  <strong>Conectado como {ownerProfile.name||"Facebook autorizado"}</strong> · {ownerProfile.email}
  <span className="mt-1 block text-xs">Seu acesso fica salvo neste navegador. {metaTokenExpiresAt?"Token da Meta válido até "+new Date(metaTokenExpiresAt).toLocaleDateString("pt-BR"):"Consulte a validade da autorização na Meta."}</span>
</div>}
<div className="flex flex-wrap items-center gap-3">
  <button disabled={connectBusy} onClick={()=>void startMetaConnection()} className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"><Facebook size={18}/>{connectBusy?"Conectando...":metaSession?"Reconectar Facebook":"Conectar com Facebook"}</button>
  {metaSession && <button className={btn} onClick={()=>void disconnectMeta()}>Desconectar</button>}
</div>
{oauthMessage && <p role="status" className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{oauthMessage}</p>}
<div className="mt-6 border-t pt-4">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Contas de anúncios conectadas</h3><button className={btn} disabled={!metaSession||loadingAccounts} onClick={()=>metaSession&&void loadMetaAccounts(metaSession)}>{loadingAccounts?"Consultando...":"Atualizar contas"}</button></div>
  {metaConnections.length>0 && <p className="mb-3 text-sm text-green-700">{metaConnections.length} perfil(is) Facebook autorizado(s): {metaConnections.map(c=>c.name||c.meta_user_id).join(", ")}</p>}
  {adAccounts.length>0&&<section className="mb-5 rounded-lg border border-[#dce3f1] bg-[#f8faff] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">Escolher contas exibidas no TrackUp</h3><p className="mt-1 text-xs text-slate-500">{visibleAccounts.length} de {adAccounts.length} visíveis. Desativar aqui apenas oculta a conta no TrackUp; não pausa anúncios no Facebook.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={enableAllAccounts} disabled={hiddenAccountIds.length===0}>Ativar todas</button>
        <button type="button" className={btn} onClick={hideAllAccounts} disabled={visibleAccounts.length===0}>Desativar todas</button>
      </div>
    </div>
    <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
      {adAccounts.map(a=>{
        const enabled=!hiddenAccountIds.includes(a.id);
        return <label key={a.id} className={"flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border p-3 "+(enabled?"border-blue-200 bg-white":"border-slate-200 bg-slate-100/70 opacity-75")}>
          <div className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{a.name}</span><span className="block truncate text-xs text-slate-500">{a.id} · {a.currency} · Situação na Meta: {a.account_status===1?"ativa":"status "+a.account_status}</span></div>
          <div className="flex items-center gap-2"><span className={"text-xs font-semibold "+(enabled?"text-green-700":"text-slate-500")}>{enabled?"Exibir":"Oculta"}</span><input type="checkbox" role="switch" aria-label={"Exibir "+a.name+" no TrackUp"} checked={enabled} onChange={e=>setAccountEnabled(a.id,e.target.checked)} className="h-5 w-5 cursor-pointer accent-blue-600"/></div>
        </label>;
      })}
    </div>
    <p className="mt-3 text-xs text-slate-500">Escolhas salvas neste navegador. Contas ocultas não aparecem nos filtros, tabelas e resumo, mas continuam autorizadas no Facebook.</p>
  </section>}
  {adAccounts.length===0?<p className="text-sm text-slate-500">{loadingAccounts?"Buscando suas contas na Meta...":"Nenhuma conta de anúncios retornada. Conecte o Facebook ou verifique as permissões de acesso."}</p>:<div className="space-y-2">{adAccounts.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3"><div><strong className="block text-sm">{a.name}</strong><span className="text-xs text-slate-500">{a.id} · {a.currency}</span></div><span className={"rounded-full px-3 py-1 text-xs "+(a.account_status===1?"bg-green-50 text-green-700":"bg-slate-100 text-slate-600")}>{a.account_status===1?"Ativa":"Status "+a.account_status}</span></div>)}</div>}
  {accountWarning.map((warning,i)=><p key={i} className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">{warning}</p>)}
  <p className="mt-3 text-xs text-slate-500">A listagem é consultada diretamente na Marketing API. Gastos e campanhas são consultados pela API da Meta. Valores de compras e ROAS são atribuídos pelo Facebook quando disponíveis e não substituem vendas confirmadas pelo checkout.</p>
</div></>:<><h2 className="mb-3 font-semibold">{integration}</h2><p className="text-sm text-slate-500">Reservado para uma próxima etapa, depois do login com Facebook e da consulta de campanhas.</p></>}</div></div>}
        {updated&&<p className="mt-5 text-xs text-slate-400">Interface atualizada às {updated}. Dados externos dependem da integração.</p>}
      </main>
    </div>
    {edit&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-[#15233f]/50 p-4" onClick={()=>setEdit(null)}><div role="dialog" aria-modal="true" aria-label="Personalizar visualização" onClick={e=>e.stopPropagation()} className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{edit==="cards"?"Editar cards do painel":"Editar colunas"}</h2><button onClick={()=>setEdit(null)} aria-label="Fechar"><X size={20}/></button></div><p className="mb-4 text-sm text-slate-500">Marque as informações que deseja exibir. Preferências salvas neste navegador.</p><div className="grid gap-2 sm:grid-cols-2">{(edit==="cards"?allCards:allCols).map(x=><label key={x} className="flex cursor-pointer items-center gap-3 rounded-md border border-[#e1e7f1] p-3 text-sm"><input className="accent-blue-600" type="checkbox" checked={(edit==="cards"?cards:cols).includes(x)} onChange={()=>change(edit,x)}/>{x}</label>)}</div><div className="mt-5 flex justify-end gap-2"><button className={btn} onClick={()=>{const v=edit==="cards"?defaults:defaultCols;if(edit==="cards")setCards(v);else setCols(v);localStorage.setItem("trackup."+edit,JSON.stringify(v));}}>Restaurar padrão</button><button onClick={()=>setEdit(null)} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white">Concluir</button></div></div></div>}
  </div>;
}
