// Harness for the always-on light layer (v1.3.66+): runs the bundle on ANY url, exposes light functions as window.__L
process.on('unhandledRejection',()=>{});
const {JSDOM, VirtualConsole}=require('jsdom'); const fs=require('fs');
function loadLight({url='https://example.com/page', names=[], preGm={}}={}){
  let b=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
  const mark="GM_registerMenuCommand('🎬 MOSSAD: видео и DND'"; const i=b.indexOf(mark); const eol=b.indexOf('\n',i);
  b=b.slice(0,eol+1)+`window.__L={${names.map(n=>`${n}: typeof ${n}!=='undefined'?${n}:null`).join(',')}};\n`+b.slice(eol+1);
  const vc=new VirtualConsole(); const logs=[]; vc.on('log',(...a)=>logs.push(a.join(' '))); vc.on('warn',(...a)=>logs.push('W '+a.join(' '))); vc.on('jsdomError',e=>logs.push('ERR '+e.message));
  const dom=new JSDOM('<!doctype html><body></body>',{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window; w.__gm=Object.assign({},preGm); w.__menu=[]; w.__dl=[];
  w.eval(`function GM_getValue(k,d){return k in window.__gm?window.__gm[k]:d} function GM_setValue(k,v){window.__gm[k]=v} function GM_addValueChangeListener(){return 1}
    function GM_registerMenuCommand(t,f){window.__menu.push({t,f}); return window.__menu.length} function GM_unregisterMenuCommand(){}
    function GM_download(o){window.__dl.push(o); setTimeout(()=>o.onload&&o.onload(),5)} function GM_openInTab(){} function GM_xmlhttpRequest(){} var GM_info={script:{version:'test'}};`);
  w.HTMLElement.prototype.getBoundingClientRect=function(){ return this._rect||{top:0,left:0,right:0,bottom:0,width:0,height:0}; };
  w.eval(b);
  return {w,L:w.__L,logs,dom};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports={loadLight,sleep};
