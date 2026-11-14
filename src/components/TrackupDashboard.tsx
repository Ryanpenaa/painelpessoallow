import { useEffect, useRef, useState } from "react";
import { ChevronDown, GripVertical, RotateCcw, Settings2, MoveLeft, MoveRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type MetaDashboardSummary = {
  spend:number; clicks:number; impressions:number; cpc:number; ctr:number; cpm:number;
  reach:number; frequency:number;
  purchases:number|null; purchase_value:number|null; checkouts:number|null;
  link_clicks:number|null; landing_page_views?:number|null; add_to_carts?:number|null;
  leads?:number|null; inline_link_clicks?:number|null; inline_link_click_ctr?:number|null;
  unique_clicks?:number|null; meta_roas:number|null; meta_cpa:number|null; meta_arpu:number|null;
};

type Metric = {id:string; title:string; group:"principal"|"outras"; origin:"meta"|"checkout"; format:"money"|"count"|"percent"|"ratio"; get:(s:MetaDashboardSummary)=>number|null};
const metrics:Metric[]=[
  {id:"spend",title:"Gasto em Ads",group:"principal",origin:"meta",format:"money",get:s=>s.spend},
  {id:"purchases",title:"Compras atribuídas (Meta)",group:"principal",origin:"meta",format:"count",get:s=>s.purchases},
  {id:"purchase_value",title:"Valor de compras (Meta)",group:"principal",origin:"meta",format:"money",get:s=>s.purchase_value},
  {id:"meta_roas",title:"ROAS (Meta)",group:"principal",origin:"meta",format:"ratio",get:s=>s.meta_roas},
  {id:"meta_cpa",title:"CPA (Meta)",group:"principal",origin:"meta",format:"money",get:s=>s.meta_cpa},
  {id:"cpc",title:"CPC (todos os cliques)",group:"principal",origin:"meta",format:"money",get:s=>s.cpc},
  {id:"ctr",title:"CTR (todos os cliques)",group:"principal",origin:"meta",format:"percent",get:s=>s.ctr},
  {id:"cpm",title:"CPM",group:"principal",origin:"meta",format:"money",get:s=>s.cpm},
  {id:"link_clicks",title:"Cliques no link",group:"principal",origin:"meta",format:"count",get:s=>s.link_clicks},
  {id:"landing_page_views",title:"Visualizações da página",group:"principal",origin:"meta",format:"count",get:s=>s.landing_page_views??null},
  {id:"checkouts",title:"Inícios de checkout (Meta)",group:"principal",origin:"meta",format:"count",get:s=>s.checkouts},
  {id:"impressions",title:"Impressões",group:"principal",origin:"meta",format:"count",get:s=>s.impressions},
  {id:"clicks",title:"Todos os cliques",group:"outras",origin:"meta",format:"count",get:s=>s.clicks},
  {id:"reach",title:"Alcance",group:"outras",origin:"meta",format:"count",get:s=>s.reach},
  {id:"frequency",title:"Frequência",group:"outras",origin:"meta",format:"ratio",get:s=>s.frequency},
  {id:"unique_clicks",title:"Cliques únicos",group:"outras",origin:"meta",format:"count",get:s=>s.unique_clicks??null},
  {id:"inline_link_clicks",title:"Cliques em links (inline)",group:"outras",origin:"meta",format:"count",get:s=>s.inline_link_clicks??null},
  {id:"inline_link_click_ctr",title:"CTR de links (inline)",group:"outras",origin:"meta",format:"percent",get:s=>s.inline_link_click_ctr??null},
  {id:"add_to_carts",title:"Adições ao carrinho",group:"outras",origin:"meta",format:"count",get:s=>s.add_to_carts??null},
  {id:"leads",title:"Leads atribuídos",group:"outras",origin:"meta",format:"count",get:s=>s.leads??null},
  {id:"meta_arpu",title:"Ticket médio (Meta)",group:"outras",origin:"meta",format:"money",get:s=>s.meta_arpu},
  {id:"cost_link",title:"Custo por clique no link",group:"outras",origin:"meta",format:"money",get:s=>s.link_clicks&&s.link_clicks>0?s.spend/s.link_clicks:null},
  {id:"cost_landing",title:"Custo por visita à página",group:"outras",origin:"meta",format:"money",get:s=>s.landing_page_views&&s.landing_page_views>0?s.spend/s.landing_page_views:null},
  {id:"cost_checkout",title:"Custo por checkout",group:"outras",origin:"meta",format:"money",get:s=>s.checkouts&&s.checkouts>0?s.spend/s.checkouts:null},
  {id:"lpv_rate",title:"Taxa de visualização da página",group:"outras",origin:"meta",format:"percent",get:s=>s.link_clicks&&s.landing_page_views!==null&&s.landing_page_views!==undefined&&s.link_clicks>0?100*s.landing_page_views/s.link_clicks:null},
  {id:"checkout_rate",title:"Taxa de início de checkout",group:"outras",origin:"meta",format:"percent",get:s=>s.landing_page_views&&s.checkouts!==null&&s.landing_page_views>0?100*s.checkouts/s.landing_page_views:null},
  {id:"purchase_rate",title:"Taxa de conversão (clique → compra)",group:"outras",origin:"meta",format:"percent",get:s=>s.link_clicks&&s.purchases!==null&&s.link_clicks>0?100*s.purchases/s.link_clicks:null}
];
type WidgetId=string;
const widgets=["funnel","product_pie","payment_pie"];
const catalog=[...metrics.map(m=>m.id),...widgets];
const initial=["spend","purchase_value","purchases","meta_roas","meta_cpa","cpc","ctr","cpm","link_clicks","landing_page_views","checkouts","funnel","product_pie","payment_pie"];
const storage="trackup.dashboard.layout.v3";
const colors=["#2563eb","#06b6d4","#6366f1","#0ea5e9","#8b5cf6","#14b8a6","#f59e0b"];
const formatMoney=(v:number,currency:string)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency,maximumFractionDigits:2}).format(v);
const formatCount=(v:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(v);
function formatMetric(metric:Metric,value:number|null,currency:string){
  if(value===null||!Number.isFinite(value))return "—";
  if(metric.format==="money")return formatMoney(value,currency);
  if(metric.format==="percent")return value.toFixed(2)+"%";
  if(metric.format==="ratio")return value.toFixed(2)+(metric.id==="frequency"?"":"x");
  return formatCount(value);
}
type Slice={name:string;value:number};
type Props={
  summary:MetaDashboardSummary|null;
  accountId:string;
  accountName:string;
  enabledAccountCount:number;
  currency:string;
  hide:boolean;
  onManageAccounts:()=>void;
  productSlices?:Slice[];
  paymentSlices?:Slice[];
};
const labelFor=(id:string)=>id==="funnel"?"Funil de conversão":id==="product_pie"?"Compras por produto":id==="payment_pie"?"Compras por pagamento":metrics.find(m=>m.id===id)?.title||id;
function ConversionFunnel({summary}:{summary:MetaDashboardSummary|null}){
  const steps=[
    {label:"Cliques no link",value:summary?.link_clicks??null,shade:"#2563eb"},
    {label:"Visualizações da página de destino",value:summary?.landing_page_views??null,shade:"#3b82f6"},
    {label:"Inícios de checkout",value:summary?.checkouts??null,shade:"#6366f1"},
    {label:"Compras atribuídas",value:summary?.purchases??null,shade:"#0ea5e9"}
  ];
  const first=steps[0].value;
  return <div className="space-y-3 py-3">
    {steps.map((step,i)=>{
      const percent=first!==null&&first>0&&step.value!==null?100*step.value/first:null;
      const width=i===0?100:percent===null?82-i*17:Math.max(12,Math.min(100,percent));
      return <div key={step.label}>
        <div className="mb-1 flex items-end justify-between gap-2 text-xs"><span className="font-medium text-slate-700">{i+1}. {step.label}</span><span className="shrink-0 text-right font-bold text-slate-800">{step.value===null?"—":formatCount(step.value)} <span className="font-normal text-slate-500">({i===0?"100%":percent===null?"—":percent.toFixed(1)+"%"})</span></span></div>
        <div className="h-7 rounded bg-slate-100/80">
          <div className="h-full rounded-l transition-all" style={{width:width+"%",background:step.value===null?"#cbd5e1":step.shade,clipPath:"polygon(0 0,100% 0,calc(100% - 11px) 100%,0 100%)"}}/>
        </div>
      </div>;
    })}
    <p className="text-[11px] leading-relaxed text-slate-500">Base de 100%: cliques no link do anúncio, não todos os cliques. Visualizações da página e conversões dependem de eventos disponíveis na Meta. Os números são atribuídos e podem ter atraso.</p>
  </div>;
}
function PurchasesPie({title,data,note}:{title:string;data?:Slice[];note:string}){
  const clean=(data||[]).filter(s=>s.value>0&&Number.isFinite(s.value));
  const total=clean.reduce((sum,s)=>sum+s.value,0);
  return <div className="flex min-h-56 flex-col items-center justify-center gap-2 py-3">
    {total>0?<><div className="h-48 w-full max-w-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={clean} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>{clean.map((v,i)=><Cell key={v.name} fill={colors[i%colors.length]}/>)}</Pie><Tooltip formatter={(value)=>formatCount(Number(value))}/></PieChart></ResponsiveContainer></div><div className="flex flex-wrap justify-center gap-x-3 gap-y-1">{clean.map((s,i)=><span key={s.name} className="text-[11px] text-slate-600"><span style={{background:colors[i%colors.length]}} className="mr-1 inline-block h-2.5 w-2.5 rounded-full"/>{s.name}: {formatCount(s.value)}</span>)}</div></>:
    <><div className="relative flex h-36 w-36 items-center justify-center rounded-full border-[23px] border-slate-100"><span className="text-sm font-semibold text-slate-400">Sem dados</span></div><p className="max-w-xs text-center text-sm font-medium text-slate-700">{title}</p></>}
    <p className="max-w-sm text-center text-[11px] leading-relaxed text-slate-500">{note}</p>
  </div>;
}
export default function TrackupDashboard({summary,accountId,accountName,enabledAccountCount,currency,hide,onManageAccounts,productSlices,paymentSlices}:Props){
  const [order,setOrder]=useState<WidgetId[]>(catalog);
  const [active,setActive]=useState<WidgetId[]>(initial);
  const [loaded,setLoaded]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [editing,setEditing]=useState(false);
  const [hovered,setHovered]=useState<string|null>(null);
  const dragFrom=useRef<string|null>(null);
  useEffect(()=>{
    try{
      const json=JSON.parse(localStorage.getItem(storage)||"null");
      if(json&&Array.isArray(json.order)&&Array.isArray(json.active)){
        const validOrder=json.order.filter((id:unknown):id is string=>typeof id==="string"&&catalog.includes(id));
        const validActive=json.active.filter((id:unknown):id is string=>typeof id==="string"&&catalog.includes(id));
        setOrder([...new Set([...validOrder,...catalog])]);
        setActive([...new Set(validActive)]);
      }else{
        const prior=JSON.parse(localStorage.getItem("trackup.cards")||"null");
        if(Array.isArray(prior)){
          const map:Record<string,string>={"Gasto em Ads":"spend","Faturamento":"purchase_value","Vendas aprovadas":"purchases","ROAS":"meta_roas","CPA":"meta_cpa","ARPU":"meta_arpu","CPC":"cpc","CTR":"ctr","CPM":"cpm","Cliques":"clicks","Impressões":"impressions","Checkouts iniciados":"checkouts"};
          const prev=prior.map((x:string)=>map[x]).filter(Boolean);
          setActive([...new Set([...prev,...widgets,"link_clicks","landing_page_views"])]);
        }
      }
    }catch{}
    setLoaded(true);
  },[]);
  useEffect(()=>{if(loaded)localStorage.setItem(storage,JSON.stringify({order,active}));},[order,active,loaded]);
  const enabled=(id:string)=>active.includes(id);
  const toggle=(id:string)=>setActive(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const move=(source:string,destination:string)=>{
    if(source===destination||!source||!destination)return;
    setOrder(old=>{const next=[...old];const from=next.indexOf(source);const to=next.indexOf(destination);if(from<0||to<0)return old;next.splice(from,1);next.splice(to,0,source);return next;});
    setHovered(null);
  };
  const activeOrdered=order.filter(enabled);
  const shift=(id:string,delta:number)=>{
    const index=activeOrdered.indexOf(id);
    const target=activeOrdered[index+delta];
    if(target)move(id,target);
  };
  const cardCls="min-w-0 rounded-xl border border-[#dae3f2] bg-white p-4 shadow-sm sm:p-5";
  const widgetHeader=(id:string,chart:boolean)=> <div className="mb-3 flex items-center justify-between gap-2">
    <div className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-[#667b9f]">{labelFor(id)}</div>
    <div className="flex shrink-0 items-center gap-1">
      {editing&&<><button type="button" aria-label={"Mover "+labelFor(id)+" para a esquerda"} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={()=>shift(id,-1)}><MoveLeft size={14}/></button><button type="button" aria-label={"Mover "+labelFor(id)+" para a direita"} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={()=>shift(id,1)}><MoveRight size={14}/></button></>}
      <span draggable onDragStart={e=>{dragFrom.current=id;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",id);}} onDragEnd={()=>{dragFrom.current=null;setHovered(null);}}
        onPointerDown={e=>{if(e.pointerType!=="mouse"){dragFrom.current=id;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}}}}
        onPointerUp={e=>{if(e.pointerType!=="mouse"&&dragFrom.current){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-dashboard-block]");const target=el?.getAttribute("data-dashboard-block");if(target)move(dragFrom.current,target);dragFrom.current=null;}}}
        className="cursor-grab touch-none select-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Segure e arraste para reorganizar"><GripVertical size={18}/></span>
    </div>
  </div>;
  return <div className="space-y-4">
    <section id="trackup-metrics-customizer" className="scroll-mt-5 rounded-xl border border-[#dae3f2] bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-slate-800">Meta Ads</span><span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{enabledAccountCount} conta(s) habilitada(s)</span><span className="text-xs text-slate-500">{accountName?"Visualizando: "+accountName:"Escolha uma conta no filtro acima"}</span></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onManageAccounts} className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Contas</button>
          <button type="button" onClick={()=>setEditing(!editing)} className={"flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold "+(editing?"border-blue-500 bg-blue-50 text-blue-700":"border-slate-200 text-slate-600")}><GripVertical size={14}/>{editing?"Concluir organização":"Organizar blocos"}</button>
          <button type="button" onClick={()=>setExpanded(!expanded)} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Settings2 size={15}/>Personalizar métricas<ChevronDown size={14} className={expanded?"rotate-180":""}/></button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {metrics.filter(m=>m.group==="principal").map(m=><label key={m.id} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600"><input type="checkbox" checked={enabled(m.id)} onChange={()=>toggle(m.id)} className="accent-blue-600"/>{m.title}</label>)}
      </div>
      {expanded&&<div className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-2 text-xs font-semibold text-slate-700">Outras métricas da Meta</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {metrics.filter(m=>m.group==="outras").map(m=><label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 p-2 text-xs text-slate-700"><input type="checkbox" checked={enabled(m.id)} onChange={()=>toggle(m.id)} className="accent-blue-600"/>{m.title}</label>)}
        </div>
        <div className="mt-4 border-t pt-3"><div className="mb-2 text-xs font-semibold text-slate-700">Gráficos e funis</div><div className="flex flex-wrap gap-4">{widgets.map(id=><label key={id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={enabled(id)} onChange={()=>toggle(id)} className="accent-blue-600"/>{labelFor(id)}</label>)}</div></div>
        <div className="mt-4 flex items-center justify-between gap-3"><p className="text-[11px] text-slate-500">Preferências e ordem salvas neste navegador. Dados ausentes aparecem como —.</p><button type="button" onClick={()=>{setOrder(catalog);setActive(initial);}} className="flex items-center gap-1 text-xs font-semibold text-blue-700"><RotateCcw size={14}/> Restaurar padrão</button></div>
      </div>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
      <span>{activeOrdered.length} blocos visíveis · arraste pelo ícone <GripVertical size={13} className="inline"/> para mudar a posição</span>
      <span>Dados da Meta para a conta e período escolhidos; produtos e meios de pagamento dependem do checkout.</span>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
      {activeOrdered.map(id=>{
        const metric=metrics.find(m=>m.id===id);
        const chart=!metric;
        return <section key={id} data-dashboard-block={id}
          onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";if(hovered!==id)setHovered(id);}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setHovered(old=>old===id?null:old);}}
          onDrop={e=>{e.preventDefault();move(e.dataTransfer.getData("text/plain")||dragFrom.current||"",id);dragFrom.current=null;}}
          className={cardCls+(chart?" sm:col-span-2 lg:col-span-2 2xl:col-span-3":"")+(hovered===id?" ring-2 ring-blue-400":"")}>
          {widgetHeader(id,chart)}
          {metric?<><div className="text-2xl font-bold tabular-nums text-[#102142]">{hide?"••••":summary&&accountId?formatMetric(metric,metric.get(summary),currency):"—"}</div><div className="mt-2 text-[11px] leading-5 text-slate-400">{metric.origin==="meta"?"Meta Ads Insights · "+(metric.id==="purchases"||metric.id==="purchase_value"||metric.id==="checkouts"?"conversões atribuídas":"métricas da conta"):"Aguardando checkout"}</div></>:
           id==="funnel"?<ConversionFunnel summary={accountId?summary:null}/>:
           id==="product_pie"?<PurchasesPie title="Compras por produto" data={productSlices} note="Aguardando dados de produtos vendidos via Cakto, Vega, Appmax ou outro checkout. A Meta não identifica o produto de cada compra desta integração."/>:
           <PurchasesPie title="Cartão, Pix e outros pagamentos" data={paymentSlices} note="Aguardando dados da forma de pagamento via webhook do checkout. A Meta Ads não informa se uma compra foi Pix ou cartão."/>}
        </section>;
      })}
    </div>
    {!activeOrdered.length&&<div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhum bloco selecionado. Marque as métricas acima para personalizar seu painel.</div>}
  </div>;
}
