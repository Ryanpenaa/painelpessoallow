import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { BarChart3, Megaphone, Plug, Pencil, RefreshCw, Eye, EyeOff, Download, X, Menu, Facebook, Search } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });
const supabase = createClient("https://ystxfmrhbqybdilmuzwc.supabase.co", "sb_publishable_GAvjkE8dPmXTvDZmqNAYnw_akiILXaH");
const metaOauthEndpoint = "https://ystxfmrhbqybdilmuzwc.supabase.co/functions/v1/meta-oauth-callback";
const allCards = ["Faturamento", "Lucro operacional", "Gasto em Ads", "CPA", "ARPU", "ROAS", "ROI", "CPC", "CTR", "CPM", "Vendas aprovadas", "Vendas pendentes", "Chargeback", "Margem", "Cliques", "Impressões", "Checkouts iniciados"];
const allCols = ["Status", "Campanha", "Última atualização", "Orçamento", "Gasto", "Vendas Meta", "Vendas TrackUp", "Vendas pendentes", "Faturamento", "Lucro", "ROAS", "CPA", "ARPU", "Impressões", "Cliques", "CPC", "CTR"];
const periods = ["Hoje", "Ontem", "7 dias", "15 dias", "30 dias", "Personalizado"];
const defaults = allCards.slice(0, 6).concat(allCards.slice(10, 14));
const defaultCols = allCols.slice(0, 7).concat(allCols.slice(8, 12), allCols.slice(13, 15));
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
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [connectBusy, setConnectBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [oauthMessage, setOauthMessage] = useState("");
  const [metaConnections, setMetaConnections] = useState<Array<{meta_user_id:string;name:string|null;expires_at:string|null}>>([]);
  const [adAccounts, setAdAccounts] = useState<Array<{id:string;name:string;account_status:number;currency:string}>>([]);
  const [accountWarning, setAccountWarning] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const loadMetaAccounts = async (token:string) => {
    setLoadingAccounts(true);
    try {
      const request = async (action:string) => {
        const response=await fetch(metaOauthEndpoint, {
          method:"POST",
          headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","apikey":"sb_publishable_GAvjkE8dPmXTvDZmqNAYnw_akiILXaH"},
          body:JSON.stringify({action})
        });
        const payload=await response.json();
        if(!response.ok) throw new Error(payload.error || "Erro ao consultar conexões Meta");
        return payload;
      };
      const state=await request("status");
      setMetaConnections(state.connections||[]);
      const data=await request("accounts");
      setAdAccounts(data.accounts||[]);
      setAccountWarning(data.warnings||[]);
    } catch(error) {
      setOauthMessage(error instanceof Error?error.message:"Não foi possível consultar as contas Meta.");
    } finally { setLoadingAccounts(false); }
  };
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({data}) => { if(mounted) setSession(data.session); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if(mounted) setSession(nextSession);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if(session?.access_token) void loadMetaAccounts(session.access_token);
    else {setMetaConnections([]);setAdAccounts([]);}
  }, [session?.access_token]);
  useEffect(() => {
    if(typeof window!=="undefined" && new URLSearchParams(window.location.search).get("meta")==="connected") {
      setPage("Integrações");
      setIntegration("Facebook Ads");
      setOauthMessage("Autorização recebida! Conferindo contas de anúncios...");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const signInOrUp = async (mode: "login" | "signup") => {
    setAuthMessage("");
    if (!email.trim() || password.length < 6) { setAuthMessage("Informe um e-mail e senha com pelo menos 6 caracteres."); return; }
    setAuthBusy(true);
    const credentials = {email: email.trim(), password};
    const {data,error} = mode==="login"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp({...credentials, options:{emailRedirectTo:window.location.origin}});
    setAuthBusy(false);
    if(error) {
      if(error.message.toLowerCase().includes("invalid login credentials")) setAuthMessage("Este e-mail e senha não foram reconhecidos. Se é seu primeiro acesso, clique em Criar minha conta.");
      else if(error.message.toLowerCase().includes("email not confirmed")) setAuthMessage("Confirme seu e-mail pelo link recebido antes de entrar.");
      else setAuthMessage(error.message);
    }
    else if(mode==="signup" && !data.session) setAuthMessage("Cadastro recebido. Verifique seu e-mail para confirmar a conta e depois faça login.");
    else setAuthMessage("Acesso autorizado.");
  };
  const resetPassword = async () => {
    if(!email.trim()) { setAuthMessage("Informe seu e-mail para recuperar a senha."); return; }
    setAuthBusy(true);
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});
    setAuthBusy(false);
    setAuthMessage(error ? error.message : "Se o e-mail estiver cadastrado, você receberá instruções de recuperação.");
  };
  const startMetaConnection = async () => {
    setOauthMessage("");
    if(!session?.access_token) { setOauthMessage("Entre em sua conta TrackUp antes de conectar o Facebook."); return; }
    setConnectBusy(true);
    try {
      const response=await fetch(metaOauthEndpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":"sb_publishable_GAvjkE8dPmXTvDZmqNAYnw_akiILXaH"},
        body: JSON.stringify({action:"authorize"})
      });
      const result=await response.json();
      if(!response.ok || !result.authorization_url || !result.authorization_url.startsWith("https://www.facebook.com/")) {
        throw new Error(result.error || "Não foi possível iniciar a autorização do Facebook.");
      }
      window.location.assign(result.authorization_url);
    } catch(error) {
      setOauthMessage(error instanceof Error ? error.message : "Falha na conexão. Tente novamente.");
      setConnectBusy(false);
    }
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
          <div className="flex flex-wrap items-center gap-2">{period==="Personalizado"&&<><input aria-label="Data inicial" type="date" className={input}/><input aria-label="Data final" type="date" className={input}/></>}<select aria-label="Produto" className={input}><option>Todos os produtos</option></select><select aria-label="Conta" className={input}><option>Todas as contas</option></select><button className={btn} onClick={refresh}><RefreshCw className="inline" size={15}/> Atualizar</button><button className={btn} onClick={()=>setHide(!hide)} aria-label={hide?"Mostrar valores":"Ocultar valores"}>{hide?<Eye size={16}/>:<EyeOff size={16}/>}</button><button className={btn} onClick={()=>setEdit("cards")}><Pencil className="inline" size={15}/> Editar</button><button disabled title="Aguardando dados reais" className={btn}><Download className="inline" size={15}/> Exportar</button></div>
          <div className="rounded-md border border-[#cbd9fc] bg-[#eaf0ff] p-4 text-sm text-blue-700">Nenhuma fonte de dados conectada. <button className="font-semibold underline" onClick={()=>setPage("Integrações")}>Configurar Facebook Ads</button>.</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{cards.map(c=><div key={c} className="min-h-32 rounded-xl border border-[#dae3f2] bg-white p-5"><div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[#667b9f]">{c}</div><div className="text-2xl font-bold">{hide?"••••":"—"}</div><div className="mt-2 text-xs text-slate-400">Aguardando dados reais</div></div>)}</div>
          <div className="grid gap-4 lg:grid-cols-5"><div className="rounded-xl border border-[#dae3f2] bg-white p-6 lg:col-span-3"><h2 className="border-b pb-4 text-sm font-semibold">Funil de Conversão (Meta Ads)</h2><div className="flex min-h-56 items-center justify-center text-center text-sm text-slate-400">Funil disponível após conexão e rastreamento de eventos.</div></div><div className="rounded-xl border border-[#dae3f2] bg-white p-6 lg:col-span-2"><h2 className="border-b pb-4 text-sm font-semibold">Resumo por conta</h2><div className="flex min-h-56 items-center justify-center text-sm text-slate-400">Nenhuma conta conectada.</div></div></div>
        </div>}
        {page==="Campanhas"&&<div className="space-y-4">
          <div className="flex overflow-auto border-b border-[#dce3f1]">{["Contas","Campanhas","Conjuntos","Anúncios"].map(t=><button key={t} onClick={()=>setTab(t)} className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm ${t===tab?"border-blue-600 font-semibold text-blue-600":"border-transparent text-slate-500"}`}>{t}</button>)}</div>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#dae3f2] bg-white p-4"><label className="flex flex-col gap-1 text-xs text-slate-500">Status<select value={status} onChange={e=>setStatus(e.target.value)} className={input}><option>Qualquer</option><option>Ativo</option><option>Pausado</option></select></label><label className="flex flex-col gap-1 text-xs text-slate-500">Período<select value={period} onChange={e=>setPeriod(e.target.value)} className={input}>{periods.map(p=><option key={p}>{p}</option>)}</select></label>{period==="Personalizado"&&<><input aria-label="Data inicial" type="date" className={input}/><input aria-label="Data final" type="date" className={input}/></>}<label className="flex flex-1 items-center gap-2 rounded-md border border-[#d9e1ef] bg-white px-3"><Search size={15}/><input className="min-w-28 flex-1 py-2 text-sm outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome"/></label><button className={btn} onClick={()=>setEdit("cols")}>Colunas</button><button className={btn} onClick={refresh}>Atualizar</button><button className={btn} disabled title="Aguardando dados reais">Exportar</button></div>
          <div className="overflow-x-auto rounded-xl border border-[#dae3f2] bg-white"><table className="w-full min-w-max text-left text-xs"><thead className="border-b bg-[#fcfdff] text-slate-500"><tr><th className="p-4"><input type="checkbox" disabled aria-label="Selecionar tudo"/></th>{cols.map(c=><th className="px-4 py-4 uppercase" key={c}>{c==="Campanha"?tab==="Contas"?"Conta":tab==="Conjuntos"?"Conjunto":tab==="Anúncios"?"Anúncio":c:c}</th>)}</tr></thead><tbody><tr><td colSpan={cols.length+1} className="px-6 py-20 text-center"><div className="mx-auto max-w-sm"><Megaphone size={30} className="mx-auto mb-3 text-slate-300"/><strong className="block text-base">Nenhum dado conectado</strong><p className="mt-2 text-sm text-slate-500">Ao autorizar o Facebook, as contas e suas campanhas reais aparecerão aqui. Pausar e ativar exigirá permissão oficial.</p><button className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white" onClick={()=>setPage("Integrações")}>Ir para Integrações</button></div></td></tr></tbody></table></div>
        </div>}
        {page==="Integrações"&&<div className="space-y-5"><p className="text-sm text-slate-500">Conecte suas contas de anúncios e configure o rastreamento.</p><div className="flex gap-1 overflow-auto border-b border-[#dce3f1]">{["Facebook Ads","Pixel de Rastreio","UTMs","Webhook API"].map(t=><button key={t} onClick={()=>setIntegration(t)} className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm ${t===integration?"border-blue-600 font-semibold text-blue-600":"border-transparent text-slate-500"}`}>{t}</button>)}</div><div className="max-w-4xl rounded-xl border border-[#dae3f2] bg-white p-6">{integration==="Facebook Ads"?<><h2 className="mb-3 flex items-center gap-2 font-semibold"><Facebook size={22} className="text-blue-600"/> Conectar com Facebook</h2><p className="mb-5 text-sm leading-6 text-slate-600">O login será realizado pelo Facebook Login for Business oficial. Com as permissões necessárias, o sistema poderá listar contas de anúncios, campanhas ativas e pausadas e controlar os status pela Marketing API.</p><div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Integração Meta configurada para teste com usuários autorizados no aplicativo. Faça login no TrackUp para conectar sua conta.</div>
{!session ? <div className="mb-5 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-4">
  <h3 className="mb-2 font-semibold">{authMode==="signup"?"Criar meu acesso ao TrackUp":"Entrar no TrackUp"}</h3>
  <p className="mb-3 text-xs text-slate-500">Primeiro crie um acesso ao TrackUp. Depois autorize o Facebook com sua conta de anúncios. São dois logins diferentes.</p>
  <form onSubmit={e=>{e.preventDefault(); void signInOrUp(authMode);}} className="space-y-3">
    <input aria-label="E-mail TrackUp" type="email" required autoComplete="email" placeholder="Seu e-mail" value={email} onChange={e=>setEmail(e.target.value)} className={input+" w-full"}/>
    <input aria-label="Senha TrackUp" type="password" required minLength={6} autoComplete={authMode==="signup"?"new-password":"current-password"} placeholder="Senha (mínimo 6 caracteres)" value={password} onChange={e=>setPassword(e.target.value)} className={input+" w-full"}/>
    <div className="flex flex-wrap gap-2">
      <button disabled={authBusy} type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{authBusy?"Aguarde...":authMode==="signup"?"Criar minha conta":"Entrar"}</button>
      <button disabled={authBusy} type="button" onClick={()=>{setAuthMode(authMode==="signup"?"login":"signup");setAuthMessage("");}} className={btn}>{authMode==="signup"?"Já tenho conta":"Primeiro acesso? Criar conta"}</button>
      {authMode==="login" && <button disabled={authBusy} type="button" onClick={()=>void resetPassword()} className="text-xs text-blue-700 underline">Esqueci minha senha</button>}
    </div>
  </form>
  {authMessage && <p role="status" className="mt-3 text-sm text-slate-700">{authMessage}</p>}
</div> : <div className="mb-5 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-md bg-green-50 px-3 py-2 text-green-800">Acesso TrackUp: {session.user.email}</span><button className={btn} onClick={()=>void supabase.auth.signOut()}>Sair</button></div>}
<button disabled={!session || connectBusy} onClick={()=>void startMetaConnection()} className="rounded-md bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{connectBusy?"Conectando...":"Conectar com Facebook"}</button>
{oauthMessage && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{oauthMessage}</p>}
<div className="mt-6 border-t pt-4">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Contas de anúncios conectadas</h3><button className={btn} disabled={!session||loadingAccounts} onClick={()=>session?.access_token&&void loadMetaAccounts(session.access_token)}>{loadingAccounts?"Consultando...":"Atualizar contas"}</button></div>
  {metaConnections.length>0 && <p className="mb-3 text-sm text-green-700">{metaConnections.length} perfil(is) Facebook autorizado(s): {metaConnections.map(c=>c.name||c.meta_user_id).join(", ")}</p>}
  {adAccounts.length===0?<p className="text-sm text-slate-500">{loadingAccounts?"Buscando suas contas na Meta...":"Nenhuma conta de anúncios retornada. Conecte o Facebook ou verifique as permissões de acesso."}</p>:<div className="space-y-2">{adAccounts.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3"><div><strong className="block text-sm">{a.name}</strong><span className="text-xs text-slate-500">{a.id} · {a.currency}</span></div><span className={"rounded-full px-3 py-1 text-xs "+(a.account_status===1?"bg-green-50 text-green-700":"bg-slate-100 text-slate-600")}>{a.account_status===1?"Ativa":"Status "+a.account_status}</span></div>)}</div>}
  {accountWarning.map((warning,i)=><p key={i} className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">{warning}</p>)}
  <p className="mt-3 text-xs text-slate-500">A listagem é consultada diretamente na Marketing API. Relatórios de gastos e campanhas ainda serão sincronizados em uma etapa separada.</p>
</div></>:<><h2 className="mb-3 font-semibold">{integration}</h2><p className="text-sm text-slate-500">Reservado para uma próxima etapa, depois do login com Facebook e da consulta de campanhas.</p></>}</div></div>}
        {updated&&<p className="mt-5 text-xs text-slate-400">Interface atualizada às {updated}. Dados externos dependem da integração.</p>}
      </main>
    </div>
    {edit&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-[#15233f]/50 p-4" onClick={()=>setEdit(null)}><div role="dialog" aria-modal="true" aria-label="Personalizar visualização" onClick={e=>e.stopPropagation()} className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{edit==="cards"?"Editar cards do painel":"Editar colunas"}</h2><button onClick={()=>setEdit(null)} aria-label="Fechar"><X size={20}/></button></div><p className="mb-4 text-sm text-slate-500">Marque as informações que deseja exibir. Preferências salvas neste navegador.</p><div className="grid gap-2 sm:grid-cols-2">{(edit==="cards"?allCards:allCols).map(x=><label key={x} className="flex cursor-pointer items-center gap-3 rounded-md border border-[#e1e7f1] p-3 text-sm"><input className="accent-blue-600" type="checkbox" checked={(edit==="cards"?cards:cols).includes(x)} onChange={()=>change(edit,x)}/>{x}</label>)}</div><div className="mt-5 flex justify-end gap-2"><button className={btn} onClick={()=>{const v=edit==="cards"?defaults:defaultCols;if(edit==="cards")setCards(v);else setCols(v);localStorage.setItem("trackup."+edit,JSON.stringify(v));}}>Restaurar padrão</button><button onClick={()=>setEdit(null)} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white">Concluir</button></div></div></div>}
  </div>;
}
