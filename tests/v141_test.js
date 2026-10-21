const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const key=(w,o,t)=>(t||w.document).dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},o)));
const OLD=process.env.BUNDLE;
(async()=>{ try {
  // ---- 1. first Insert on Saved with empty collection ----
  const scen=[
    ['1a stale ss.active from previous slideshow', {ss:{active:true,circle:1}}, null],
    ['1b prompt textarea focused', {}, 'focus'],
    ['1c site stops keydown propagation (bubble)', {}, 'site'],
    ['1d clean state', {}, null],
  ];
  for (const [name,opt,mode] of scen) {
    const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const {w,T}=load(Object.assign({items, url:'https://grok.com/imagine/saved'},opt));
    const d=w.document; w.sessionStorage.removeItem('mossad_grok_imagine_collection');
    const grid=d.createElement('div'); d.body.appendChild(grid);
    const a=d.createElement('a'); a.href='/imagine/post/'+U(101); a.innerHTML='<video></video>'; grid.appendChild(a);
    await sleep(1500);
    let target=d;
    if (mode==='focus'){ const ta=d.createElement('textarea'); d.body.appendChild(ta); ta.focus(); target=ta; }
    if (mode==='site'){ w.addEventListener('keydown',e=>e.stopImmediatePropagation()); d.addEventListener('keydown',e=>e.stopPropagation(),true); }
    key(w,{key:'Insert',code:'Insert'},target);
    const watching=T.grokIsCollectWatching? T.grokIsCollectWatching():false;
    ok(name+' → 1st press starts collect watch', watching===true, `watching=${watching} toast="${(d.getElementById('mossad-toast')||{}).textContent||''}"`);
    w.close();
  }
  // ---- 2. playlist initial height when widget not laid out ----
  { const items=Array.from({length:119},(_,i)=>({uuid:U(i),convId:'c'+Math.floor(i/5)}));
    const {w,T}=load({items}); const d=w.document; await sleep(1500);
    const pl0=d.getElementById('mossad-playlist-panel'); if(pl0) pl0.remove();
    w.localStorage.removeItem('mossad_playlist_height'); w.localStorage.removeItem('mossad_playlist_width'); T.config.playlistWidth=0;
    // all rects 0 (hidden / not in layout) — harness default for non-video
    T.grokTogglePlaylistPanel(true);
    const pl=d.getElementById('mossad-playlist-panel');
    ok('2a hidden at open → N rows (px), not full length', /px$/.test(pl.style.height) && parseFloat(pl.style.height)<700, `h=${pl.style.height}`);
    const RH=16, HH=30; const orig=w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect=function(){
      if(this.classList&&this.classList.contains('mossad-playlist-item')) return {top:0,left:0,right:200,bottom:RH-1,width:200,height:RH-1};
      if(this.parentNode&&this.parentNode.id==='mossad-playlist-panel'&&this===this.parentNode.firstElementChild) return {top:0,left:0,right:0,bottom:HH,width:200,height:HH};
      return orig.call(this); };
    await sleep(500);
    ok('2b becomes visible → re-measured to exact N rows', pl.style.height===(HH+4+30*RH+2)+'px', `h=${pl.style.height} exp=${HH+4+30*RH+2}`);
    pl.remove(); w.sessionStorage.setItem('mossad_grok_imagine_collection', JSON.stringify({items:items.slice(0,10).map(it=>({url:'https://grok.com/imagine/post/'+it.uuid,convId:it.convId,type:'video'}))}));
    T.grokTogglePlaylistPanel(true);
    ok('2c fewer rows than N → auto', d.getElementById('mossad-playlist-panel').style.height==='auto', d.getElementById('mossad-playlist-panel').style.height);
    w.close(); }
  // ---- 3. random button ----
  { const items=Array.from({length:30},(_,i)=>({uuid:U(i),convId:'c'+Math.floor(i/5)}));
    const {w,T}=load({items, url:'https://grok.com/imagine/saved'}); const d=w.document; await sleep(1500);
    const row=d.getElementById('mossad-gallery-row'); const kids=[...row.children].map(k=>k.id);
    const iMd=kids.indexOf('mossad-gallery-mdmode'), iR=kids.indexOf('mossad-gallery-rndmode'), iH=kids.indexOf('mossad-gallery-hk'), iX=kids.indexOf('mossad-btn-close');
    ok('3a top row: Md, 🔀, ⌨, ×', iR===iMd+1 && iH===iR+1 && iX===iH+1 && !d.getElementById('mossad-btn-hk-settings'), kids.join('|'));
    const rnd=d.getElementById('mossad-gallery-rndmode'), gr=d.getElementById('mossad-gallery-grmode'), md=d.getElementById('mossad-gallery-mdmode');
    ok('3b gap between 🔀 and ⌨', /margin-right:\s*6px/.test(rnd.style.cssText) && /margin-left:\s*auto/.test(d.getElementById('mossad-gallery-hk').style.cssText));
    gr.click(); // seq -> rev
    const col=()=>JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_collection'));
    rnd.click();
    ok('3c 🔀 on → Gr−/Md− (state 4), button active, persisted', col().grpMode==='off' && col().itemMode==='off' && rnd.dataset.active==='1' && gr.textContent==='Gr−' && md.textContent==='Md−', `${col().grpMode}/${col().itemMode} ${gr.textContent} ${md.textContent}`);
    // random sequence: auto steps spread across groups
    w.sessionStorage.setItem('mossad_grok_imagine_ss', JSON.stringify({active:true,circle:1})); const st=T.grokGetPlaylistStructure(); const seen=new Set(); let cur=st.items[0];
    T.grokSyncSlidePosition(cur,{source:'t'});
    const order=[];
    for(let k=0;k<12;k++){ const r=T.grokGetNextSlideItem('auto', cur.url); cur=r.item; order.push(st.items.indexOf(cur)); T.grokSyncSlidePosition(cur,{source:'t'}); seen.add(cur.convId); }
    const monotone=order.every((v,i)=>i===0||v===order[i-1]+1);
    ok('3d auto order random across groups (no repeats)', seen.size>=3 && !monotone && new Set(order).size===order.length, order.join(','));
    const back=T.grokGetNextSlideItem('up', cur.url);
    ok('3e previous uses history', back.fromHistory===true && st.items.indexOf(back.item)===order[order.length-2], `back=${st.items.indexOf(back.item)} exp=${order[order.length-2]}`);
    rnd.click();
    ok('3f 🔀 off → previous Gr/Md restored', col().grpMode==='rev' && col().itemMode==='fwd' && rnd.dataset.active==='0', `${col().grpMode}/${col().itemMode}`);
    rnd.click(); md.click(); // Md off -> fwd
    ok('3g changing Md to active turns random off', rnd.dataset.active==='0' && col().itemMode==='fwd' && col().grpMode==='off', `${col().grpMode}/${col().itemMode}`);
    md.click(); md.click(); md.click(); // fwd->rev->rnd->off
    ok('3h cycling back to Gr−/Md− lights 🔀 again', rnd.dataset.active==='1');
    d.getElementById('mossad-gallery-hk').click();
    ok('3i ⌨ opens settings (Hotkeys)', d.getElementById('mossad-hk-modal') && d.getElementById('mossad-hk-modal').dataset.tab==='hotkeys');
    w.close(); }
  // ---- 4. global defaults ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const gd={slideshowDelay:7, videoLoops:3, playlistRows:44, filenameTemplate:'{id8}-X', bogus:1, widgetZoom:'oops'};
    const {w,T}=load({items, preGm:{mossad_global_defaults: JSON.stringify(gd)}});
    ok('4a site w/o saved config uses GM defaults', T.config.slideshowDelay===7 && T.config.videoLoops===3 && T.config.playlistRows===44 && T.config.filenameTemplate==='{id8}-X' && T.config.widgetZoom===0.9 && !('bogus' in T.config), `${T.config.slideshowDelay}/${T.config.videoLoops}/${T.config.playlistRows}/${T.config.widgetZoom}`);
    const d=w.document; await sleep(1200);
    T.openSettingsWindow('defaults'); const m=d.getElementById('mossad-hk-modal');
    ok('4b 3rd tab "По умолчанию" open, form filled from GM', m.dataset.tab==='defaults' && m.querySelector('[data-pane="defaults"]').style.display!=='none' && m.querySelector('#mossad-def-slideshowDelay').value==='7' && m.querySelector('#mossad-def-playlistRows').value==='44');
    T.config.slideshowDelay=2.5; T.config.videoLoops=5;
    m.querySelector('#mossad-def-take').click();
    ok('4c "Взять текущие" fills form (not saved yet)', m.querySelector('#mossad-def-slideshowDelay').value==='2.5' && JSON.parse(w.__gm.mossad_global_defaults).slideshowDelay===7);
    m.querySelector('#mossad-def-holdpost') ; m.querySelector('#mossad-def-deleteHoldpost').checked=false;
    m.querySelector('#mossad-def-save').click();
    const g=JSON.parse(w.__gm.mossad_global_defaults);
    ok('4d "Сохранить как умолчания" writes GM (hold post → both flags)', g.slideshowDelay===2.5 && g.videoLoops===5 && g.deleteHoldpost===false && g.deleteAutoconfirm===false && !('githubToken' in g) && !('hk' in g), JSON.stringify(g).slice(0,120));
    w.confirm=()=>true; m.querySelector('#mossad-def-factory').click();
    ok('4e "Сбросить к заводским" clears GM, form = factory', !w.__gm.mossad_global_defaults && m.querySelector('#mossad-def-slideshowDelay').value==='1');
    m.querySelector('#mossad-def-playlistRows').value='12'; m.querySelector('#mossad-def-apply').click();
    ok('4f "Применить к этому сайту" → site config saved', T.config.playlistRows===12 && JSON.parse(w.localStorage.getItem('mossad_grok_com_config')).playlistRows===12);
    w.close(); }
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const {w,T}=load({items, preGm:{mossad_global_defaults: JSON.stringify({slideshowDelay:7, playlistRows:44})}, preLs:{mossad_grok_com_config: JSON.stringify({slideshowDelay:3})}});
    ok('4g site WITH saved config keeps its values; missing keys = factory (not GM)', T.config.slideshowDelay===3 && T.config.playlistRows===30, `${T.config.slideshowDelay}/${T.config.playlistRows}`);
    w.close(); }
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'})); const {w,T}=load({items});
    ok('4h no GM defaults → factory', T.config.slideshowDelay===1 && T.config.playlistRows===30); w.close(); }

  // ---- 5. apply in all containers ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const A=load({items, preLs:{mossad_grok_com_config: JSON.stringify({slideshowDelay:3, playlistRows:30, videoLoops:2})}});
    const d=A.w.document; await sleep(1200);
    A.T.openSettingsWindow('defaults'); const m=d.getElementById('mossad-hk-modal');
    ok('5a force checkboxes, all checked by default', m.querySelectorAll('.mossad-def-force').length>20 && m.querySelectorAll('.mossad-def-force:not(:checked)').length===0);
    m.querySelector('#mossad-def-slideshowDelay').value='0';
    m.querySelector('#mossad-def-delayAfterVideo').value='0';
    m.querySelector('#mossad-def-playlistRows').value='50';
    m.querySelector('.mossad-def-force[data-k="playlistRows"]').checked=false;
    A.w.confirm=()=>true; m.querySelector('#mossad-def-apply-all').click();
    const st=JSON.parse(A.w.__gm.mossad_global_defaults_apply||'null');
    const gd=JSON.parse(A.w.__gm.mossad_global_defaults);
    ok('5b stamp + defaults written (0 s accepted)', st && st.keys.includes('slideshowDelay') && !st.keys.includes('playlistRows') && gd.slideshowDelay===0 && gd.delayAfterVideo===0 && gd.playlistRows===50, JSON.stringify(st&&st.keys.length));
    const lsA=JSON.parse(A.w.localStorage.getItem('mossad_grok_com_config'));
    ok('5c this container applied now: selected keys only', A.T.config.slideshowDelay===0 && lsA.slideshowDelay===0 && A.T.config.playlistRows===30 && A.w.localStorage.getItem('mossad_global_defaults_apply_seen')===st.id, `delay=${lsA.slideshowDelay} rows=${A.T.config.playlistRows}`);
    const gm=Object.assign({},A.w.__gm); A.w.close();
    // container B: own saved config, loads later
    const B=load({items, preGm:gm, preLs:{mossad_grok_com_config: JSON.stringify({slideshowDelay:5, playlistRows:20, filenameTemplate:'B'})}});
    const lsB=JSON.parse(B.w.localStorage.getItem('mossad_grok_com_config'));
    ok('5d other container on load: selected keys overwritten, others kept', B.T.config.slideshowDelay===0 && lsB.slideshowDelay===0 && B.T.config.playlistRows===20 && lsB.playlistRows===20 && B.w.localStorage.getItem('mossad_global_defaults_apply_seen')===st.id, `delay=${B.T.config.slideshowDelay} rows=${B.T.config.playlistRows} tpl=${lsB.filenameTemplate}`);
    // live: new stamp arrives while B open (another container pressed the button)
    await sleep(1000);
    gm.mossad_global_defaults=JSON.stringify(Object.assign(JSON.parse(gm.mossad_global_defaults),{videoLoops:7}));
    B.w.__gm.mossad_global_defaults=gm.mossad_global_defaults;
    const st2=JSON.stringify({id:'live-2',ts:Date.now(),keys:['videoLoops']});
    B.w.__gm.mossad_global_defaults_apply=st2; (B.w.__gmL.mossad_global_defaults_apply||[]).forEach(f=>f('mossad_global_defaults_apply',null,st2,true));
    ok('5e already-open tab applies live (GM_addValueChangeListener)', B.T.config.videoLoops===7 && JSON.parse(B.w.localStorage.getItem('mossad_grok_com_config')).videoLoops===7 && B.T.config.slideshowDelay===0);
    B.w.close();
    // B reloads with a later manual change: stamp not re-applied
    const B2=load({items, preGm:Object.assign({},gm,{mossad_global_defaults_apply:st2}), preLs:{mossad_grok_com_config: JSON.stringify({slideshowDelay:4, videoLoops:2}), mossad_global_defaults_apply_seen:'live-2'}});
    ok('5f stamp applied once per container (no re-apply)', B2.T.config.slideshowDelay===4 && B2.T.config.videoLoops===2);
    B2.w.close();
    // container C: new, no config
    const C=load({items, preGm:gm});
    ok('5g new container w/o config: defaults (0 s), nothing persisted', C.T.config.slideshowDelay===0 && C.T.config.playlistRows===50 && !C.w.localStorage.getItem('mossad_grok_com_config'), `delay=${C.T.config.slideshowDelay} rows=${C.T.config.playlistRows}`);
    C.w.close(); }
  // ---- 6. 0 s accepted in widget inputs ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'})); const {w,T}=load({items}); const d=w.document; await sleep(1200);
    d.getElementById('mossad-btn-toggle-panel').click(); await sleep(300);
    const set=(id,v)=>{const el=d.getElementById(id); el.value=v; el.dispatchEvent(new w.Event('input'));};
    set('mossad-in-pdelay','0'); set('mossad-in-vdelay','0'); await sleep(450);
    ok('6a photo 0 s and pause 0 s accepted', T.config.slideshowDelay===0 && T.config.delayAfterVideo===0, `${T.config.slideshowDelay}/${T.config.delayAfterVideo}`);
    set('mossad-in-pdelay',''); await sleep(450);
    ok('6b empty field keeps value', T.config.slideshowDelay===0);
    ok('6c photo input min=0', d.getElementById('mossad-in-pdelay').min==='0');
    w.close(); }
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
