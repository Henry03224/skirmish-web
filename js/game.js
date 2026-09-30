(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const menu = document.getElementById("menu");
  const end = document.getElementById("end");
  const nameInput = document.getElementById("nameInput");
  const roomInput = document.getElementById("roomInput");
  let VW = 1280, VH = 720;
  const GRAV = 0.48, JET = 0.78, MOVE = 0.62, FRIC = 0.86, MAX_VX = 7.4, MAX_VY = 11;
  const MATCH_MS = 120000;
  const SKINS = [
    { hair:"#2b1b14", outfit:"#3dff8a", accent:"#fff", eye:"#1a1a1a" },
    { hair:"#8b1e3f", outfit:"#4db7ff", accent:"#ffe6f0", eye:"#1a1a1a" },
    { hair:"#f2c14e", outfit:"#ff7ad9", accent:"#fff", eye:"#1a1a1a" },
    { hair:"#16324f", outfit:"#ffb020", accent:"#fff3c4", eye:"#1a1a1a" },
    { hair:"#111", outfit:"#ff4d4d", accent:"#fff", eye:"#1a1a1a" },
    { hair:"#5b2c6f", outfit:"#c8ff4d", accent:"#fff", eye:"#1a1a1a" },
  ];
  const MAP = [
    { x:0,y:680,w:1280,h:40 }, { x:80,y:540,w:220,h:18 }, { x:980,y:540,w:220,h:18 },
    { x:430,y:470,w:420,h:18 }, { x:160,y:360,w:180,h:18 }, { x:940,y:360,w:180,h:18 },
    { x:520,y:280,w:240,h:18 }, { x:40,y:200,w:160,h:18 }, { x:1080,y:200,w:160,h:18 },
    { x:300,y:140,w:140,h:16 }, { x:840,y:140,w:140,h:16 },
  ];
  const SPAWNS = [{x:120,y:620},{x:1160,y:620},{x:640,y:430},{x:200,y:320},{x:1080,y:320},{x:640,y:240}];
  const keys = {};
  const sticks = { l:{dx:0,dy:0,on:0}, r:{dx:0,dy:0,on:0} };
  let mode="menu", localTwo=false, net=null, youId="p1";
  let players=[], bullets=[], nades=[], pickups=[], particles=[];
  let startAt=0, winner=null;
  function uid(){ return Math.random().toString(36).slice(2,8); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
  function spawnPoint(){ return SPAWNS[(Math.random()*SPAWNS.length)|0]; }
  function fit(){
    const dpr = Math.min(2, window.devicePixelRatio||1);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w+"px"; canvas.style.height = h+"px";
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0); VW = w; VH = h;
  }
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => setTimeout(fit, 200));
  fit();
  function makePlayer(id,name,si,kind){
    const s = spawnPoint();
    return { id,name,kind,skin:SKINS[si%SKINS.length], x:s.x,y:s.y,vx:0,vy:0,dir:1,aim:0, hp:100,jet:100,ammo:28,nades:2,weapon:"pistol", kills:0,deaths:0,alive:true,respawn:0,fireCd:0,nadeCd:0, input:{l:0,r:0,u:0,d:0,jet:0,fire:0,nade:0} };
  }
  function resetWorld(list){
    players=list; bullets=[]; nades=[]; particles=[];
    pickups=[{x:640,y:250,t:"smg",tmr:0},{x:170,y:330,t:"shot",tmr:0},{x:1110,y:330,t:"health",tmr:0}];
    startAt=performance.now(); winner=null; mode="play";
    menu.classList.add("hidden"); end.classList.add("hidden"); goFs();
  }
  function startSolo(){
    const name=(nameInput.value||"PLAYER").toUpperCase();
    const list=[makePlayer("p1",name,0,"human")];
    for(let i=0;i<4;i++) list.push(makePlayer("bot"+i,"BOT "+(i+1),i+1,"bot"));
    youId="p1"; localTwo=false; net=null; resetWorld(list);
  }
  function startLocal(){
    resetWorld([ makePlayer("p1",(nameInput.value||"P1").toUpperCase(),0,"human"), makePlayer("p2","P2",1,"human"), makePlayer("bot0","BOT 1",2,"bot"), makePlayer("bot1","BOT 2",3,"bot") ]);
    youId="p1"; localTwo=true; net=null;
  }
  function platHit(p){
    const sy=VH/720;
    for(const m of MAP){
      const mx=m.x*(VW/1280), my=m.y*sy, mw=m.w*(VW/1280), mh=m.h*sy;
      const px=p.x*(VW/1280), py=p.y*sy;
      if(px>mx && px<mx+mw && py+18*sy>my && py+18*sy<my+mh+16*sy && p.vy>=0){ p.y=(my/sy)-18; p.vy=0; return true; }
    }
    return false;
  }
  function readHuman(p, slot){
    const i=p.input;
    if(slot===1){
      if(localTwo){ i.l=keys.a?1:0; i.r=keys.d?1:0; i.u=keys.w?1:0; i.d=keys.s?1:0; i.jet=keys[" "]?1:0; i.fire=keys.j?1:0; i.nade=keys.k?1:0; }
      else {
        i.l = keys.a||keys.arrowleft||sticks.l.dx<-0.25?1:0;
        i.r = keys.d||keys.arrowright||sticks.l.dx>0.25?1:0;
        i.jet = keys[" "]||keys.shift||sticks.l.dy<-0.55?1:0;
        i.fire = keys.j||keys.z||keys.enter||sticks.r.on?1:0;
        i.nade = keys.k||keys.x?1:0;
        if(sticks.r.on) p.aim = Math.atan2(sticks.r.dy, sticks.r.dx);
      }
    } else {
      i.l=keys.arrowleft?1:0; i.r=keys.arrowright?1:0; i.jet=keys.shift?1:0; i.fire=keys["/"]?1:0; i.nade=keys["."]?1:0;
    }
  }
  function botThink(p){
    const foes=players.filter(o=>o.alive&&o.id!==p.id);
    if(!foes.length) return;
    foes.sort((a,b)=>dist(a,p)-dist(b,p));
    const t=foes[0];
    p.input.l=t.x<p.x-20?1:0; p.input.r=t.x>p.x+20?1:0;
    p.input.jet=t.y<p.y-30||p.y>620?1:0;
    p.input.fire=dist(t,p)<420&&Math.random()<0.32?1:0;
    p.dir=t.x>=p.x?1:-1; p.aim=Math.atan2(t.y-p.y,t.x-p.x);
  }
  function fire(p){
    if(p.fireCd>0||p.ammo<=0) return;
    const w=p.weapon, n=w==="shot"?5:1;
    const spread=w==="shot"?0.28:w==="smg"?0.08:0.03;
    const spd=w==="shot"?13:16, dmg=w==="shot"?12:w==="smg"?9:16;
    p.fireCd=w==="smg"?6:w==="shot"?26:15; p.ammo-=w==="shot"?2:1;
    const base=p.aim|| (p.dir>0?0:Math.PI);
    for(let i=0;i<n;i++){
      const a=base+(Math.random()-0.5)*spread;
      bullets.push({x:p.x+Math.cos(a)*20,y:p.y+Math.sin(a)*6,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,owner:p.id,dmg,life:50});
    }
  }
  function throwNade(p){
    if(p.nadeCd>0||p.nades<=0) return;
    p.nades--; p.nadeCd=48;
    const a=p.aim||(p.dir>0?-0.4:Math.PI+0.4);
    nades.push({x:p.x,y:p.y,vx:Math.cos(a)*8,vy:Math.sin(a)*8-3,owner:p.id,fuse:70});
  }
  function explode(x,y,owner,r,dmg){
    for(let i=0;i<16;i++) particles.push({x,y,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8,life:18,c:"#ffb020"});
    for(const p of players){ if(!p.alive) continue; const d=Math.hypot(p.x-x,p.y-y); if(d<r) hurt(p,dmg*(1-d/r),owner); }
  }
  function hurt(p,dmg,owner){
    p.hp-=dmg;
    if(p.hp<=0){ p.hp=0; p.alive=false; p.deaths++; p.respawn=80; const k=players.find(o=>o.id===owner); if(k&&k.id!==p.id) k.kills++; }
  }
  function stepPlayer(p){
    if(!p.alive){
      p.respawn--;
      if(p.respawn<=0){ const s=spawnPoint(); Object.assign(p,{x:s.x,y:s.y,vx:0,vy:0,hp:100,jet:100,ammo:28,nades:2,weapon:"pistol",alive:true}); }
      return;
    }
    if(p.input.l){ p.vx-=MOVE; p.dir=-1; }
    if(p.input.r){ p.vx+=MOVE; p.dir=1; }
    p.vx=clamp(p.vx*FRIC,-MAX_VX,MAX_VX);
    if(p.input.jet&&p.jet>0){ p.vy-=JET; p.jet-=1.1; particles.push({x:p.x,y:p.y+16,vx:0,vy:2,life:8,c:"#7cf"}); }
    else p.jet=Math.min(100,p.jet+0.45);
    p.vy=clamp(p.vy+GRAV,-MAX_VY,MAX_VY);
    p.x+=p.vx; p.y+=p.vy; p.x=clamp(p.x,16,1264);
    if(p.y>760){ p.hp=0; hurt(p,999,p.id); }
    platHit(p);
    if(p.fireCd>0) p.fireCd--; if(p.nadeCd>0) p.nadeCd--;
    if(p.input.fire) fire(p); if(p.input.nade) throwNade(p);
    if(p.kind==="human" && !sticks.r.on) p.aim=p.dir>0?0:Math.PI;
    for(const pk of pickups){
      if(pk.tmr>0){ pk.tmr--; continue; }
      if(Math.hypot(pk.x-p.x,pk.y-p.y)<28){
        if(pk.t==="health") p.hp=Math.min(100,p.hp+40);
        if(pk.t==="smg"){ p.weapon="smg"; p.ammo=40; }
        if(pk.t==="shot"){ p.weapon="shot"; p.ammo=16; }
        pk.tmr=400;
      }
    }
  }
  function stepWorld(){
    const left=MATCH_MS-(performance.now()-startAt);
    if(left<=0&&!winner){
      winner=[...players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths)[0];
      mode="end";
      document.getElementById("endTitle").textContent=winner.name+" wins";
      document.getElementById("endBody").textContent=players.map(p=>p.name+" "+p.kills+"K/"+p.deaths+"D").join(" · ");
      end.classList.remove("hidden"); return;
    }
    for(const p of players){ if(p.kind==="bot") botThink(p); stepPlayer(p); }
    for(const b of bullets){
      b.x+=b.vx; b.y+=b.vy; b.life--;
      for(const p of players){ if(!p.alive||p.id===b.owner) continue; if(Math.hypot(p.x-b.x,p.y-b.y)<16){ hurt(p,b.dmg,b.owner); b.life=0; } }
    }
    bullets=bullets.filter(b=>b.life>0);
    for(const n of nades){ n.vy+=0.28; n.x+=n.vx; n.y+=n.vy; n.fuse--; if(n.fuse<=0) explode(n.x,n.y,n.owner,90,55); }
    nades=nades.filter(n=>n.fuse>0);
    for(const q of particles){ q.x+=q.vx; q.y+=q.vy; q.life--; }
    particles=particles.filter(q=>q.life>0);
  }
  function wx(x){ return x*(VW/1280); }
  function wy(y){ return y*(VH/720); }
  function drawAnime(p){
    const x=wx(p.x), y=wy(p.y), s=Math.min(VW/1280,VH/720)*1.15, sk=p.skin;
    ctx.save(); ctx.translate(x,y); ctx.scale(p.dir||1,1);
    ctx.fillStyle=sk.outfit; ctx.beginPath(); ctx.ellipse(0,8*s,9*s,12*s,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#0b0b0b"; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.moveTo(-7*s,18*s); ctx.lineTo(-2*s,10*s); ctx.moveTo(7*s,18*s); ctx.lineTo(2*s,10*s); ctx.stroke();
    ctx.fillStyle="#f6d7c3"; ctx.beginPath(); ctx.arc(0,-10*s,9*s,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=sk.hair; ctx.beginPath(); ctx.ellipse(0,-16*s,11*s,8*s,0,Math.PI,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10*s,-12*s); ctx.quadraticCurveTo(-14*s,-2*s,-6*s,2*s); ctx.lineTo(-4*s,-8*s); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(-3.2*s,-10*s,2.6*s,3.2*s,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3.2*s,-10*s,2.6*s,3.2*s,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=sk.eye; ctx.beginPath(); ctx.arc(-3*s,-10*s,1.3*s,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(3.4*s,-10*s,1.3*s,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=sk.accent; ctx.fillRect(8*s,-2*s,10*s,3*s);
    ctx.restore();
    ctx.fillStyle="#0008"; ctx.fillRect(x-18,y-36*s,36,4);
    ctx.fillStyle=p.hp>40?"#3dff8a":"#ff4d4d"; ctx.fillRect(x-18,y-36*s,36*(p.hp/100),4);
    ctx.fillStyle="#fff"; ctx.font=(11*s)+"px sans-serif"; ctx.textAlign="center"; ctx.fillText(p.name,x,y-42*s);
  }
  function draw(){
    ctx.clearRect(0,0,VW,VH);
    const g=ctx.createLinearGradient(0,0,0,VH); g.addColorStop(0,"#1a2733"); g.addColorStop(1,"#0a1016");
    ctx.fillStyle=g; ctx.fillRect(0,0,VW,VH);
    ctx.fillStyle="#1b3340"; for(const m of MAP) ctx.fillRect(wx(m.x),wy(m.y),m.w*(VW/1280),m.h*(VH/720));
    ctx.fillStyle="#7cf0ff55"; for(const m of MAP) ctx.fillRect(wx(m.x),wy(m.y),m.w*(VW/1280),3);
    for(const pk of pickups){ if(pk.tmr>0) continue; ctx.fillStyle=pk.t==="health"?"#3dff8a":pk.t==="smg"?"#4db7ff":"#ffb020"; ctx.beginPath(); ctx.arc(wx(pk.x),wy(pk.y),8,0,Math.PI*2); ctx.fill(); }
    for(const q of particles){ ctx.fillStyle=q.c; ctx.fillRect(wx(q.x),wy(q.y),3,3); }
    ctx.fillStyle="#ffd27a"; for(const b of bullets) ctx.fillRect(wx(b.x),wy(b.y),4,2);
    ctx.fillStyle="#9c6"; for(const n of nades){ ctx.beginPath(); ctx.arc(wx(n.x),wy(n.y),5,0,Math.PI*2); ctx.fill(); }
    for(const p of players) if(p.alive) drawAnime(p);
    const me=players.find(p=>p.id===youId)||players[0];
    if(me){
      ctx.fillStyle="#fff"; ctx.font="13px sans-serif"; ctx.textAlign="left";
      ctx.fillText(me.weapon.toUpperCase()+"  "+Math.max(0,me.ammo)+"  JET "+(me.jet|0), 12, 18);
      const left=Math.max(0,MATCH_MS-(performance.now()-startAt));
      ctx.textAlign="right"; ctx.fillText((left/1000|0)+"s", VW-12, 18);
      players.slice().sort((a,b)=>b.kills-a.kills).forEach((p,i)=>{ ctx.fillStyle=p.skin.outfit; ctx.fillText(p.name+" "+p.kills+"/"+p.deaths, VW-12, 38+i*15); });
    }
  }
  function serialize(){ return {startAt,players,bullets,nades,pickups,winner,mode}; }
  function applySnap(s){
    startAt=s.startAt; players=s.players; bullets=s.bullets; nades=s.nades; pickups=s.pickups; winner=s.winner;
    if(s.mode==="end"&&mode!=="end"){ mode="end"; document.getElementById("endTitle").textContent=(winner&&winner.name)+" wins"; end.classList.remove("hidden"); }
  }
  function loop(){
    requestAnimationFrame(loop);
    const me=players.find(p=>p.id===youId);
    if(mode==="play"){
      if(me&&me.kind==="human") readHuman(me,1);
      if(localTwo){ const p2=players.find(p=>p.id==="p2"); if(p2) readHuman(p2,2); }
      const host=!net||net.role==="host";
      if(host){ stepWorld(); if(net&&net.conns){ const snap=serialize(); net.conns.forEach(c=>{ try{c.send({t:"snap",snap});}catch(e){} }); } }
      else if(net&&me){ try{ net.hostConn.send({t:"in",id:youId,input:me.input}); }catch(e){} }
      draw();
    }
  }
  function roomCode(){ const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<5;i++) s+=a[(Math.random()*a.length)|0]; return s; }
  function hostOnline(){
    if(typeof Peer==="undefined"){ alert("PeerJS failed"); return; }
    const code=roomCode(), name=(nameInput.value||"HOST").toUpperCase();
    const peer=new Peer("skirmish-"+code);
    net={role:"host",code,peer,conns:[]}; youId="p1"; localTwo=false;
    peer.on("open",()=>resetWorld([makePlayer("p1",name,0,"human")]));
    peer.on("connection",conn=>{ net.conns.push(conn); conn.on("data",msg=>{ if(msg.t==="hello"&&players.length<6) players.push(makePlayer(msg.id,msg.name,players.length,"human")); if(msg.t==="in"){ const p=players.find(x=>x.id===msg.id); if(p) p.input=msg.input; } }); });
  }
  function joinOnline(){
    if(typeof Peer==="undefined") return;
    const code=(roomInput.value||"").toUpperCase().replace(/[^A-Z0-9]/g,""); if(code.length<4) return;
    const name=(nameInput.value||"GUEST").toUpperCase(), my=uid();
    const peer=new Peer(); net={role:"client",code,peer,hostConn:null}; youId=my; localTwo=false;
    peer.on("open",()=>{ const conn=peer.connect("skirmish-"+code); net.hostConn=conn; conn.on("open",()=>{ conn.send({t:"hello",id:my,name}); menu.classList.add("hidden"); mode="play"; goFs(); }); conn.on("data",msg=>{ if(msg.t==="snap") applySnap(msg.snap); }); });
  }
  function bindStick(el, side){
    const set=(ev)=>{ const t=ev.touches?ev.touches[0]:ev; const r=el.getBoundingClientRect();
      const dx=(t.clientX-(r.left+r.width/2))/(r.width/2); const dy=(t.clientY-(r.top+r.height/2))/(r.height/2);
      sticks[side].dx=clamp(dx,-1,1); sticks[side].dy=clamp(dy,-1,1); sticks[side].on=1;
      el.querySelector("i").style.transform=`translate(${sticks[side].dx*28}px,${sticks[side].dy*28}px)`; };
    const up=()=>{ sticks[side].dx=sticks[side].dy=sticks[side].on=0; el.querySelector("i").style.transform=""; };
    el.addEventListener("touchstart",e=>{e.preventDefault();set(e);},{passive:false});
    el.addEventListener("touchmove",e=>{e.preventDefault();set(e);},{passive:false});
    el.addEventListener("touchend",up);
  }
  bindStick(document.getElementById("stickL"),"l");
  bindStick(document.getElementById("stickR"),"r");
  document.querySelectorAll(".mid button").forEach(b=>{
    const act=b.dataset.act;
    b.addEventListener("touchstart",e=>{ e.preventDefault(); const me=players.find(p=>p.id===youId); if(!me) return; if(act==="jump") me.input.jet=1; if(act==="nade") me.input.nade=1; },{passive:false});
    b.addEventListener("touchend",()=>{ const me=players.find(p=>p.id===youId); if(!me) return; if(act==="jump") me.input.jet=0; if(act==="nade") me.input.nade=0; });
  });
  window.addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true; });
  window.addEventListener("keyup",e=>{ keys[e.key.toLowerCase()]=false; });
  function goFs(){
    const el=document.documentElement;
    const req=el.requestFullscreen||el.webkitRequestFullscreen;
    if(req) req.call(el).catch(()=>{});
    if(screen.orientation&&screen.orientation.lock) screen.orientation.lock("landscape").catch(()=>{});
  }
  document.getElementById("btnFs").onclick=goFs;
  document.getElementById("btnSolo").onclick=startSolo;
  document.getElementById("btnLocal").onclick=startLocal;
  document.getElementById("btnHost").onclick=hostOnline;
  document.getElementById("btnJoin").onclick=joinOnline;
  document.getElementById("btnAgain").onclick=()=>{ mode="menu"; end.classList.add("hidden"); menu.classList.remove("hidden"); if(net&&net.peer) try{net.peer.destroy();}catch(e){} net=null; };
  requestAnimationFrame(loop);
})();
