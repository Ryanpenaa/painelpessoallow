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
  // A genuine checkout-link click is recorded by TrackUp and sent to the
  // product's Meta Pixel as InitiateCheckout. Never use a global fbq("track")
  // because a sales page may have other Pixels installed.
  var pixelEventsEnabled=src.searchParams.get("pixel_events")!=="off";
  var configuredPixelId="";
  var pixelReady=false;
  var pendingCheckoutIC=0;
  // Every deliberate plan choice is an event. Do not lock another plan after a click.
  function fireInitiateCheckout(){
    if(!pixelEventsEnabled)return;
    if(!pixelReady||!configuredPixelId||typeof window.fbq!=="function"){
      pendingCheckoutIC+=1;
      return;
    }
    try{
      window.fbq("trackSingle",configuredPixelId,"InitiateCheckout",{
        content_ids:[product],content_type:"product"
      });
    }catch(e){pendingCheckoutIC+=1;}
  }
  function recordPlanChoice(){
    report("checkout_click");
    fireInitiateCheckout();
  }
  // The basic-plan button opens a modal instead of an external link.
  // Expose a narrow API for that button without recording twice for checkout links.
  window.trackupPlanChoice=window.trackupPlanChoice||{};
  window.trackupPlanChoice[product]=recordPlanChoice;
  function report(event){
    var body={event:event,visit_code:session.code,landing_url:location.origin+location.pathname,
      fbp:cookie("_fbp"),fbc:cookie("_fbc")||fbc,fbclid:fbclid,
      utm_source:tracked.utm_source,utm_medium:tracked.utm_medium,utm_campaign:tracked.utm_campaign,
      utm_content:tracked.utm_content,utm_term:tracked.utm_term,
      campaign_id:tracked.campaign_id,adset_id:tracked.adset_id,ad_id:tracked.ad_id};
    var payload=JSON.stringify(body);
    // sendBeacon survives immediate navigation to the external checkout.
    // text/plain avoids the cross-origin JSON preflight on click.
    if(event==="checkout_click"&&typeof navigator.sendBeacon==="function"){
      try{
        if(navigator.sendBeacon(api,new Blob([payload],{type:"text/plain;charset=UTF-8"})))return;
      }catch(e){}
    }
    fetch(api,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:payload,keepalive:true,mode:"cors"}).catch(function(){});
  }
  // Use a tracking code supported by the checkout provider and expected in its webhook.
  function provider(url){
    var h=url.hostname.toLowerCase();
    if(h==="pay.cakto.com.br"||h.endsWith(".cakto.com.br"))return "cakto";
    if(h==="pay.hotmart.com"||h.endsWith(".hotmart.com"))return "hotmart";
    if(h.indexOf("vega")!==-1||h==="checkout.evangelhokids.cloud")return "vega";
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
    if(a.dataset.trackupCheckout==="1" && !e.defaultPrevented){
      recordPlanChoice();
    }
  },true);
  if("MutationObserver"in window){
    var observer=new MutationObserver(function(){scan();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  report("page_view");
  // Associate the product with its configured Meta Pixel, then flush any IC
  // click that happened before the asynchronous Pixel configuration loaded.
  // No Facebook Purchase is sent by this browser-side checkout click.
  function initializePixel(id){
    if(!/^\d{8,30}$/.test(String(id)))return;
    if(pixelReady&&configuredPixelId===String(id))return;
    configuredPixelId=String(id);
    var hasFbq=typeof window.fbq==="function";
    if(!hasFbq){
      !function(f,b,e,v,n,t,s){
        if(f.fbq)return;
        n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments);};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];
        t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
      }(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
    }
    var initialized=window.__trackupPixelIds||(window.__trackupPixelIds={});
    var exists=initialized[id]===true;
    try{
      if(typeof window.fbq.getState==="function"){
        var state=window.fbq.getState();
        exists=exists||!!(state&&Array.isArray(state.pixels)&&state.pixels.some(function(p){return String(p.id)===String(id);}));
      }
    }catch(e){}
    if(!exists){
      initialized[id]=true;
      window.fbq("init",id);
    }
    window.fbq("trackSingle",id,"PageView");
    window.fbq("trackSingle",id,"ViewContent",{content_ids:[product],content_type:"product"});
    pixelReady=true;
    while(pendingCheckoutIC>0){
      pendingCheckoutIC-=1;
      fireInitiateCheckout();
    }
  }
  // Public pixel ID supplied by the landing page lets IC fire without waiting
  // for the remote product-configuration request.
  var earlyPixel=pixelEventsEnabled?(src.searchParams.get("pixel")||""):"";
  if(/^\d{8,30}$/.test(earlyPixel))initializePixel(earlyPixel);
  fetch(api,{method:"GET"}).then(function(r){return r.ok?r.json():null;}).then(function(cfg){
    if(!cfg||!cfg.pixel_id||!/^\d{8,30}$/.test(cfg.pixel_id))return;
    if(pixelEventsEnabled&&!pixelReady)initializePixel(String(cfg.pixel_id));
    setTimeout(function(){report("page_view");},1800);
  }).catch(function(){});
})();