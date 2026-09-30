(() => {
  const S = { on:true, ctx:null, master:null, music:null, jetT:0 };
  function ctx(){
    if(S.ctx) return S.ctx;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    S.ctx=new AC();
    S.master=S.ctx.createGain();
    S.master.gain.value=0.55;
    S.master.connect(S.ctx.destination);
    return S.ctx;
  }
  function resume(){ const c=ctx(); if(c&&c.state==="suspended") c.resume(); }
  function beep(freq,dur,type,vol,slide){
    if(!S.on) return; const c=ctx(); if(!c||!S.master) return; resume();
    const o=c.createOscillator(), g=c.createGain();
    o.type=type||"square"; o.frequency.setValueAtTime(freq,c.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,slide),c.currentTime+dur);
    g.gain.setValueAtTime(vol||0.12,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
    o.connect(g); g.connect(S.master); o.start(); o.stop(c.currentTime+dur+0.02);
  }
  function noise(dur,vol,hp){
    if(!S.on) return; const c=ctx(); if(!c||!S.master) return; resume();
    const n=c.createBufferSource(), buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    n.buffer=buf;
    const f=c.createBiquadFilter(); f.type="highpass"; f.frequency.value=hp||400;
    const g=c.createGain(); g.gain.setValueAtTime(vol||0.18,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
    n.connect(f); f.connect(g); g.connect(S.master); n.start(); n.stop(c.currentTime+dur+0.02);
  }
  function startBgm(){
    if(!S.on) return; const c=ctx(); if(!c||!S.master) return; resume(); stopBgm();
    const notes=[196,247,294,330,294,247,220,196];
    const t0=c.currentTime+0.05;
    const osc=c.createOscillator(), gain=c.createGain();
    osc.type="triangle"; gain.gain.value=0.045;
    osc.connect(gain); gain.connect(S.master);
    notes.forEach((n,i)=>osc.frequency.setValueAtTime(n,t0+i*0.28));
    osc.start(t0);
    const bass=c.createOscillator(), bg=c.createGain();
    bass.type="sine"; bg.gain.value=0.05; bass.frequency.setValueAtTime(98,t0);
    bass.connect(bg); bg.connect(S.master); bass.start(t0);
    S.music={osc,bass,timer:null};
    const loop=()=>{ if(!S.music||!S.on) return; const now=c.currentTime; notes.forEach((n,i)=>S.music.osc.frequency.setValueAtTime(n,now+i*0.28)); S.music.timer=setTimeout(loop,2240); };
    S.music.timer=setTimeout(loop,2240);
  }
  function stopBgm(){
    if(!S.music) return;
    try{S.music.osc.stop();}catch(e){}
    try{S.music.bass.stop();}catch(e){}
    if(S.music.timer) clearTimeout(S.music.timer);
    S.music=null;
  }
  window.SFX={
    boot(){ resume(); },
    shoot(w){
      if(w==="sniper"){ beep(220,0.18,"sawtooth",0.16,80); noise(0.08,0.1,200); }
      else if(w==="shot"){ noise(0.16,0.22,300); beep(140,0.12,"sawtooth",0.1,60); }
      else if(w==="smg"){ beep(420,0.05,"square",0.08,180); }
      else { beep(360,0.07,"square",0.1,140); }
    },
    hit(){ beep(180,0.08,"square",0.1,90); },
    die(){ beep(160,0.28,"sawtooth",0.14,50); noise(0.2,0.12,150); },
    boom(){ noise(0.32,0.28,80); beep(90,0.25,"triangle",0.16,40); },
    jet(){ const now=performance.now(); if(now-S.jetT<90) return; S.jetT=now; beep(90+Math.random()*30,0.08,"sawtooth",0.04,60); },
    pickup(){ beep(520,0.08,"triangle",0.1); setTimeout(()=>beep(740,0.1,"triangle",0.1),70); },
    ui(){ beep(480,0.05,"triangle",0.08); },
    start(){ startBgm(); beep(392,0.1,"triangle",0.1); setTimeout(()=>beep(523,0.12,"triangle",0.1),90); },
    win(){ stopBgm(); beep(392,0.12,"triangle",0.12); setTimeout(()=>beep(523,0.12,"triangle",0.12),120); setTimeout(()=>beep(659,0.2,"triangle",0.12),240); },
    menu(){ stopBgm(); },
    toggle(){ S.on=!S.on; if(!S.on) stopBgm(); else startBgm(); return S.on; }
  };
})();
