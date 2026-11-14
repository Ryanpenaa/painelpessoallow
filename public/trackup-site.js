/* TrackUp Analytics visitor attribution: embed one script per product.
   Install only when tracking consent requirements are satisfied.
   Never put Meta CAPI tokens or webhook secrets in this file. */
(function(){
  "use strict";
  var script=document.currentScript;
  if(!script)return;
  var src;
  try{src=new URL(script.src);}catch{return;}
  var product=src.searchParams.get("product")||"";
  if(!/^[0-9a-f-]{36}$/i.test(product))return;
  if(!window.__trackupInitialized)window.__trackupInitialized={};
  if(window.__trackupInitialized[product])return;
  window.__trackupInitialized[product]=true;
  var api="https://ystxfmrhbqybdilmuzwc.supabase.co/functions/v1/trackup-visitor?product="+encodeURIComponent(product);
  var current=new URL(location.href);
  var params=current.searchParams;
  var storageKey="trackup.attribution."+product;
  var now=Date.now();
  var session=null;
  try{session=JSON.parse(sessionStorage.getItem(storageKey)||"null");}catch{}
  if(!session||!session.code||now-(session.created||0)>86400000){
    var arr=new Uint8Array(16);crypto.getRandomValues(arr);
    session={code:Array.from(arr,function(x){return x.toString(16).padStart(2,"0");}).join(""),created:now};
  }
  try{sessionStorage.setItem(storageKey,JSON.stringify(session));}catch{}
  function cookie(name){
    var match=document.cookie.match(new RegExp("(?:^|;\\s*)"+name+"=([^;]*)"));
    try{return match?decodeURIComponent(match[1]):"";}catch{return "";}
  }
  var fbclid=params.get("fbclid")||"";
  var fbc=cookie("_fbc")||(fbclid?"fb.1."+now+"."+fbclid:"");
  var utmNames=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"];
  var tracked={};
  utmNames.forEach(function(n){tracked[n]=params.get(n)||"";});
  // Meta URL macro IDs are reliable only if the advertiser configured them in the ad URL.
  tracked.campaign_id=params.get("campaign_id")||params.get("utm_id")||"";
  tracked.adset_id=params.get("adset_id")||"";
  tracked.ad_id=params.get("ad_id")||"";
  function report(event){
    var body={event:event,visit_code:session.code,landing_url:location.origin+location.pathname,
      fbp:cookie("_fbp"),fbc:cookie("_fbc")||fbc,fbclid:fbclid,
      utm_source:tracked.utm_source,utm_medium:tracked.utm_medium,utm_campaign:tracked.utm_campaign,
      utm_content:tracked.utm_content,utm_term:tracked.utm_term,
      campaign_id:tracked.campaign_id,adset_id:tracked.adset_id,ad_id:tracked.ad_id};
    fetch(api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),keepalive:true,mode:"cors"}).catch(function(){});
  }
  // Use a tracking code supported by the checkout provider and expected in its webhook.
  function provider(url){
    var h=url.hostname.toLowerCase();
    if(h==="pay.cakto.com.br"||h.endsWith(".cakto.com.br"))return "cakto";
    if(h==="pay.hotmart.com"||h.endsWith(".hotmart.com"))return "hotmart";
    if(h.indexOf("vega")!==-1)return "vega";
    return "";
  }
  function tagCheckout(anchor){
    if(!anchor||!anchor.href)return;
    var url;
    try{url=new URL(anchor.href,location.href);}catch{return;}
    if(!/^https?:$/.test(url.protocol))return;
    var mode=provider(url);
    if(!mode)return;
    var value="tu_"+session.code;
    if(mode==="hotmart"){
      url.searchParams.set("xcod",value);
    }else if(mode==="cakto"){
      url.searchParams.set("sck",value);
    }else{
      url.searchParams.set("src",value);
    }
    utmNames.forEach(function(k){if(tracked[k]&&!url.searchParams.has(k))url.searchParams.set(k,tracked[k]);});
    if(fbclid&&!url.searchParams.has("fbclid"))url.searchParams.set("fbclid",fbclid);
    anchor.href=url.toString();
    anchor.dataset.trackupCheckout="1";
  }
  function scan(){
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'),tagCheckout);
  }
  scan();
  document.addEventListener("click",function(e){
    var a=e.target&&e.target.closest&&e.target.closest("a[href]");
    if(!a)return;
    tagCheckout(a);
    if(a.dataset.trackupCheckout==="1")report("checkout_click");
  },true);
  if("MutationObserver"in window){
    var observer=new MutationObserver(function(){scan();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  report("page_view");
  // If no Pixel is already present, initialize the configured product pixel.
  // If the page already has a Pixel, avoid injecting another duplicate Pixel base.
  fetch(api,{method:"GET"}).then(function(r){return r.ok?r.json():null;}).then(function(cfg){
    if(!cfg||!cfg.pixel_id||!/^\d{8,30}$/.test(cfg.pixel_id))return;
    if(typeof window.fbq==="function")return;
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments);};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];
      t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
    }(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init",cfg.pixel_id);
    window.fbq("track","PageView");
    window.fbq("track","ViewContent",{content_ids:[product],content_type:"product"});
    setTimeout(function(){report("page_view");},1800);
  }).catch(function(){});
})();