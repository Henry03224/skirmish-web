(() => {
  const S = { on:true, ctx:null, master:null, jetT:0 };
  function ctx(){
    if(S.ctx) return S.ctx;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    S.ctx=new AC();
    S.master=S.ctx.createGain();
    S.master.gain.value=0.7;
    S.master.connect(S.ctx.destination);
    return S.ctx;
  }
  function resume(){ const c=ctx(); if(c&&c.state==="suspended") c.resume(); }
  function attFromDist(dist){
    const d = dist==null ? 0 : dist;
    if(d > 820) return 0;
    return Math.max(0, 1 / (1 + d * d / 90000));
  }
  function crack(vol, bass, noiseDur, hp){
    if(!S.on || vol<=0.02) return;
    const c=ctx(); if(!c||!S.master) return; resume();
    const t=c.currentTime;
    const n=c.createBufferSource();
    const buf=c.createBuffer(1, Math.floor(c.sampleRate*noiseDur), c.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++){
      const e=1-i/d.length;
      d[i]=(Math.random()*2-1)*e*e;
    }
    n.buffer=buf;
    const bp=c.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=hp; bp.Q.value=0.7;
    const ng=c.createGain();
    ng.gain.setValueAtTime(vol*0.9, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t+noiseDur);
    n.connect(bp); bp.connect(ng); ng.connect(S.master);
    n.start(t); n.stop(t+noiseDur+0.02);
    const o=c.createOscillator(), g=c.createGain();
    o.type="triangle";
    o.frequency.setValueAtTime(bass, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, bass*0.35), t+0.12);
    g.gain.setValueAtTime(vol*0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.16);
    o.connect(g); g.connect(S.master);
    o.start(t); o.stop(t+0.18);
  }
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
  window.SFX={
    boot(){ resume(); },
    shoot(w, dist){
      const a=attFromDist(dist);
      if(a<=0) return;
      if(w==="sniper") crack(0.55*a, 90, 0.22, 1800);
      else if(w==="shot") crack(0.62*a, 70, 0.28, 900);
      else if(w==="smg") crack(0.28*a, 140, 0.06, 2200);
      else crack(0.38*a, 120, 0.09, 1600);
    },
    hit(dist){ const a=attFromDist(dist==null?0:dist); if(a>0.05) beep(180,0.07,"square",0.08*a,90); },
    die(){ beep(160,0.28,"sawtooth",0.14,50); noise(0.2,0.12,150); },
    boom(dist){ const a=attFromDist(dist==null?80:dist); if(a<=0) return; noise(0.32,0.28*a,80); beep(90,0.25,"triangle",0.16*a,40); },
    jet(){ const now=performance.now(); if(now-S.jetT<90) return; S.jetT=now; beep(90+Math.random()*30,0.08,"sawtooth",0.04,60); },
    pickup(){ beep(520,0.08,"triangle",0.1); setTimeout(()=>beep(740,0.1,"triangle",0.1),70); },
    ui(){ beep(480,0.05,"triangle",0.08); },
    start(){ beep(392,0.1,"triangle",0.1); setTimeout(()=>beep(523,0.12,"triangle",0.1),90); },
    win(){ beep(392,0.12,"triangle",0.12); setTimeout(()=>beep(523,0.12,"triangle",0.12),120); setTimeout(()=>beep(659,0.2,"triangle",0.12),240); },
    menu(){},
    toggle(){ S.on=!S.on; return S.on; }
  };
})();
