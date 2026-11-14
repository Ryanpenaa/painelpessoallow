import {useEffect,useState} from "react";
import {Copy,Plus,RefreshCw,ShieldCheck,Link2,CheckCircle2,AlertTriangle} from "lucide-react";

const endpoint="https://ystxfmrhbqybdilmuzwc.supabase.co/functions/v1/trackup-checkouts";
type Product={id:string;name:string;currency:string;active:boolean};
type Connection={id:string;product_id:string;platform:string;external_product_id:string|null;webhook_url:string|null;enabled:boolean;last_event_at:string|null};
type TrackedSale={id:string;product_name:string;platform:string;status:string;transaction_id:string;payment_method:string;amount:number;currency:string;campaign_id:string|null;utm_campaign:string|null;tracking_visit_code:string|null;meta_delivery:string;created_at:string};
const platforms=[{id:"cakto",name:"Cakto"},{id:"hotmart",name:"Hotmart"},{id:"vega",name:"Vega Checkout"},{id:"other",name:"Outra plataforma"}];
export default function CheckoutIntegrations({session}:{session:string|null}){
 const [products,setProducts]=useState<Product[]>([]);
 const [connections,setConnections]=useState<Connection[]>([]);
 const [recentSales,setRecentSales]=useState<TrackedSale[]>([]);
 const [name,setName]=useState("");
 const [currency,setCurrency]=useState("BRL");
 const [productId,setProductId]=useState("");
 const [platform,setPlatform]=useState("cakto");
 const [externalId,setExternalId]=useState("");
 const [providerSecret,setProviderSecret]=useState("");
 const [pixelId,setPixelId]=useState("");
 const [capiToken,setCapiToken]=useState("");
 const [testEventCode,setTestEventCode]=useState("");
 const [pixelEnabled,setPixelEnabled]=useState(false);
 const [pixelHasToken,setPixelHasToken]=useState(false);
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState("");
 const [error,setError]=useState("");
 const fetchApi=async(action:string,details:Record<string,unknown>={})=>{
   if(!session)throw Error("Conecte seu Facebook antes de cadastrar integrações.");
   const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session},body:JSON.stringify({action,...details})});
   const result=await res.json();
   if(!res.ok)throw Error(result.error||"Falha ao comunicar com Supabase.");
   return result;
 };
 const refresh=async()=>{
  setError("");
  try{
   const data=await fetchApi("list");
   setProducts(data.products||[]);
   setConnections(data.connections||[]);
   const recent=await fetchApi("recent_sales").catch(()=>({sales:[]}));
   setRecentSales(recent.sales||[]);
   setProductId(id=>(data.products||[]).some((p:Product)=>p.id===id)?id:(data.products||[])[0]?.id||"");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar produtos.");}
 };
 useEffect(()=>{if(session)void refresh();else{setProducts([]);setConnections([]);}},[session]);
 const createProduct=async()=>{
  if(!name.trim())return;
  setBusy(true);setError("");setFeedback("");
  try{const value=await fetchApi("create_product",{name:name.trim(),currency});setName("");setProductId(value.product.id);await refresh();setFeedback("Produto criado. Agora escolha sua plataforma e gere a URL exclusiva.");}
  catch(e){setError(e instanceof Error?e.message:"Falha ao criar produto.");}
  finally{setBusy(false);}
 };
 const loadPixel=async(id:string)=>{
  if(!id){setPixelId("");setPixelEnabled(false);setPixelHasToken(false);return;}
  try{
   const response=await fetchApi("pixel_config",{product_id:id});
   setPixelId(response.pixel?.pixel_id||"");
   setPixelEnabled(!!response.pixel?.enabled);
   setPixelHasToken(!!response.pixel?.has_token);
   setTestEventCode(response.pixel?.test_event_code||"");
   setCapiToken("");
  }catch(e){setError(e instanceof Error?e.message:"Erro ao consultar Pixel.");}
 };
 useEffect(()=>{if(session&&productId)void loadPixel(productId);},[session,productId]);
 const savePixel=async()=>{
  setBusy(true);setError("");setFeedback("");
  try{
   await fetchApi("save_pixel",{product_id:productId,pixel_id:pixelId.trim(),access_token:capiToken.trim(),enabled:pixelEnabled,test_event_code:testEventCode.trim()});
   setCapiToken("");setPixelHasToken(true);
   setFeedback("Pixel e API de Conversões configurados. Faça uma compra de teste para validar a entrega.");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar a configuração do Pixel.");}
  finally{setBusy(false);}
 };
 const installCode=productId?'<script async src="https://painelpessoallow.lovable.app/trackup-site.js?product='+encodeURIComponent(productId)+'"></script>':"";
 const createConnection=async()=>{
  if(!productId)return;
  setBusy(true);setError("");setFeedback("");
  try{
   await fetchApi("create_connection",{product_id:productId,platform,external_product_id:externalId.trim(),provider_secret:providerSecret.trim()});
   setExternalId("");setProviderSecret("");
   await refresh();setFeedback("Webhook criado. Copie a URL e cadastre-a na plataforma de checkout.");
  }catch(e){setError(e instanceof Error?e.message:"Falha ao criar webhook.");}
  finally{setBusy(false);}
 };
 const toggle=async(c:Connection)=>{
  setBusy(true);setError("");
  try{await fetchApi("toggle_connection",{id:c.id,enabled:!c.enabled});await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Falha ao atualizar integração.");}
  finally{setBusy(false);}
 };
 const inputClass="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500";
 return <div className="space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-lg font-semibold text-[#102142]">Integração de vendas por produto</h2><p className="mt-1 text-sm text-slate-500">Uma conexão exclusiva por produto e plataforma. Eventos de aprovação, pendência, reembolso e chargeback alimentam o TrackUp.</p></div>
   <button onClick={()=>void refresh()} disabled={busy||!session} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/>Atualizar</button>
  </div>
  {!session&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Faça login com seu Facebook pessoal em Integrações → Facebook Ads antes de cadastrar produtos.</p>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {feedback&&<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={15} className="mr-2 inline"/>{feedback}</p>}
  <section className="rounded-xl border border-[#dae3f2] bg-white p-4 sm:p-5">
   <div className="mb-4 flex items-center gap-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">1</span><h3 className="font-semibold">Cadastrar produto no TrackUp</h3></div>
   <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px_auto]">
    <label className="text-xs text-slate-500">Nome do produto<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Formação Mecânico Automotivo" className={inputClass}/></label>
    <label className="text-xs text-slate-500">Moeda<select value={currency} onChange={e=>setCurrency(e.target.value)} className={inputClass}><option>BRL</option><option>USD</option><option>EUR</option></select></label>
    <button disabled={!session||busy||name.trim().length<3} onClick={()=>void createProduct()} className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus size={15} className="mr-1 inline"/>Criar produto</button>
   </div>
  </section>
  <section className="rounded-xl border border-[#dae3f2] bg-white p-4 sm:p-5">
   <div className="mb-4 flex items-center gap-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">2</span><h3 className="font-semibold">Vincular produto à plataforma</h3></div>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs text-slate-500">Produto cadastrado<select className={inputClass} value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Selecione um produto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.currency})</option>)}</select></label>
    <label className="text-xs text-slate-500">Plataforma<select className={inputClass} value={platform} onChange={e=>{setPlatform(e.target.value);setProviderSecret("");}}>{platforms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="text-xs text-slate-500">ID do produto na plataforma (opcional)<input className={inputClass} value={externalId} onChange={e=>setExternalId(e.target.value)} placeholder="Identificador oficial do checkout"/></label>
    <label className="text-xs text-slate-500">{platform==="hotmart"?"Hottok da Hotmart":platform==="cakto"?"Chave secreta do webhook Cakto":"Token adicional (opcional)"}<input className={inputClass} type="password" autoComplete="off" value={providerSecret} onChange={e=>setProviderSecret(e.target.value)} placeholder={platform==="hotmart"?"X-HOTMART-HOTTOK":platform==="cakto"?"Secret da configuração do webhook":"Opcional para esta plataforma"}/></label>
   </div>
   <p className="mt-3 text-xs leading-5 text-slate-500">{platform==="cakto"?"Utilize a chave secreta do webhook criado na Cakto; o TrackUp valida a assinatura HMAC ou o segredo do payload legado.":platform==="hotmart"?"Utilize o Hottok de autenticação da sua conta Hotmart, enviado no cabeçalho X-HOTMART-HOTTOK.":platform==="vega"?"Vega: use a URL exclusiva como segredo de acesso; a documentação consultada não confirmou cabeçalho de assinatura para o webhook.":"Outra plataforma: o formato do evento precisará ser compatível ou ter um adaptador próprio."}</p>
   <button disabled={!session||busy||!productId||((platform==="cakto"||platform==="hotmart")&&providerSecret.trim().length<8)} onClick={()=>void createConnection()} className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Link2 size={16}/>Gerar webhook exclusivo</button>
  </section>
  <section className="rounded-xl border border-[#dae3f2] bg-white p-4 sm:p-5">
   <div className="mb-4 flex items-center gap-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">3</span><h3 className="font-semibold">Pixel Meta + API de Conversões (CAPI)</h3></div>
   <p className="mb-4 text-xs leading-5 text-slate-600">Vincule o Pixel ao produto cadastrado. Os dados do anúncio são captados na página, e a compra aprovada recebida pelo webhook é enviada ao Pixel via servidor. A Meta atribui o evento automaticamente usando seus identificadores.</p>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs text-slate-500">Pixel ID (Gerenciador de Eventos)<input value={pixelId} onChange={e=>setPixelId(e.target.value)} className={inputClass} placeholder="123456789012345"/></label>
    <label className="text-xs text-slate-500">Token da API de Conversões (não fica no site)<input type="password" autoComplete="off" value={capiToken} onChange={e=>setCapiToken(e.target.value)} className={inputClass} placeholder={pixelHasToken?"Token já salvo; deixe vazio para manter":"Cole o token CAPI gerado pela Meta"}/></label>
    <label className="text-xs text-slate-500">Código de evento de teste (opcional)<input value={testEventCode} onChange={e=>setTestEventCode(e.target.value)} className={inputClass} placeholder="TEST12345"/></label>
    <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={pixelEnabled} onChange={e=>setPixelEnabled(e.target.checked)} className="h-4 w-4 accent-blue-600"/>Enviar compras aprovadas para a Meta</label>
   </div>
   <button onClick={()=>void savePixel()} disabled={!session||busy||!productId||!/^\d{8,30}$/.test(pixelId)||(pixelEnabled&&!capiToken&&!pixelHasToken)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Guardar Pixel e CAPI</button>
  </section>
  <section className="rounded-xl border border-[#dae3f2] bg-white p-4 sm:p-5">
   <div className="mb-3 flex items-center gap-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">4</span><h3 className="font-semibold">Código de rastreamento da página</h3></div>
   <p className="mb-3 text-xs leading-5 text-slate-600">Instale o código na página de vendas do produto selecionado. O TrackUp captura os parâmetros de anúncio e acrescenta um identificador ao link do checkout, para conectar a visita à compra recebida por webhook.</p>
   <textarea className="h-20 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs" readOnly value={installCode} placeholder="Selecione um produto para gerar o código"/>
   <button type="button" className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold" disabled={!installCode} onClick={()=>installCode&&navigator.clipboard.writeText(installCode)}><Copy size={14}/>Copiar código da página</button>
   <p className="mt-3 text-xs text-slate-500">Para identificar a campanha e o anúncio internamente, inclua <code>campaign_id</code>, <code>adset_id</code> e <code>ad_id</code> na URL dos seus anúncios usando os parâmetros dinâmicos da Meta. O envio CAPI não força atribuição a uma campanha específica.</p>
  </section>
  <section className="rounded-xl border border-[#dae3f2] bg-white p-4 sm:p-5">
   <h3 className="mb-1 font-semibold">Conexões configuradas</h3>
   <p className="mb-4 text-xs text-slate-500">{connections.length} conexões · compartilhe cada URL somente com a plataforma correspondente. Selecione compra aprovada, pagamento pendente, reembolso e chargeback.</p>
   <div className="space-y-3">
    {connections.map(c=><div key={c.id} className="rounded-xl border border-slate-200 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
       <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-sm font-semibold">{products.find(p=>p.id===c.product_id)?.name||"Produto"}<span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{platforms.find(p=>p.id===c.platform)?.name||c.platform}</span></div><div className="mt-1 text-xs text-slate-500">ID plataforma: {c.external_product_id||"não informado"} · Último evento: {c.last_event_at?new Date(c.last_event_at).toLocaleString("pt-BR"):"aguardando"}</div></div>
       <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={c.enabled} onChange={()=>void toggle(c)} disabled={busy} className="h-4 w-4 accent-blue-600"/>{c.enabled?"Ativo":"Desativado"}</label>
      </div>
      <div className="flex items-center gap-2"><input className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[11px]" value={c.webhook_url||""} readOnly aria-label="URL exclusiva do webhook"/><button className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" onClick={()=>c.webhook_url&&navigator.clipboard.writeText(c.webhook_url)} disabled={!c.webhook_url}><Copy size={14}/>Copiar</button></div>
    </div>)}
    {!connections.length&&<p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Nenhum webhook configurado. Crie um produto e gere sua primeira conexão.</p>}
   </div>
  </section>
  <section className="rounded-xl border border-[#dae3f2] bg-white p-4 sm:p-5">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Últimas vendas e origem dos anúncios</h3><span className="text-xs text-slate-500">{recentSales.length} registros recentes</span></div>
   <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] text-left text-xs">
     <thead className="border-b text-slate-500"><tr><th className="p-3">Produto / plataforma</th><th className="p-3">Venda</th><th className="p-3">Campanha (UTM / ID)</th><th className="p-3">Identificou visita?</th><th className="p-3">Meta CAPI</th></tr></thead>
     <tbody>{recentSales.map(sale=><tr key={sale.id} className="border-b border-slate-100">
      <td className="p-3"><strong className="block">{sale.product_name}</strong><span className="text-slate-500">{sale.platform}</span></td>
      <td className="p-3"><strong className="block">{sale.status}</strong><span>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:sale.currency}).format(sale.amount)}</span><span className="block text-[10px] text-slate-400">{sale.transaction_id}</span></td>
      <td className="p-3"><span className="block break-all">{sale.utm_campaign||"—"}</span><span className="block break-all text-slate-500">{sale.campaign_id||"ID da campanha não captado"}</span></td>
      <td className="p-3">{sale.tracking_visit_code?"Sim":"Não"}</td>
      <td className="p-3">{sale.meta_delivery==="sent"?"Enviado":sale.meta_delivery==="failed"?"Falhou":sale.meta_delivery==="pending"?"Pendente":"Não enviado"}</td>
     </tr>)}</tbody>
    </table>
    {!recentSales.length&&<p className="py-8 text-center text-xs text-slate-500">Sem vendas recebidas por webhook. Quando entrar uma compra, o TrackUp mostrará aqui a campanha identificada e a situação do envio à Meta.</p>}
   </div>
  </section>
  <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-xs leading-5 text-amber-800"><AlertTriangle size={18} className="shrink-0"/><span>Webhooks recebem novas notificações, não recuperam vendas antigas automaticamente. Antes de usar comercialmente, faça um evento de teste e confira a venda em TrackUp. Nunca coloque a URL secreta em anúncios ou páginas públicas.</span></div>
 </div>;
}