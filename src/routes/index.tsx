import { createFileRoute } from "@tanstack/react-router";
import TrackupDashboard, { type MetaDashboardSummary } from "../components/TrackupDashboard";
import CheckoutIntegrations from "../components/CheckoutIntegrations";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Megaphone, Plug, Pencil, RefreshCw, Eye, EyeOff, Download, X, Menu, Facebook, Search, History, Plus, Trash2, StickyNote } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });
const metaOauthEndpoint = "https://ystxfmrhbqybdilmuzwc.supabase.co/functions/v1/meta-oauth-callback";
const checkoutEndpoint = "https://ystxfmrhbqybdilmuzwc.supabase.co/functions/v1/trackup-checkouts";
const allCards = ["Faturamento", "Lucro operacional", "Gasto em Ads", "CPA", "ARPU", "ROAS", "ROI", "CPC", "CTR", "CPM", "Vendas aprovadas", "Vendas pendentes", "Chargeback", "Margem", "Cliques", "Impressões", "Checkouts iniciados"];
const allCols = ["Status", "Campanha", "Última atualização", "Gasto / Limite diário", "Orçamento", "Gasto", "Vendas Meta", "Vendas TrackUp", "Vendas pendentes", "Faturamento", "Lucro", "ROAS", "CPA", "ARPU", "Impressões", "Cliques", "CPC", "CTR"];
const periods = ["Hoje", "Ontem", "7 dias", "15 dias", "30 dias", "Personalizado"];
const defaults = ["Gasto em Ads","Faturamento","Vendas aprovadas","ROAS","CPA","ARPU","CPC","CTR","CPM","Cliques","Impressões","Checkouts iniciados"];
type ChangeItem={id:string;createdAt:string;accountId:string;accountName:string;category:string;title:string;note:string;origin:"manual"|"trackup"};
const changeLogKey="trackup.changes.v1";
const validChangeItems=(value:unknown):ChangeItem[]=>Array.isArray(value)?value.filter((x):x is ChangeItem=>Boolean(x&&typeof x==="object"&&typeof x.id==="string"&&typeof x.createdAt==="string"&&typeof x.title==="string"&&typeof x.note==="string"&&typeof x.category==="string"&&typeof x.accountId==="string"&&typeof x.accountName==="string"&&(x.origin==="manual"||x.origin==="trackup"))).slice(0,200):[];
const defaultCols = ["Status","Campanha","Gasto / Limite diário","Orçamento","Gasto","Vendas Meta","Faturamento","ROAS","CPA","ARPU","Impressões","Cliques","CPC","CTR"];
function Home() {
  const [page, setPage] = useState("Painel");
  const [changeLog,setChangeLog]=useState<ChangeItem[]>([]);
  const [changeLogLoaded,setChangeLogLoaded]=useState(false);
  const [changeTitle,setChangeTitle]=useState("");
  const [changeNote,setChangeNote]=useState("");
  const [changeCategory,setChangeCategory]=useState("Lance / Bid Cap");
  const [changeSearch,setChangeSearch]=useState("");
  const [editingChange,setEditingChange]=useState<string|null>(null);
  const [cloudChangeState,setCloudChangeState]=useState<"checking"|"synced"|"local"|"error">("checking");
  useEffect(()=>{try{setChangeLog(validChangeItems(JSON.parse(localStorage.getItem(changeLogKey)||"[]")));}catch{}setChangeLogLoaded(true);},[]);
  useEffect(()=>{if(changeLogLoaded)try{localStorage.setItem(changeLogKey,JSON.stringify(changeLog));}catch{}},[changeLogLoaded,changeLog]);
  const addChange=(entry:Omit<ChangeItem,"id"|"createdAt">)=>{
    const item:ChangeItem={...entry,id:typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Date.now()+"-"+Math.random(),createdAt:new Date().toISOString()};
    setChangeLog(old=>[item,...old].slice(0,200));
  };
  const logDate=(iso:string)=>new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});

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
  const [cloudPreferencesReady,setCloudPreferencesReady]=useState(false);
  const [cloudDashboardLayout,setCloudDashboardLayout]=useState<{order:string[];active:string[]}|null>(null);
  const [preferencesError,setPreferencesError]=useState("");
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
  const [accountFilter,setAccountFilter]=useState<"all"|"active"|"campaigns">("all");
  const [campaignActivity,setCampaignActivity]=useState<Record<string,boolean|null>>({});
  const [activityBusy,setActivityBusy]=useState(false);
  const [activityError,setActivityError]=useState("");
  const [activityCheckedAt,setActivityCheckedAt]=useState("");
  const visibleAccounts=adAccounts.filter(a=>visibilityLoaded&&!hiddenAccountIds.includes(a.id));
  const setAccountEnabled=(id:string,enabled:boolean)=>{
    setHiddenAccountIds(old=>enabled?old.filter(x=>x!==id):Array.from(new Set([...old,id])));
    if(!enabled && selectedAccount===id){
      setSummary(null);setCampaigns([]);setEntityRows([]);setLastMetaUpdate("");
    }
  };
  const enableAllAccounts=()=>setHiddenAccountIds([]);
  const hideAllAccounts=()=>setHiddenAccountIds(old=>Array.from(new Set([...old,...adAccounts.map(a=>a.id)])));
  const accountMatchesFilter=(a:{id:string;account_status:number})=>
    accountFilter==="all"||(accountFilter==="active"?a.account_status===1:(a.account_status===1&&campaignActivity[a.id]===true));
  const matchingAccounts=adAccounts.filter(accountMatchesFilter);
  const selectOnlyMatchingAccounts=()=>{
    if(accountFilter==="campaigns"&&!activityCheckedAt)return;
    const allowed=new Set(matchingAccounts.map(a=>a.id));
    setHiddenAccountIds(adAccounts.filter(a=>!allowed.has(a.id)).map(a=>a.id));
  };

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

  const [checkoutProducts,setCheckoutProducts]=useState<Array<{id:string;name:string;currency:string}>>([]);
  const [chosenProduct,setChosenProduct]=useState("");
  const [checkoutStats,setCheckoutStats]=useState<{product_pie:Array<{name:string;value:number}>;payment_pie:Array<{name:string;value:number}>;approved_count:number;revenue_by_currency:Record<string,number>}|null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");

  const [alertsOn,setAlertsOn]=useState(true),[alertsEdit,setAlertsEdit]=useState(false),[alertsCap,setAlertsCap]=useState(10),[alertsPct,setAlertsPct]=useState(80),[alertsCount,setAlertsCount]=useState(5),[alertsLevel,setAlertsLevel]=useState<"campaign"|"adset"|"ad">("ad");
  const [alertsData,setAlertsData]=useState<Array<{id:string;name:string;spend:number}>>([]),[alertsError,setAlertsError]=useState(""),[alertsLoading,setAlertsLoading]=useState(false);
  const alertsSeq=useRef(0);
  useEffect(()=>{try{const v=JSON.parse(localStorage.getItem("trackup.alerts.v1")||"{}");if(typeof v.on==="boolean")setAlertsOn(v.on);if(Number(v.cap)>0)setAlertsCap(Number(v.cap));if(Number(v.pct)>=1&&Number(v.pct)<=100)setAlertsPct(Number(v.pct));if([3,5,10,20].includes(v.count))setAlertsCount(v.count);if(["campaign","adset","ad"].includes(v.level))setAlertsLevel(v.level);}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem("trackup.alerts.v1",JSON.stringify({on:alertsOn,cap:alertsCap,pct:alertsPct,count:alertsCount,level:alertsLevel}));}catch{}},[alertsOn,alertsCap,alertsPct,alertsCount,alertsLevel]);
  const [campaigns, setCampaigns] = useState<Array<{id:string;name:string;status:string;effective_status:string;daily_budget:string|null;lifetime_budget:string|null;spend:number;impressions:number;clicks:number;cpc:number;ctr:number;cpm:number;purchases:number|null;purchase_value:number|null;checkouts:number|null;link_clicks:number|null;meta_roas:number|null;meta_cpa:number|null;meta_arpu:number|null;purchase_action_type:string|null;attribution_source:string}>>([]);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignError, setCampaignError] = useState("");
  type MetaLevel="campaign"|"adset"|"ad";
  type MetaRow={id:string;name:string;status:string;effective_status:string;campaign_id:string|null;adset_id:string|null;daily_budget:string|null;lifetime_budget:string|null;spend:number;impressions:number;clicks:number;cpc:number;ctr:number;cpm:number;purchases:number|null;purchase_value:number|null;checkouts:number|null;link_clicks:number|null;meta_roas:number|null;meta_cpa:number|null;meta_arpu:number|null};
  const [entityRows,setEntityRows]=useState<MetaRow[]>([]);
  const [todaySpendRows,setTodaySpendRows]=useState<Record<string,number>>({});
  const [todaySpendBusy,setTodaySpendBusy]=useState(false);
  const [todaySpendError,setTodaySpendError]=useState("");
  const todaySpendSeq=useRef(0);
  const [entityBusy,setEntityBusy]=useState(false);
  const [entityError,setEntityError]=useState("");
  const [statusPending,setStatusPending]=useState<{id:string;name:string;level:MetaLevel;current:string;target:"ACTIVE"|"PAUSED"}|null>(null);
  const [statusChanging,setStatusChanging]=useState(false);
  const [statusFeedback,setStatusFeedback]=useState("");
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
    setSelectedEntities(old=>({...old,accounts:checked?Array.from(new Set([...(old["accounts"]||[]),id])):(old["accounts"]||[]).filter(x=>x!==id)}));
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

  const api = async (action:string, other:Record<string,unknown>={},token?:string) => {
    const response=await fetch(metaOauthEndpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json",...(token?{"Authorization":"Bearer "+token}:{})},
      body:JSON.stringify({action,...other})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Não foi possível comunicar com a Meta.");
    return result;
  };
  const checkActiveCampaigns=async()=>{
    if(!metaSession||activityBusy)return;
    setActivityBusy(true);setActivityError("");setActivityCheckedAt("");
    setCampaignActivity({});
    try{
      const active=adAccounts.filter(a=>a.account_status===1);
      const batches:typeof active[]=[];
      for(let i=0;i<active.length;i+=80)batches.push(active.slice(i,i+80));
      const aggregate:Record<string,boolean|null>={};
      let failed=0;
      for(const batch of batches){
        const result=await api("account_campaign_activity",{account_ids:batch.map(a=>a.id)},metaSession);
        for(const item of result.items||[]){
          aggregate[item.id]=typeof item.has_active_campaign==="boolean"?item.has_active_campaign:null;
          if(aggregate[item.id]===null)failed++;
        }
      }
      setCampaignActivity(aggregate);
      setActivityCheckedAt(new Date().toLocaleString("pt-BR"));
      if(failed)setActivityError(failed+" conta(s) não puderam ser verificadas; não serão selecionadas automaticamente.");
    }catch(e){
      setActivityError(e instanceof Error?e.message:"Não foi possível verificar campanhas na Meta.");
    }finally{setActivityBusy(false);}
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
      setCampaignActivity({});setActivityCheckedAt("");setActivityError("");
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
      const verifierInTab=sessionStorage.getItem("trackup.meta.verifier");
      const stateInTab=sessionStorage.getItem("trackup.meta.state");
      let fallback:{verifier:string;state:string;created:number}|null=null;
      try{
        const saved=localStorage.getItem("trackup.meta.pending-login");
        if(saved)fallback=JSON.parse(saved);
      }catch{}
      const fallbackValid=fallback?.state===returnedState&&typeof fallback.verifier==="string"
        &&typeof fallback.created==="number"&&Date.now()-fallback.created<600000;
      const verifier=stateInTab===returnedState&&verifierInTab?verifierInTab:(fallbackValid?fallback!.verifier:null);
      if(!verifier){
        setOauthMessage("Não foi possível recuperar a autorização. Abra o TrackUp diretamente no Chrome ou Safari e inicie o login novamente no mesmo navegador.");
        return;
      }
      void api("finish",{state:returnedState,verifier}).then(data=>{
        sessionStorage.removeItem("trackup.meta.verifier");
        sessionStorage.removeItem("trackup.meta.state");
        try{localStorage.removeItem("trackup.meta.pending-login");}catch{}
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
  const checkoutApi=async(action:string,other:Record<string,unknown>={})=>{
    if(!metaSession)throw Error("Conecte o Facebook para visualizar vendas.");
    const response=await fetch(checkoutEndpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+metaSession},body:JSON.stringify({action,...other})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||"Erro ao consultar vendas");
    return result;
  };
  useEffect(()=>{
    if(!metaSession){setCheckoutProducts([]);setCheckoutStats(null);return;}
    let active=true;
    void checkoutApi("list").then(data=>{if(active)setCheckoutProducts(data.products||[]);}).catch(()=>{});
    return ()=>{active=false;};
  },[metaSession,page]);
  useEffect(()=>{
    if(!metaSession)return;
    let active=true;
    const load=async()=>{
      const dates=rangeDates();
      try{const result=await checkoutApi("stats",{since:dates.since,until:dates.until,...(chosenProduct?{product_id:chosenProduct}:{})});if(active)setCheckoutStats(result);}
      catch{if(active)setCheckoutStats(null);}
    };
    void load();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},60000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[metaSession,chosenProduct,period,since,until]);
  useEffect(()=>{
    if(!metaSession){setCloudPreferencesReady(false);setCloudDashboardLayout(null);return;}
    let cancelled=false;
    setCloudPreferencesReady(false);
    const restore=async()=>{
      try{
        const response=await checkoutApi("get_preferences");
        if(cancelled)return;
        const pref=response.preferences||{};
        if(Array.isArray(pref.hidden_accounts))setHiddenAccountIds(pref.hidden_accounts.filter((x:unknown):x is string=>typeof x==="string"&&/^act_\d+$/.test(x)));
        if(pref.selected_entities && typeof pref.selected_entities==="object" && !Array.isArray(pref.selected_entities))setSelectedEntities(pref.selected_entities);
        if(Array.isArray(pref.change_log)){
          const cloud=validChangeItems(pref.change_log);
          setChangeLog(local=>{
            const merged=new Map([...local,...cloud].map(item=>[item.id,item]));
            return [...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200);
          });
          setCloudChangeState("synced");
        }else setCloudChangeState("local");

        if(pref.dashboard_layout && Array.isArray(pref.dashboard_layout.order) && Array.isArray(pref.dashboard_layout.active))
          setCloudDashboardLayout(pref.dashboard_layout);
        else setCloudDashboardLayout(null);
        setCloudPreferencesReady(true);
        setPreferencesError("");
      }catch(e){
        if(cancelled)return;
        // Keep local preferences when offline; never overwrite server settings after failed load.
        setCloudPreferencesReady(false);
        setPreferencesError("Preferências na nuvem indisponíveis. Suas integrações permanecem armazenadas no servidor.");
        setCloudChangeState("error");
      }
    };
    void restore();
    return ()=>{cancelled=true;};
  },[metaSession]);
  useEffect(()=>{
    if(!cloudPreferencesReady||!metaSession||!visibilityLoaded)return;
    const timer=window.setTimeout(()=>{
      void checkoutApi("save_preferences",{section:"hidden_accounts",value:hiddenAccountIds}).catch(()=>{
        setPreferencesError("Não foi possível sincronizar a visibilidade das contas.");
      });
    },700);
    return ()=>window.clearTimeout(timer);
  },[cloudPreferencesReady,metaSession,hiddenAccountIds,visibilityLoaded]);
  useEffect(()=>{
    if(!cloudPreferencesReady||!metaSession)return;
    const timer=window.setTimeout(()=>{
      void checkoutApi("save_preferences",{section:"selected_entities",value:selectedEntities}).catch(()=>{
        setPreferencesError("Não foi possível sincronizar a seleção de campanhas.");
      });
    },700);
    return ()=>window.clearTimeout(timer);
  },[cloudPreferencesReady,metaSession,selectedEntities]);
  useEffect(()=>{
    if(!metaSession||!cloudPreferencesReady||!changeLogLoaded)return;
    const timer=window.setTimeout(()=>{
      void checkoutApi("save_preferences",{section:"change_log",value:changeLog}).then(()=>setCloudChangeState("synced")).catch(()=>setCloudChangeState("local"));
    },1000);
    return ()=>clearTimeout(timer);
  },[metaSession,cloudPreferencesReady,changeLogLoaded,changeLog]);
  const saveDashboardLayout=(layout:{order:string[];active:string[]})=>{
    if(!cloudPreferencesReady||!metaSession)return;
    void checkoutApi("save_preferences",{section:"dashboard_layout",value:layout}).catch(()=>{
      setPreferencesError("Não foi possível salvar o layout na nuvem.");
    });
  };
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

  const loadAlerts=async()=>{
    const seq=++alertsSeq.current;
    if(!alertsOn||!metaSession||!selectedAccount||!visibleAccounts.some(a=>a.id===selectedAccount)){setAlertsData([]);setAlertsError("");setAlertsLoading(false);return;}
    const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
    setAlertsLoading(true);setAlertsError("");
    try{const r=await api("entities",{account_id:selectedAccount,level:alertsLevel,since:today,until:today},metaSession);if(seq!==alertsSeq.current)return;setAlertsData((r.items||[]).map((x:{id:string;name:string;spend:number})=>({id:x.id,name:x.name,spend:Number(x.spend)||0})));if(r.partial)setAlertsError("Lista parcial da Meta.");}
    catch(e){if(seq===alertsSeq.current){setAlertsData([]);setAlertsError(e instanceof Error?e.message:"Falha ao carregar alertas.");}}
    finally{if(seq===alertsSeq.current)setAlertsLoading(false);}
  };
  useEffect(()=>{void loadAlerts();},[alertsOn,alertsLevel,selectedAccount,metaSession,hiddenAccountIds,visibilityLoaded]);
  useEffect(()=>{if(!autoRefresh||!alertsOn||!selectedAccount)return;const t=window.setInterval(()=>{if(document.visibilityState==="visible")void loadAlerts();},60000);return()=>clearInterval(t);},[autoRefresh,alertsOn,alertsLevel,selectedAccount,metaSession,hiddenAccountIds]);
  const alertsWarn=alertsData.filter(x=>x.spend>=alertsCap*alertsPct/100).sort((a,b)=>b.spend-a.spend).slice(0,alertsCount);
  const changeEntityStatus=async()=>{
    if(!statusPending||!metaSession||!selectedAccount||statusChanging)return;
    const requested=statusPending;
    setStatusChanging(true);setStatusFeedback("");setEntityError("");
    try{
      const result=await api("update_entity_status",{
        account_id:selectedAccount,entity_id:requested.id,level:requested.level,status:requested.target
      },metaSession);
      if(!result.ok)throw new Error("A Meta não confirmou a alteração.");
      setEntityRows(old=>old.map(item=>item.id===requested.id?{
        ...item,status:result.status||requested.target,
        effective_status:result.effective_status|| (requested.target==="PAUSED"?"PAUSED":item.effective_status)
      }:item));
      setStatusFeedback((requested.target==="PAUSED"?"Pausado: ":"Reativado: ")+requested.name+". Status confirmado pela Meta.");
      addChange({accountId:selectedAccount,accountName:adAccounts.find(a=>a.id===selectedAccount)?.name||selectedAccount,category:requested.level==="campaign"?"Campanha":requested.level==="adset"?"Conjunto":"Anúncio",title:(requested.target==="PAUSED"?"Pausou ":"Reativou ")+requested.name,note:"Alteração de status confirmada pela Meta.",origin:"trackup"});
      setStatusPending(null);
      if(tab==="Campanhas")void loadCampaigns();
      // Requery the authoritative Meta state; effective status may remain inactive due to parent items.
      setTimeout(()=>{void loadEntities();},500);
    }catch(e){
      setEntityError(e instanceof Error?e.message:"Falha ao alterar o status na Meta.");
    }finally{setStatusChanging(false);}
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
    const seq=++todaySpendSeq.current;
    setTodaySpendRows({});setTodaySpendError("");
    if(!metaSession||!selectedAccount||!visibleAccounts.some(a=>a.id===selectedAccount)||tab==="Contas"||page!=="Campanhas"||period==="Hoje"){setTodaySpendBusy(false);return;}
    let stopped=false;
    const fetchToday=async()=>{
      const today=new Date(),date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
      setTodaySpendBusy(true);
      try{
        const response=await api("entities",{level:currentLevel,account_id:selectedAccount,since:date,until:date},metaSession);
        if(stopped||seq!==todaySpendSeq.current)return;
        setTodaySpendRows(Object.fromEntries((response.items||[]).map((x:{id:string;spend:number})=>[x.id,Number(x.spend)||0])));
        if(response.partial)setTodaySpendError("A lista de gastos de hoje pode estar incompleta.");
      }catch(e){if(!stopped&&seq===todaySpendSeq.current)setTodaySpendError(e instanceof Error?e.message:"Não foi possível carregar os gastos de hoje.");}
      finally{if(!stopped&&seq===todaySpendSeq.current)setTodaySpendBusy(false);}
    };
    void fetchToday();
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible"&&navigator.onLine)void fetchToday();},60000);
    return()=>{stopped=true;window.clearInterval(timer);};
  },[metaSession,selectedAccount,tab,page,period,hiddenAccountIds,visibilityLoaded]);
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
      // Mobile browsers can open the return in another tab and lose sessionStorage.
      // Store the short-lived verifier only on this origin; the backend still
      // requires the matching state and verifier hash and consumes the flow once.
      localStorage.setItem("trackup.meta.pending-login",JSON.stringify({
        verifier,state:result.state,created:Date.now()
      }));
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
  useEffect(() => { try { const c = localStorage.getItem("trackup.cards"); const d = localStorage.getItem("trackup.cols"); if(c) setCards(JSON.parse(c)); if(d){const saved=JSON.parse(d);if(Array.isArray(saved)){const next=saved.filter((v:unknown):v is string=>typeof v==="string");if(!next.includes("Gasto / Limite diário"))next.splice(Math.max(0,next.indexOf("Orçamento")),0,"Gasto / Limite diário");setCols(next);}} } catch {} }, []);
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
        {([{label:"Painel",Icon:BarChart3},{label:"Campanhas",Icon:Megaphone},{label:"Alterações recentes",Icon:History},{label:"Integrações",Icon:Plug}]).map(({label,Icon})=><button key={label} onClick={()=>{setPage(label);setMobile(false)}} className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm ${page===label?"bg-[#e1e9fa] font-semibold text-blue-700":"text-[#587096] hover:bg-slate-50"}`}><Icon size={17}/>{label}</button>)}
        <div className="mt-6 rounded-lg border border-[#dce3f1] bg-[#f6f8fc] p-3 text-xs">
          <div className="mb-2 flex items-center justify-between"><strong className="text-[#182d53]">Alterações recentes</strong><button className="font-semibold text-blue-700" onClick={()=>{setPage("Alterações recentes");setMobile(false);}}>Ver todas</button></div>
          {changeLog.length===0?<p className="text-slate-500">Nenhum registro ainda.</p>:changeLog.slice(0,3).map(c=><button key={c.id} className="mb-2 block w-full rounded-md bg-white p-2 text-left last:mb-0" onClick={()=>{setPage("Alterações recentes");setMobile(false);}}><span className="block truncate font-semibold text-slate-800" title={c.title}>{c.title}</span><span className="mt-0.5 block truncate text-[11px] text-blue-700" title={c.accountName||"Sem conta vinculada"}>{c.accountName||"Sem conta vinculada"}</span><span className="mt-1 block truncate text-[11px] text-slate-500" title={c.note||"Sem anotação"}>{c.note?Array.from(c.note).slice(0,15).join("")+(Array.from(c.note).length>15?"…":""):"Sem anotação"}</span><span className="mt-1 block text-[10px] text-slate-400">{logDate(c.createdAt)}</span></button>)}
          <button className="mt-2 w-full rounded-md bg-blue-600 p-2 font-semibold text-white" onClick={()=>{setPage("Alterações recentes");setMobile(false);}}>+ Registrar alteração</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-7">
        <header className="mb-5 flex flex-wrap items-center gap-3"><button className={btn+" md:hidden"} onClick={()=>setMobile(true)} aria-label="Abrir menu"><Menu size={18}/></button><h1 className="mr-auto text-xl font-bold md:text-2xl">{page==="Painel"?"Dashboard Principal":page}</h1>{page==="Painel"&&<div className="flex flex-wrap gap-1">{periods.map(p=><button className={btn+(period===p?" border-blue-500 bg-blue-50 text-blue-700":"")} key={p} onClick={()=>setPeriod(p)}>{p}</button>)}</div>}</header>
        {page==="Painel"&&<div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">{period==="Personalizado"&&<><input aria-label="Data inicial" type="date" className={input} value={since} onChange={e=>setSince(e.target.value)}/><input aria-label="Data final" type="date" className={input} value={until} onChange={e=>setUntil(e.target.value)}/></>}<select aria-label="Produto" className={input} value={chosenProduct} onChange={e=>setChosenProduct(e.target.value)}><option value="">Todos os produtos</option>{checkoutProducts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label="Conta" className={input} value={visibleAccounts.some(a=>a.id===selectedAccount)?selectedAccount:""} onChange={e=>setSelectedAccount(e.target.value)} disabled={!visibleAccounts.length}><option value="">{visibleAccounts.length?"Selecione uma conta":"Nenhuma conta ativada"}</option>{visibleAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className={btn} onClick={()=>{refresh();void loadSummary();void loadCampaigns();}}><RefreshCw className="inline" size={15}/> Atualizar</button><button className={btn} onClick={()=>setHide(!hide)} aria-label={hide?"Mostrar valores":"Ocultar valores"}>{hide?<Eye size={16}/>:<EyeOff size={16}/>}</button><button className={btn} onClick={()=>document.getElementById("trackup-metrics-customizer")?.scrollIntoView({behavior:"smooth",block:"start"})}><Pencil className="inline" size={15}/> Personalizar métricas</button><button disabled title="Aguardando dados reais" className={btn}><Download className="inline" size={15}/> Exportar</button></div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2"><strong>🔔 Alertas de gasto · Hoje</strong><span>{!alertsOn?"Desativados":alertsLoading?"Consultando...":alertsWarn.length+" aviso(s)"}</span><span className="text-slate-500">Limite {money(alertsCap,currency)} · Alerta {alertsPct}%</span><button className="ml-auto rounded border px-2 py-1 text-blue-700" onClick={()=>setAlertsEdit(!alertsEdit)}>{alertsEdit?"Fechar":"Personalizar"}</button><button className="rounded border px-2 py-1 disabled:opacity-40" disabled={alertsLoading||!alertsOn||!selectedAccount} onClick={()=>void loadAlerts()}>Atualizar</button></div>
            {alertsEdit&&<div className="mt-2 flex flex-wrap items-end gap-2 border-t pt-2"><label><input type="checkbox" checked={alertsOn} onChange={e=>setAlertsOn(e.target.checked)}/> Ativar</label><label>Tipo <select className={input} value={alertsLevel} onChange={e=>setAlertsLevel(e.target.value as "campaign"|"adset"|"ad")}><option value="ad">Anúncios</option><option value="adset">Conjuntos</option><option value="campaign">Campanhas</option></select></label><label>Limite diário <input className={input+" w-24"} type="number" min="0.01" step="0.5" value={alertsCap} onChange={e=>setAlertsCap(Math.max(0.01,Number(e.target.value)||0.01))}/></label><label>Avisar em % <input className={input+" w-20"} type="number" min="1" max="100" value={alertsPct} onChange={e=>setAlertsPct(Math.min(100,Math.max(1,Number(e.target.value)||1)))}/></label><label>Máximo <select className={input} value={alertsCount} onChange={e=>setAlertsCount(Number(e.target.value))}>{[3,5,10,20].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>}
            {alertsOn&&alertsError&&<p role="alert" className="mt-2 text-amber-700">{alertsError}</p>}
            {alertsOn&&!selectedAccount&&<p className="mt-2 text-slate-500">Selecione uma conta para monitorar.</p>}
            {alertsOn&&alertsWarn.length>0&&<div className="mt-2 flex flex-wrap gap-2">{alertsWarn.map(x=><span key={x.id} className={"rounded border px-2 py-1 "+(x.spend>=alertsCap?"border-red-200 bg-red-50 text-red-800":"border-amber-200 bg-amber-50 text-amber-800")}><strong>{x.name}</strong> · {money(x.spend,currency)} / {money(alertsCap,currency)} ({Math.round(x.spend/alertsCap*100)}%)</span>)}</div>}
            <p className="mt-1 text-slate-400">Gasto de hoje por item, na conta selecionada. Apenas alertas visuais; não pausa anúncios. Dados da Meta podem ter atraso.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
  <span className="font-semibold text-slate-800">{metaSession?"Meta Ads conectada":"Meta Ads desconectada"}</span>
  {ownerProfile&&<span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-800">Perfil pessoal: {ownerProfile.email}</span>}
  <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/> Atualização automática</label>
  <span>Indicadores: 60 s · campanhas: 120 s · contas: 5 min</span>
  <span>Última consulta: {lastMetaUpdate?new Date(lastMetaUpdate).toLocaleTimeString("pt-BR"):"aguardando"}</span>
  {syncIssue&&<span role="alert" className="text-amber-700">{syncIssue}</span>}
  <span className="text-slate-500">Os dados podem ter atraso de processamento na Meta.</span>
</div>
{preferencesError&&<p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{preferencesError}</p>}
          <TrackupDashboard
  summary={visibleAccounts.some(a=>a.id===selectedAccount)?summary:null}
  accountId={visibleAccounts.some(a=>a.id===selectedAccount)?selectedAccount:""}
  accountName={visibleAccounts.find(a=>a.id===selectedAccount)?.name||""}
  enabledAccountCount={visibleAccounts.length}
  currency={currency}
  hide={hide}
  onManageAccounts={()=>{setPage("Integrações");setIntegration("Facebook Ads");}}
  productSlices={checkoutStats?.product_pie||[]}
  paymentSlices={checkoutStats?.payment_pie||[]}
  cloudLayout={cloudDashboardLayout}
  cloudReady={cloudPreferencesReady}
  onSaveCloudLayout={saveDashboardLayout}
/>
        </div>}
        {page==="Alterações recentes"&&<div className="space-y-4">
          <section className="rounded-xl border border-[#dae3f2] bg-white p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-lg font-bold"><History size={20}/> Diário de alterações</h2><p className="mt-1 text-sm text-slate-500">Anote ajustes de lance, orçamento, criativos e resultados. Pausas e reativações realizadas na TrackUp são registradas automaticamente.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{changeLog.length} registros</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Tipo de alteração<select className={input} value={changeCategory} onChange={e=>setChangeCategory(e.target.value)}>{["Lance / Bid Cap","Orçamento","Criativo","Campanha","Conjunto","Anúncio","Página / Checkout","Outros"].map(x=><option key={x}>{x}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Conta vinculada<select className={input} value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)}><option value="">Sem conta selecionada</option>{adAccounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
            </div>
            <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-slate-600">O que foi alterado?<input className={input} maxLength={180} value={changeTitle} onChange={e=>setChangeTitle(e.target.value)} placeholder="Ex.: Aumentei Bid Cap de US$ 7 para US$ 9 na campanha Moto"/></label>
            <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-slate-600">Anotações / hipótese<textarea className={input+" min-h-24 w-full"} maxLength={2000} value={changeNote} onChange={e=>setChangeNote(e.target.value)} placeholder="Ex.: Aguardar 48 horas e comparar CPA e vendas antes de mexer novamente."/></label>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">Data e hora registradas automaticamente. {cloudChangeState==="synced"?"Sincronização com a nuvem confirmada.":cloudChangeState==="local"?"Dados salvos neste navegador; sincronização entre dispositivos não confirmada.":cloudChangeState==="error"?"Sem conexão com a nuvem; salvamento local ativo.":"Verificando sincronização."}</span><button type="button" disabled={!changeTitle.trim()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>{addChange({accountId:selectedAccount,accountName:adAccounts.find(a=>a.id===selectedAccount)?.name||"",category:changeCategory,title:changeTitle.trim(),note:changeNote.trim(),origin:"manual"});setChangeTitle("");setChangeNote("");}}><Plus size={16}/> Salvar alteração</button></div>
          </section>
          <section className="rounded-xl border border-[#dae3f2] bg-white p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Linha do tempo</h2><input className={input} value={changeSearch} onChange={e=>setChangeSearch(e.target.value)} placeholder="Buscar histórico..."/></div>
            <div className="space-y-3">{changeLog.filter(c=>(c.title+" "+c.note+" "+c.category+" "+c.accountName).toLowerCase().includes(changeSearch.toLowerCase())).length===0?<p className="py-10 text-center text-sm text-slate-500">Nenhuma alteração encontrada. Registre a primeira acima.</p>:changeLog.filter(c=>(c.title+" "+c.note+" "+c.category+" "+c.accountName).toLowerCase().includes(changeSearch.toLowerCase())).map(c=><article key={c.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">{c.category}</span><span className="text-slate-500">{logDate(c.createdAt)}</span>{c.origin==="trackup"&&<span className="rounded-full bg-green-50 px-2 py-1 text-green-700">Registrado automaticamente</span>}</div><h3 className="mt-2 break-words font-semibold">{c.title}</h3><label className="mt-2 flex max-w-md flex-col gap-1 text-xs font-medium text-slate-600">Conta vinculada (editável)
                <select aria-label={"Alterar conta vinculada de "+c.title} className={input+" w-full"} value={c.accountId} onChange={e=>{const account=adAccounts.find(a=>a.id===e.target.value);setChangeLog(old=>old.map(item=>item.id===c.id?{...item,accountId:account?.id||"",accountName:account?.name||""}:item));}}>
                  <option value="">Sem conta vinculada</option>
                  {c.accountId&&!adAccounts.some(a=>a.id===c.accountId)&&<option value={c.accountId}>{c.accountName||"Conta anteriormente vinculada (indisponível)"}</option>}
                  {adAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label></div><button className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" title="Excluir anotação" aria-label={"Excluir "+c.title} onClick={()=>{if(window.confirm("Excluir este registro?"))setChangeLog(old=>old.filter(x=>x.id!==c.id));}}><Trash2 size={16}/></button></div>
              {editingChange===c.id?<div className="mt-3"><textarea className={input+" min-h-20 w-full"} value={c.note} maxLength={2000} onChange={e=>setChangeLog(old=>old.map(x=>x.id===c.id?{...x,note:e.target.value}:x))}/><button className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={()=>setEditingChange(null)}>Concluir</button></div>:<div className="mt-2 flex items-start gap-2"><p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-slate-600">{c.note||"Sem observações."}</p><button className="shrink-0 text-xs font-semibold text-blue-700" onClick={()=>setEditingChange(c.id)}><StickyNote size={14} className="inline"/> Anotar</button></div>}
            </article>)}</div>
          </section>
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
          {statusFeedback&&tab!=="Contas"&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{statusFeedback}</p>}
          {entityError&&tab!=="Contas"&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{entityError}</p>}
          {todaySpendError&&tab!=="Contas"&&<p role="alert" className="text-xs text-amber-700">{todaySpendError}</p>}
          {entityPartial&&tab!=="Contas"&&<p className="text-xs text-amber-700">A Meta tem mais itens do que o limite desta consulta; a lista pode estar incompleta.</p>}
          <div className="overflow-x-auto rounded-xl border border-[#dae3f2] bg-white">
            <table className="w-full min-w-max text-left text-xs">
              <thead className="border-b bg-[#fcfdff] text-slate-500"><tr>
                <th className="p-4">{tab==="Contas"?<input type="checkbox" aria-label="Selecionar todas as contas exibidas" checked={filteredAccounts.length>0&&filteredAccounts.every(a=>selectedAccountIds.includes(a.id))} onChange={e=>setSelectedEntities(old=>({...old,accounts:e.target.checked?Array.from(new Set([...(old["accounts"]||[]),...filteredAccounts.map(a=>a.id)])):(old["accounts"]||[]).filter(id=>!filteredAccounts.some(a=>a.id===id))}))}/>:<input type="checkbox" aria-label="Selecionar itens exibidos" checked={filteredEntities.length>0&&filteredEntities.every(a=>chosenIds.includes(a.id))} onChange={e=>{const key=selectionKey(currentLevel);setSelectedEntities(old=>({...old,[key]:e.target.checked?Array.from(new Set([...(old[key]||[]),...filteredEntities.map(a=>a.id)])):(old[key]||[]).filter(id=>!filteredEntities.some(a=>a.id===id))}));}}/>}</th>
                {cols.map(c=><th className="px-4 py-4 uppercase" key={c}>{c==="Campanha"?(tab==="Contas"?"Conta":tab==="Conjuntos"?"Conjunto":tab==="Anúncios"?"Anúncio":"Campanha"):c==="Vendas Meta"?"Compras Meta":c==="Faturamento"?"Valor compras Meta":c}</th>)}
                {tab!=="Contas"&&<><th className="px-4 py-4">Detalhar</th><th className="px-4 py-4">Controle Meta</th></>}
              </tr></thead>
              <tbody>
                {tab==="Contas"?filteredAccounts.map(a=><tr key={a.id} className={"border-b "+(selectedAccountIds.includes(a.id)?"bg-blue-50/60":"")}><td className="p-4"><input type="checkbox" aria-label={"Selecionar conta "+a.name} checked={selectedAccountIds.includes(a.id)} onChange={e=>selectAccountForTracking(a.id,e.target.checked)}/></td>{cols.map(column=><td key={column} className="px-4 py-4">{column==="Campanha"?<button className="font-semibold text-blue-700" onClick={()=>{setSelectedAccount(a.id);setTab("Campanhas");}}>{a.name}</button>:column==="Status"?(a.account_status===1?"Ativa":"Status "+a.account_status):"—"}</td>)}</tr>):
                  filteredEntities.map(a=><tr key={a.id} className={"border-b "+(chosenIds.includes(a.id)?"bg-blue-50/60":"")}>
                    <td className="p-4"><input type="checkbox" aria-label={"Selecionar "+a.name} checked={chosenIds.includes(a.id)} onChange={e=>selectOne(a.id,e.target.checked)}/></td>
                    {cols.map(column=><td key={column} className="px-4 py-4">{column==="Campanha"?<span className="max-w-80 break-words font-semibold">{a.name}</span>:
                      column==="Status"?a.effective_status:
                      column==="Gasto / Limite diário"?(a.daily_budget&&Number(a.daily_budget)>0?(()=>{
                        const cap=Number(a.daily_budget)/100;
                        const spent=period==="Hoje"?a.spend:todaySpendRows[a.id];
                        if(spent===undefined||!Number.isFinite(spent))return <span className="text-slate-400">{todaySpendBusy?"Carregando...":"Gasto de hoje indisponível"}</span>;
                        const ratio=Math.max(0,spent/cap);
                        return <div className="min-w-40 space-y-1" title={"Gasto hoje: "+money(spent,currency)+" / orçamento diário: "+money(cap,currency)}>
                          <div className="flex items-center justify-between gap-2 whitespace-nowrap"><span className="font-semibold">{money(spent,currency)} / {money(cap,currency)}</span><span className={ratio>=1?"font-semibold text-red-700":ratio>=.8?"font-semibold text-amber-700":"text-slate-500"}>{Math.round(ratio*100)}%</span></div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={"h-full rounded-full transition-all "+(ratio>=1?"bg-red-500":ratio>=.8?"bg-amber-500":"bg-blue-500")} style={{width:Math.min(100,ratio*100)+"%"}}/></div>
                          {ratio>=1&&<span className="text-[10px] font-semibold text-red-700">Orçamento diário atingido</span>}
                        </div>;
                      })():<span className="text-slate-400" title="Não há orçamento diário próprio informado para este item. Pode existir orçamento de campanha ou orçamento vitalício.">Sem limite diário próprio</span>):
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
                    <td className="px-4 py-4"><button type="button" disabled={statusChanging||entityBusy||!(a.status==="PAUSED"||a.status==="ACTIVE")} className={"rounded-md border px-3 py-1.5 font-semibold disabled:opacity-40 "+(a.status==="PAUSED"?"border-green-200 bg-green-50 text-green-800":"border-amber-200 bg-amber-50 text-amber-800")} onClick={()=>{setStatusFeedback("");setEntityError("");setStatusPending({id:a.id,name:a.name,level:currentLevel,current:a.status,target:a.status==="PAUSED"?"ACTIVE":"PAUSED"});}}>{a.status==="PAUSED"?"Reativar":a.status==="ACTIVE"?"Pausar":"Indisponível"}</button></td>
                  </tr>)}
                {(tab==="Contas"?filteredAccounts.length===0:filteredEntities.length===0)&&<tr><td colSpan={cols.length+(tab==="Contas"?1:3)} className="px-6 py-16 text-center text-sm text-slate-500">{tab==="Contas"?"Nenhuma conta corresponde aos filtros ou à seleção atual.":entityBusy?"Buscando dados na Meta...":entityError||"Nenhum item corresponde aos filtros atuais."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
        {page==="Integrações"&&<div className="space-y-5"><p className="text-sm text-slate-500">Conecte suas contas de anúncios e configure o rastreamento.</p><div className="flex gap-1 overflow-auto border-b border-[#dce3f1]">{["Facebook Ads","Produtos e Webhooks","UTMs"].map(t=><button key={t} onClick={()=>setIntegration(t)} className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm ${t===integration?"border-blue-600 font-semibold text-blue-600":"border-transparent text-slate-500"}`}>{t}</button>)}</div><div className="max-w-4xl rounded-xl border border-[#dae3f2] bg-white p-6">{integration==="Facebook Ads"?<><h2 className="mb-3 flex items-center gap-2 font-semibold"><Facebook size={22} className="text-blue-600"/> Conectar com Facebook</h2><p className="mb-5 text-sm leading-6 text-slate-600">O login será realizado pelo Facebook Login for Business oficial. Com as permissões necessárias, o sistema poderá listar contas de anúncios, campanhas ativas e pausadas e controlar os status pela Marketing API.</p>
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
      <div><h3 className="text-sm font-semibold">Escolher contas exibidas no TrackUp</h3><p className="mt-1 text-xs text-slate-500">{visibleAccounts.length} de {adAccounts.length} visíveis. Ocultar aqui não pausa campanhas nem altera sua conta na Meta.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={enableAllAccounts} disabled={hiddenAccountIds.length===0}>Exibir todas</button>
        <button type="button" className={btn} onClick={hideAllAccounts} disabled={visibleAccounts.length===0}>Ocultar todas</button>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Filtrar contas
        <select className={input} value={accountFilter} onChange={e=>setAccountFilter(e.target.value as "all"|"active"|"campaigns")}>
          <option value="all">Todas as contas ({adAccounts.length})</option>
          <option value="active">Somente contas ativas ({adAccounts.filter(a=>a.account_status===1).length})</option>
          <option value="campaigns">Contas com campanhas ativas ({activityCheckedAt?adAccounts.filter(a=>a.account_status===1&&campaignActivity[a.id]===true).length:"verificar"})</option>
        </select>
      </label>
      <button type="button" className={btn} disabled={!metaSession||activityBusy||loadingAccounts} onClick={()=>void checkActiveCampaigns()}>{activityBusy?"Verificando campanhas…":"Verificar campanhas ativas"}</button>
      <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={activityBusy||(accountFilter==="campaigns"&&!activityCheckedAt)||(!matchingAccounts.length&&accountFilter!=="all")} onClick={selectOnlyMatchingAccounts}>Exibir apenas contas filtradas ({matchingAccounts.length})</button>
    </div>
    <p className="mt-2 text-xs text-slate-600">O filtro de campanhas consulta o estado <strong>ACTIVE</strong> na Meta, não o gasto do dia. Contas sem gasto hoje continuam incluídas quando possuem campanha ativa.</p>
    {accountFilter==="campaigns"&&!activityCheckedAt&&!activityBusy&&<p className="mt-2 text-xs text-amber-800">Clique em “Verificar campanhas ativas” para buscar as campanhas diretamente na Meta.</p>}
    {activityCheckedAt&&<p className="mt-2 text-xs text-slate-500">Situação das campanhas consultada em {activityCheckedAt}. Atualize para conferir alterações posteriores.</p>}
    {activityError&&<p role="alert" className="mt-2 text-xs text-amber-800">{activityError}</p>}
    <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
      {matchingAccounts.map(a=>{
        const enabled=!hiddenAccountIds.includes(a.id);
        const campaignResult=campaignActivity[a.id];
        return <label key={a.id} className={"flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border p-3 "+(enabled?"border-blue-200 bg-white":"border-slate-200 bg-slate-100/70 opacity-75")}>
          <div className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{a.name}</span><span className="block truncate text-xs text-slate-500">{a.id} · {a.currency} · Conta {a.account_status===1?"ativa":"status "+a.account_status}{campaignResult===true?" · Campanha ativa":campaignResult===false?" · Sem campanha ativa":activityCheckedAt&&a.account_status===1?" · Verificação indisponível":""}</span></div>
          <div className="flex items-center gap-2"><span className={"text-xs font-semibold "+(enabled?"text-green-700":"text-slate-500")}>{enabled?"Exibir":"Oculta"}</span><input type="checkbox" role="switch" aria-label={"Exibir "+a.name+" no TrackUp"} checked={enabled} onChange={e=>setAccountEnabled(a.id,e.target.checked)} className="h-5 w-5 cursor-pointer accent-blue-600"/></div>
        </label>;
      })}
      {matchingAccounts.length===0&&<p className="rounded-lg border bg-white p-3 text-xs text-slate-500">Nenhuma conta corresponde ao filtro atual.</p>}
    </div>
    <p className="mt-3 text-xs text-slate-500">Suas escolhas de visibilidade são salvas no Supabase quando a sessão está conectada. As contas ocultas continuam autorizadas no Facebook.</p>
  </section>}
  {adAccounts.length===0?<p className="text-sm text-slate-500">{loadingAccounts?"Buscando suas contas na Meta...":"Nenhuma conta de anúncios retornada. Conecte o Facebook ou verifique as permissões de acesso."}</p>:<div className="space-y-2">{adAccounts.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3"><div><strong className="block text-sm">{a.name}</strong><span className="text-xs text-slate-500">{a.id} · {a.currency}</span></div><span className={"rounded-full px-3 py-1 text-xs "+(a.account_status===1?"bg-green-50 text-green-700":"bg-slate-100 text-slate-600")}>{a.account_status===1?"Ativa":"Status "+a.account_status}</span></div>)}</div>}
  {accountWarning.map((warning,i)=><p key={i} className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">{warning}</p>)}
  <p className="mt-3 text-xs text-slate-500">A listagem é consultada diretamente na Marketing API. Gastos e campanhas são consultados pela API da Meta. Valores de compras e ROAS são atribuídos pelo Facebook quando disponíveis e não substituem vendas confirmadas pelo checkout.</p>
</div></>:integration==="Produtos e Webhooks"?<CheckoutIntegrations session={metaSession}/>:<><h2 className="mb-3 font-semibold">{integration}</h2><p className="text-sm text-slate-500">UTMs e eventos são captados pelo código do produto na aba Produtos e Webhooks.</p></>}</div></div>}
        {updated&&<p className="mt-5 text-xs text-slate-400">Interface atualizada às {updated}. Dados externos dependem da integração.</p>}
      </main>
    </div>
    {statusPending&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="meta-status-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 id="meta-status-title" className="text-lg font-bold text-slate-900">Confirmar {statusPending.target==="PAUSED"?"pausa":"reativação"} na Meta</h3>
        <p className="mt-3 break-words text-sm text-slate-700"><strong>{statusPending.name}</strong></p>
        <p className="mt-1 text-xs text-slate-500">{statusPending.level==="campaign"?"Campanha":statusPending.level==="adset"?"Conjunto de anúncios":"Anúncio"} · Conta {selectedAccount}</p>
        <p className="mt-3 text-sm text-slate-700">{statusPending.target==="PAUSED"?"Este item será pausado no próprio Facebook Ads, não apenas ocultado do TrackUp.":"O item será marcado como ativo no Facebook Ads. A entrega ainda depende da campanha, do conjunto, da conta e da revisão da Meta."}</p>
        {entityError&&<p role="alert" className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-800">{entityError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={statusChanging} className={btn} onClick={()=>{setStatusPending(null);setEntityError("");}}>Cancelar</button>
          <button type="button" disabled={statusChanging} className={"rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 "+(statusPending.target==="PAUSED"?"bg-amber-700":"bg-green-700")} onClick={()=>void changeEntityStatus()}>{statusChanging?"Enviando à Meta…":statusPending.target==="PAUSED"?"Confirmar pausa":"Confirmar reativação"}</button>
        </div>
      </div>
    </div>}
    {edit&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-[#15233f]/50 p-4" onClick={()=>setEdit(null)}><div role="dialog" aria-modal="true" aria-label="Personalizar visualização" onClick={e=>e.stopPropagation()} className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{edit==="cards"?"Editar cards do painel":"Editar colunas"}</h2><button onClick={()=>setEdit(null)} aria-label="Fechar"><X size={20}/></button></div><p className="mb-4 text-sm text-slate-500">Marque as informações que deseja exibir. Preferências salvas neste navegador.</p><div className="grid gap-2 sm:grid-cols-2">{(edit==="cards"?allCards:allCols).map(x=><label key={x} className="flex cursor-pointer items-center gap-3 rounded-md border border-[#e1e7f1] p-3 text-sm"><input className="accent-blue-600" type="checkbox" checked={(edit==="cards"?cards:cols).includes(x)} onChange={()=>change(edit,x)}/>{x}</label>)}</div><div className="mt-5 flex justify-end gap-2"><button className={btn} onClick={()=>{const v=edit==="cards"?defaults:defaultCols;if(edit==="cards")setCards(v);else setCols(v);localStorage.setItem("trackup."+edit,JSON.stringify(v));}}>Restaurar padrão</button><button onClick={()=>setEdit(null)} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white">Concluir</button></div></div></div>}
  </div>;
}
