(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const menu = document.getElementById("menu");
  const end = document.getElementById("end");
  const nameInput = document.getElementById("nameInput");
  const roomInput = document.getElementById("roomInput");
  const WW = 1920, WH = 1080;
  let VW = 1280, VH = 720;
  const GRAV = 0.28, JET = 0.42, MOVE = 0.34, FRIC = 0.90, MAX_VX = 4.2, MAX_VY = 6.4;
  const MATCH_MS = 120000;
  const GUNS = ["pistol","smg","shot","sniper"];
  const GUN = {
    pistol: { n:1, spread:0.03, spd:8.5, dmg:16, cd:18, ammo:28, take:1 },
    smg:    { n:1, spread:0.08, spd:9.2, dmg:8,  cd:8,  ammo:42, take:1 },
    shot:   { n:5, spread:0.30, spd:7.2, dmg:11, cd:32, ammo:16, take:2 },
    sniper: { n:1, spread:0.004,spd:13,  dmg:48, cd:52, ammo:10, take:1 },
  };
  const SKINS = [
    { outfit:"#3dff8a", img:"assets/soldier_green.svg" },
    { outfit:"#4db7ff", img:"assets/soldier_blue.svg" },
    { outfit:"#ff7ad9", img:"assets/soldier_pink.svg" },
    { outfit:"#ffb020", img:"assets/soldier_gold.svg" },
    { outfit:"#ff4d4d", img:"assets/soldier_red.svg" },
    { outfit:"#c8ff4d", img:"assets/soldier_lime.svg" },
  ];
  const fxSrc = { muzzle:"assets/muzzle.svg", bullet:"assets/bullet.svg", flame:"assets/flame.svg", health:"assets/health.svg" };
  const fxImg = {};
  Object.keys(fxSrc).forEach(k=>{ const im=new Image(); im.onload=()=>{ fxImg[k]=im; }; im.src=fxSrc[k]; });
  const spriteImgs = SKINS.map(()=>null);
  SKINS.forEach((sk,i)=>{ const im=new Image(); im.onload=()=>{ spriteImgs[i]=im; }; im.src=sk.img; });
  const MAPS = {
    warehouse: { plats:[
      {x:0,y:1020,w:1920,h:60},{x:80,y:820,w:360,h:22},{x:1480,y:820,w:360,h:22},
      {x:620,y:700,w:680,h:22},{x:200,y:540,w:300,h:20},{x:1420,y:540,w:300,h:20},
      {x:760,y:400,w:400,h:20},{x:60,y:280,w:260,h:18},{x:1600,y:280,w:260,h:18},
      {x:480,y:200,w:220,h:16},{x:1220,y:200,w:220,h:16}],
      spawns:[{x:160,y:960},{x:1760,y:960},{x:960,y:650},{x:280,y:500},{x:1640,y:500},{x:960,y:360}] },
    ruins: { plats:[
      {x:0,y:1020,w:1920,h:60},{x:40,y:760,w:320,h:22},{x:420,y:620,w:240,h:18},
      {x:720,y:740,w:200,h:18},{x:1000,y:560,w:520,h:22},{x:1580,y:700,w:300,h:20},
      {x:120,y:430,w:220,h:16},{x:860,y:360,w:280,h:16},{x:1500,y:380,w:280,h:16},
      {x:560,y:220,w:180,h:16},{x:1180,y:200,w:200,h:16}],
      spawns:[{x:140,y:720},{x:1700,y:660},{x:1100,y:520},{x:180,y:400},{x:1640,y:340},{x:960,y:320}] },
    desert: { plats:[
      {x:0,y:1020,w:1920,h:60},{x:120,y:860,w:280,h:22},{x:1520,y:860,w:280,h:22},
      {x:480,y:740,w:360,h:22},{x:1080,y:740,w:360,h:22},{x:780,y:560,w:360,h:20},
      {x:200,y:480,w:240,h:18},{x:1480,y:480,w:240,h:18},{x:640,y:320,w:200,h:16},
      {x:1080,y:320,w:200,h:16},{x:40,y:240,w:180,h:16},{x:1700,y:240,w:180,h:16}],
      spawns:[{x:200,y:820},{x:1720,y:820},{x:600,y:700},{x:1280,y:700},{x:960,y:520},{x:120,y:220}] }
  };
  const bgImgs = {};
  function loadBgs(){
    const src = window.MAP_IMAGES || {};
    Object.keys(MAPS).forEach(k=>{ const im=new Image(); im.onload=()=>{ bgImgs[k]=im; }; if(src[k]) im.src=src[k]; });
  }
  loadBgs();
  let selectedMap="desert", selectedGun="pistol";
  let MAP = MAPS.desert.plats, SPAWNS = MAPS.desert.spawns, mapId="desert";
  document.querySelectorAll("#mapPick .mapcard").forEach(b=>{ b.onclick=()=>{ document.querySelectorAll("#mapPick .mapcard").forEach(x=>x.classList.remove("on")); b.classList.add("on"); selectedMap=b.dataset.map; }; });
  document.querySelectorAll("#gunPick .mapcard").forEach(b=>{ b.onclick=()=>{ document.querySelectorAll("#gunPick .mapcard").forEach(x=>x.classList.remove("on")); b.classList.add("on"); selectedGun=b.dataset.gun; }; });
  const keys = {}; const sticks = { l:{dx:0,dy:0,on:0}, r:{dx:0,dy:0,on:0} };
  let mode="menu", localTwo=false, net=null, youId="p1";
  let players=[], bullets=[], nades=[], pickups=[], particles=[], flashes=[];
  let startAt=0, winner=null, tick=0;
  function uid(){ return Math.random().toString(36).slice(2,8); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
  function spawnPoint(){ return SPAWNS[(Math.random()*SPAWNS.length)|0]; }
  function fit(){ const dpr=Math.min(2,window.devicePixelRatio||1); const w=window.innerWidth,h=window.innerHeight; canvas.style.width=w+"px"; canvas.style.height=h+"px"; canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); VW=w; VH=h; }
  window.addEventListener("resize", fit); window.addEventListener("orientationchange", ()=>setTimeout(fit,200)); fit();
  function followTarget(){ return players.find(p=>p.id===youId) || players.find(p=>p.kind==="human") || {x:WW/2,y:WH/2,weapon:"pistol"}; }
  function cam(){
    const me=followTarget();
    const zoomed = me.weapon==="sniper" ? 1040 : 820;
    const viewW=zoomed, viewH=zoomed*0.58;
    const sc=Math.max(VW/viewW, VH/viewH);
    const visW=VW/sc, visH=VH/sc;
    const cx=clamp(me.x, visW/2, Math.max(visW/2, WW-visW/2));
    const cy=clamp(me.y, visH/2, Math.max(visH/2, WH-visH/2));
    return {sc, ox:VW/2-cx*sc, oy:VH/2-cy*sc};
  }
  function wx(x){ const c=cam(); return c.ox+x*c.sc; }
  function wy(y){ const c=cam(); return c.oy+y*c.sc; }
  function onScreen(x,y,pad){ pad=pad||80; const sx=wx(x),sy=wy(y); return sx>-pad&&sy>-pad&&sx<VW+pad&&sy<VH+pad; }
  function useMap(id){ mapId=MAPS[id]?id:"desert"; MAP=MAPS[mapId].plats; SPAWNS=MAPS[mapId].spawns; }
  function makePlayer(id,name,si,kind,gun){
    const s=spawnPoint(); const wpn=gun||selectedGun||"pistol";
    return { id,name,kind,skin:SKINS[si%SKINS.length],skinI:si%SKINS.length, x:s.x,y:s.y,vx:0,vy:0,dir:1,aim:0,walk:0,bob:0, hp:100,maxHp:100,jet:100,weapon:wpn,ammo:GUN[wpn].ammo,nades:2, kills:0,deaths:0,alive:true,respawn:0,fireCd:0,nadeCd:0, input:{l:0,r:0,u:0,d:0,jet:0,fire:0,nade:0,swap:0} };
  }
  function resetWorld(list){
    useMap(selectedMap); players=list; bullets=[]; nades=[]; particles=[]; flashes=[];
    pickups=[{x:960,y:360,t:"sniper",tmr:0},{x:240,y:500,t:"smg",tmr:0},{x:1680,y:500,t:"shot",tmr:0},{x:960,y:680,t:"health",tmr:0}];
    startAt=performance.now(); winner=null; mode="play"; menu.classList.add("hidden"); end.classList.add("hidden"); goFs();
  }
  function startSolo(){ const name=(nameInput.value||"PLAYER").toUpperCase(); const list=[makePlayer("p1",name,0,"human",selectedGun)]; const bots=["smg","shot","sniper","pistol"]; for(let i=0;i<4;i++) list.push(makePlayer("bot"+i,"BOT "+(i+1),i+1,"bot",bots[i])); youId="p1"; localTwo=false; net=null; resetWorld(list); }
  function startLocal(){ resetWorld([makePlayer("p1",(nameInput.value||"P1").toUpperCase(),0,"human",selectedGun), makePlayer("p2","P2",1,"human","smg"), makePlayer("bot0","BOT 1",2,"bot","sniper"), makePlayer("bot1","BOT 2",3,"bot","shot")]); youId="p1"; localTwo=true; net=null; }
  function platHit(p){ for(const m of MAP){ if(p.x>m.x && p.x<m.x+m.w && p.y+18>m.y && p.y+18<m.y+m.h+18 && p.vy>=0){ p.y=m.y-18; p.vy=0; return true; } } return false; }
  function readHuman(p, slot){ const i=p.input; if(slot===1){ if(localTwo){ i.l=keys.a?1:0; i.r=keys.d?1:0; i.jet=keys[" "]?1:0; i.fire=keys.j?1:0; i.nade=keys.k?1:0; i.swap=keys.q?1:0; } else { i.l=keys.a||keys.arrowleft||sticks.l.dx<-0.25?1:0; i.r=keys.d||keys.arrowright||sticks.l.dx>0.25?1:0; i.jet=keys[" "]||keys.shift||sticks.l.dy<-0.55?1:0; i.fire=keys.j||keys.z||keys.enter||sticks.r.on?1:0; i.nade=keys.k||keys.x?1:0; i.swap=keys.q||keys.e?1:0; if(sticks.r.on) p.aim=Math.atan2(sticks.r.dy,sticks.r.dx); } } else { i.l=keys.arrowleft?1:0; i.r=keys.arrowright?1:0; i.jet=keys.shift?1:0; i.fire=keys["/"]?1:0; i.nade=keys["."]?1:0; i.swap=keys[","]?1:0; } }
  function botThink(p){ const foes=players.filter(o=>o.alive&&o.id!==p.id); if(!foes.length) return; foes.sort((a,b)=>dist(a,p)-dist(b,p)); const t=foes[0], d=dist(t,p); const range=p.weapon==="sniper"?700:p.weapon==="shot"?220:420; p.input.l=t.x<p.x-24?1:0; p.input.r=t.x>p.x+24?1:0; p.input.jet=t.y<p.y-40||p.y>980?1:0; p.input.fire=d<range&&Math.random()<(p.weapon==="sniper"?0.07:0.16)?1:0; p.dir=t.x>=p.x?1:-1; p.aim=Math.atan2(t.y-p.y,t.x-p.x); }
  function fire(p){
    const g=GUN[p.weapon]||GUN.pistol; if(p.fireCd>0||p.ammo<=0) return;
    p.fireCd=g.cd; p.ammo-=g.take;
    const base=p.aim||(p.dir>0?0:Math.PI);
    flashes.push({x:p.x+Math.cos(base)*26,y:p.y+Math.sin(base)*6,a:base,life:8,max:8});
    for(let i=0;i<g.n;i++){
      const a=base+(Math.random()-0.5)*g.spread;
      bullets.push({x:p.x+Math.cos(a)*22,y:p.y+Math.sin(a)*6,vx:Math.cos(a)*g.spd,vy:Math.sin(a)*g.spd,a,owner:p.id,dmg:g.dmg,life:p.weapon==="sniper"?78:56,sniper:p.weapon==="sniper"});
    }
  }
  function throwNade(p){ if(p.nadeCd>0||p.nades<=0) return; p.nades--; p.nadeCd=56; const a=p.aim||(p.dir>0?-0.4:Math.PI+0.4); nades.push({x:p.x,y:p.y,vx:Math.cos(a)*5.5,vy:Math.sin(a)*5.5-2.2,owner:p.id,fuse:78}); }
  function explode(x,y,owner,r,dmg){ for(let i=0;i<16;i++) particles.push({x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,life:18,c:"#ffb020"}); for(const p of players){ if(!p.alive) continue; const d=Math.hypot(p.x-x,p.y-y); if(d<r) hurt(p,dmg*(1-d/r),owner); } }
  function hurt(p,dmg,owner){ p.hp-=dmg; if(p.hp<=0){ p.hp=0; p.alive=false; p.deaths++; p.respawn=90; const k=players.find(o=>o.id===owner); if(k&&k.id!==p.id) k.kills++; } }
  function cycleGun(p){ const i=GUNS.indexOf(p.weapon); p.weapon=GUNS[(i+1)%GUNS.length]; p.ammo=GUN[p.weapon].ammo; }
  function stepPlayer(p){
    if(!p.alive){ p.respawn--; if(p.respawn<=0){ const s=spawnPoint(); Object.assign(p,{x:s.x,y:s.y,vx:0,vy:0,hp:p.maxHp||100,jet:100,ammo:GUN[p.weapon].ammo,nades:2,alive:true}); } return; }
    const moving = p.input.l||p.input.r;
    if(p.input.l){ p.vx-=MOVE; p.dir=-1; }
    if(p.input.r){ p.vx+=MOVE; p.dir=1; }
    p.vx=clamp(p.vx*FRIC,-MAX_VX,MAX_VX);
    if(moving) p.walk+=0.18; else p.walk*=0.86;
    p.bob = Math.sin(p.walk)*3.2;
    if(p.input.jet&&p.jet>0){
      p.vy-=JET; p.jet-=0.72;
      particles.push({x:p.x+(Math.random()-0.5)*8,y:p.y+22,vx:(Math.random()-0.5)*0.6,vy:1.6+Math.random(),life:14,c:"flame"});
    } else p.jet=Math.min(100,p.jet+0.38);
    p.vy=clamp(p.vy+GRAV,-MAX_VY,MAX_VY); p.x+=p.vx; p.y+=p.vy; p.x=clamp(p.x,16,WW-16);
    if(p.y>WH+40){ p.hp=0; hurt(p,999,p.id); } platHit(p);
    if(p.fireCd>0) p.fireCd--; if(p.nadeCd>0) p.nadeCd--;
    if(p.input.fire) fire(p); if(p.input.nade) throwNade(p);
    if(p.input.swap){ cycleGun(p); p.input.swap=0; }
    if(p.kind==="human" && !sticks.r.on) p.aim=p.dir>0?0:Math.PI;
    for(const pk of pickups){ if(pk.tmr>0){ pk.tmr--; continue; } if(Math.hypot(pk.x-p.x,pk.y-p.y)<30){ if(pk.t==="health") p.hp=Math.min(p.maxHp||100,p.hp+45); if(GUN[pk.t]){ p.weapon=pk.t; p.ammo=GUN[pk.t].ammo; } pk.tmr=380; } }
  }
  function stepWorld(){
    tick++;
    const left=MATCH_MS-(performance.now()-startAt);
    if(left<=0&&!winner){ winner=[...players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths)[0]; mode="end"; document.getElementById("endTitle").textContent=winner.name+" wins"; document.getElementById("endBody").textContent=players.map(p=>p.name+" "+p.kills+"K/"+p.deaths+"D").join(" · "); end.classList.remove("hidden"); return; }
    for(const p of players){ if(p.kind==="bot") botThink(p); stepPlayer(p); }
    for(const b of bullets){ b.x+=b.vx; b.y+=b.vy; b.life--; for(const p of players){ if(!p.alive||p.id===b.owner) continue; if(Math.hypot(p.x-b.x,p.y-b.y)<18){ hurt(p,b.dmg,b.owner); b.life=0; } } }
    bullets=bullets.filter(b=>b.life>0);
    for(const n of nades){ n.vy+=0.18; n.x+=n.vx; n.y+=n.vy; n.fuse--; if(n.fuse<=0) explode(n.x,n.y,n.owner,100,55); }
    nades=nades.filter(n=>n.fuse>0);
    for(const q of particles){ q.x+=q.vx; q.y+=q.vy; q.life--; } particles=particles.filter(q=>q.life>0);
    for(const f of flashes) f.life--; flashes=flashes.filter(f=>f.life>0);
  }
  function drawSoldier(p){
    if(!onScreen(p.x,p.y,90)) return;
    const x=wx(p.x), y=wy(p.y+(p.bob||0)), s=cam().sc*1.25; const im=spriteImgs[p.skinI]; const w=64*s,h=64*s;
    const lean = clamp((p.vx||0)*0.08,-0.18,0.18);
    ctx.save(); ctx.translate(x,y); ctx.rotate(lean); if((p.dir||1)<0) ctx.scale(-1,1);
    if(p.input&&p.input.jet&&p.jet>0 && fxImg.flame){
      const pulse=0.85+Math.sin(tick*0.4)*0.18;
      ctx.drawImage(fxImg.flame, -18*s*pulse, 10*s, 36*s*pulse, 58*s*pulse);
    }
    if(im) ctx.drawImage(im,-w*0.42,-h*0.62,w,h); else { ctx.fillStyle=p.skin.outfit; ctx.fillRect(-8*s,-4*s,16*s,20*s); }
    ctx.restore();
    const barW=44;
    ctx.fillStyle="#0009"; ctx.fillRect(x-barW/2,y-48*s,barW,6);
    ctx.fillStyle=p.hp>40?"#3dff8a":"#ff4d4d"; ctx.fillRect(x-barW/2,y-48*s,barW*(p.hp/(p.maxHp||100)),6);
    ctx.strokeStyle="#fff8"; ctx.strokeRect(x-barW/2,y-48*s,barW,6);
    if(fxImg.health) ctx.drawImage(fxImg.health, x-barW/2-14, y-54*s, 12,12);
    ctx.fillStyle="#fff"; ctx.font=Math.max(10,11*s)+"px sans-serif"; ctx.textAlign="center";
    ctx.fillText(p.name,x,y-56*s);
  }
  function drawHud(me){
    const hp=Math.max(0,me.hp|0), jet=Math.max(0,me.jet|0);
    ctx.fillStyle="#0008"; ctx.fillRect(10,8,210,54);
    if(fxImg.health) ctx.drawImage(fxImg.health,16,12,22,22);
    ctx.fillStyle="#fff"; ctx.font="bold 13px sans-serif"; ctx.textAlign="left";
    ctx.fillText("BUHAY  "+hp,42,28);
    ctx.fillStyle="#0008"; ctx.fillRect(42,34,160,8);
    ctx.fillStyle=hp>40?"#3dff8a":"#ff4d4d"; ctx.fillRect(42,34,160*(hp/100),8);
    ctx.fillStyle="#ffb020"; ctx.fillRect(42,46,160*(jet/100),6);
    ctx.fillStyle="#fff"; ctx.font="12px sans-serif";
    ctx.fillText(me.weapon.toUpperCase()+"  "+Math.max(0,me.ammo)+"   JET "+jet, 16, 78);
    const left=Math.max(0,MATCH_MS-(performance.now()-startAt));
    ctx.textAlign="right"; ctx.fillText((left/1000|0)+"s", VW-12, 18);
  }
  function draw(){
    ctx.clearRect(0,0,VW,VH); ctx.fillStyle="#070b10"; ctx.fillRect(0,0,VW,VH); const c=cam();
    if(bgImgs[mapId]) ctx.drawImage(bgImgs[mapId], c.ox,c.oy,WW*c.sc,WH*c.sc);
    else { const g=ctx.createLinearGradient(0,c.oy,0,c.oy+WH*c.sc); g.addColorStop(0,"#5ec8ff"); g.addColorStop(1,"#f4b36a"); ctx.fillStyle=g; ctx.fillRect(c.ox,c.oy,WW*c.sc,WH*c.sc); }
    ctx.fillStyle="#c47a3acc"; for(const m of MAP) ctx.fillRect(wx(m.x),wy(m.y),m.w*c.sc,m.h*c.sc);
    ctx.fillStyle="#f0c080aa"; for(const m of MAP) ctx.fillRect(wx(m.x),wy(m.y),m.w*c.sc,3);
    for(const pk of pickups){
      if(pk.tmr>0||!onScreen(pk.x,pk.y,20)) continue;
      if(pk.t==="health" && fxImg.health){ ctx.drawImage(fxImg.health, wx(pk.x)-10, wy(pk.y)-10, 20,20); }
      else { ctx.fillStyle=pk.t==="sniper"?"#e8e8e8":pk.t==="smg"?"#4db7ff":"#ffb020"; ctx.beginPath(); ctx.arc(wx(pk.x),wy(pk.y),7,0,Math.PI*2); ctx.fill(); }
    }
    for(const q of particles){
      if(!onScreen(q.x,q.y,16)) continue;
      if(q.c==="flame" && fxImg.flame){ const a=q.life/14; ctx.globalAlpha=a; ctx.drawImage(fxImg.flame, wx(q.x)-10*a, wy(q.y), 20*a, 34*a); ctx.globalAlpha=1; }
      else { ctx.fillStyle=q.c||"#ffb020"; ctx.fillRect(wx(q.x),wy(q.y),3,3); }
    }
    for(const b of bullets){
      if(!onScreen(b.x,b.y,16)) continue;
      if(fxImg.bullet){
        ctx.save(); ctx.translate(wx(b.x),wy(b.y)); ctx.rotate(b.a||0);
        const bw=b.sniper?28:18, bh=b.sniper?10:7;
        ctx.drawImage(fxImg.bullet, -bw/2, -bh/2, bw, bh);
        ctx.restore();
      } else { ctx.fillStyle=b.sniper?"#fff":"#ffd27a"; ctx.fillRect(wx(b.x),wy(b.y),b.sniper?7:4,2); }
    }
    for(const f of flashes){
      if(!fxImg.muzzle) continue;
      const a=f.life/f.max; ctx.save(); ctx.translate(wx(f.x),wy(f.y)); ctx.rotate(f.a||0); ctx.globalAlpha=a;
      ctx.drawImage(fxImg.muzzle, 0, -16*a, 48*a, 32*a); ctx.globalAlpha=1; ctx.restore();
    }
    ctx.fillStyle="#9c6"; for(const n of nades){ if(!onScreen(n.x,n.y,10)) continue; ctx.beginPath(); ctx.arc(wx(n.x),wy(n.y),5,0,Math.PI*2); ctx.fill(); }
    for(const p of players) if(p.alive) drawSoldier(p);
    const me=players.find(p=>p.id===youId)||players[0]; if(me) drawHud(me);
  }
  function serialize(){ return {startAt,players,bullets,nades,pickups,flashes,winner,mode,mapId}; }
  function applySnap(s){ startAt=s.startAt; players=s.players; bullets=s.bullets; nades=s.nades; pickups=s.pickups; flashes=s.flashes||[]; winner=s.winner; if(s.mapId) useMap(s.mapId); players.forEach((p,i)=>{ if(p.skinI==null) p.skinI=i%SKINS.length; p.skin=SKINS[p.skinI]; }); if(s.mode==="end"&&mode!=="end"){ mode="end"; document.getElementById("endTitle").textContent=(winner&&winner.name)+" wins"; end.classList.remove("hidden"); } }
  function loop(){ requestAnimationFrame(loop); const me=players.find(p=>p.id===youId); if(mode==="play"){ if(me&&me.kind==="human") readHuman(me,1); if(localTwo){ const p2=players.find(p=>p.id==="p2"); if(p2) readHuman(p2,2); } const host=!net||net.role==="host"; if(host){ stepWorld(); if(net&&net.conns){ const snap=serialize(); net.conns.forEach(c=>{ try{c.send({t:"snap",snap});}catch(e){} }); } } else if(net&&me){ try{ net.hostConn.send({t:"in",id:youId,input:me.input}); }catch(e){} } draw(); } }
  function roomCode(){ const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<5;i++) s+=a[(Math.random()*a.length)|0]; return s; }
  function hostOnline(){ if(typeof Peer==="undefined"){ alert("PeerJS failed"); return; } const code=roomCode(), name=(nameInput.value||"HOST").toUpperCase(); const peer=new Peer("skirmish-"+code); net={role:"host",code,peer,conns:[]}; youId="p1"; localTwo=false; peer.on("open",()=>resetWorld([makePlayer("p1",name,0,"human",selectedGun)])); peer.on("connection",conn=>{ net.conns.push(conn); conn.on("data",msg=>{ if(msg.t==="hello"&&players.length<6) players.push(makePlayer(msg.id,msg.name,players.length,"human",msg.gun||"pistol")); if(msg.t==="in"){ const p=players.find(x=>x.id===msg.id); if(p) p.input=msg.input; } }); }); }
  function joinOnline(){ if(typeof Peer==="undefined") return; const code=(roomInput.value||"").toUpperCase().replace(/[^A-Z0-9]/g,""); if(code.length<4) return; const name=(nameInput.value||"GUEST").toUpperCase(), my=uid(); const peer=new Peer(); net={role:"client",code,peer,hostConn:null}; youId=my; localTwo=false; peer.on("open",()=>{ const conn=peer.connect("skirmish-"+code); net.hostConn=conn; conn.on("open",()=>{ conn.send({t:"hello",id:my,name,gun:selectedGun}); menu.classList.add("hidden"); mode="play"; goFs(); }); conn.on("data",msg=>{ if(msg.t==="snap") applySnap(msg.snap); }); }); }
  function bindStick(el, side){ const set=(ev)=>{ const t=ev.touches?ev.touches[0]:ev; const r=el.getBoundingClientRect(); const dx=(t.clientX-(r.left+r.width/2))/(r.width/2); const dy=(t.clientY-(r.top+r.height/2))/(r.height/2); sticks[side].dx=clamp(dx,-1,1); sticks[side].dy=clamp(dy,-1,1); sticks[side].on=1; el.querySelector("i").style.transform=`translate(${sticks[side].dx*28}px,${sticks[side].dy*28}px)`; }; const up=()=>{ sticks[side].dx=sticks[side].dy=sticks[side].on=0; el.querySelector("i").style.transform=""; }; el.addEventListener("touchstart",e=>{e.preventDefault();set(e);},{passive:false}); el.addEventListener("touchmove",e=>{e.preventDefault();set(e);},{passive:false}); el.addEventListener("touchend",up); }
  bindStick(document.getElementById("stickL"),"l"); bindStick(document.getElementById("stickR"),"r");
  document.querySelectorAll(".mid button").forEach(b=>{ const act=b.dataset.act; b.addEventListener("touchstart",e=>{ e.preventDefault(); const me=players.find(p=>p.id===youId); if(!me) return; if(act==="jump") me.input.jet=1; if(act==="nade") me.input.nade=1; if(act==="swap") me.input.swap=1; },{passive:false}); b.addEventListener("touchend",()=>{ const me=players.find(p=>p.id===youId); if(!me) return; if(act==="jump") me.input.jet=0; if(act==="nade") me.input.nade=0; }); });
  window.addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true; }); window.addEventListener("keyup",e=>{ keys[e.key.toLowerCase()]=false; });
  function goFs(){ const el=document.documentElement; const req=el.requestFullscreen||el.webkitRequestFullscreen; if(req) req.call(el).catch(()=>{}); if(screen.orientation&&screen.orientation.lock) screen.orientation.lock("landscape").catch(()=>{}); }
  document.getElementById("btnFs").onclick=goFs; document.getElementById("btnSolo").onclick=startSolo; document.getElementById("btnLocal").onclick=startLocal; document.getElementById("btnHost").onclick=hostOnline; document.getElementById("btnJoin").onclick=joinOnline;
  document.getElementById("btnAgain").onclick=()=>{ mode="menu"; end.classList.add("hidden"); menu.classList.remove("hidden"); if(net&&net.peer) try{net.peer.destroy();}catch(e){} net=null; };
  requestAnimationFrame(loop);
})();
