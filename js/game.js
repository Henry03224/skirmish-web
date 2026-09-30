(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const menu = document.getElementById("menu");
  const end = document.getElementById("end");
  const nameInput = document.getElementById("nameInput");
  const roomInput = document.getElementById("roomInput");
  const WW = 1920, WH = 1080;
  let VW = 1280, VH = 720;
  const GRAV = 0.18, JET = 0.28, MOVE = 0.18, FRIC = 0.90, MAX_VX = 2.6, MAX_VY = 3.4;
  const MATCH_MS = 300000;
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
  const fxSrc = { muzzle:"assets/muzzle.svg", bullet:"assets/bullet.svg", flame:"assets/flame.svg", health:"assets/health.svg", gun:"assets/gun.svg", boot:"assets/boot.svg" };
  const fxImg = {};
  Object.keys(fxSrc).forEach(k=>{ const im=new Image(); im.onload=()=>{ fxImg[k]=im; }; im.src=fxSrc[k]; });
  const spriteImgs = SKINS.map(()=>null);
  SKINS.forEach((sk,i)=>{ const im=new Image(); im.onload=()=>{ spriteImgs[i]=im; }; im.src=sk.img; });
  const MAPS = window.MAP_PACK || {};
  let WALLS = (MAPS.canyon&&MAPS.canyon.walls) || [];
  const bgImgs = {};
  function loadBgs(){
    const src = window.MAP_IMAGES || {};
    Object.keys(MAPS).forEach(k=>{ const im=new Image(); im.onload=()=>{ bgImgs[k]=im; }; if(src[k]) im.src=src[k]; });
  }
  loadBgs();
  let selectedMap="canyon", selectedGun="pistol";
  let MAP = (MAPS.canyon&&MAPS.canyon.plats)||[], SPAWNS = (MAPS.canyon&&MAPS.canyon.spawns)||[], mapId="canyon";
  document.querySelectorAll("#mapPick .mapcard").forEach(b=>{ b.onclick=()=>{ document.querySelectorAll("#mapPick .mapcard").forEach(x=>x.classList.remove("on")); b.classList.add("on"); selectedMap=b.dataset.map; if(window.SFX) SFX.ui(); }; });
  document.querySelectorAll("#gunPick .mapcard").forEach(b=>{ b.onclick=()=>{ document.querySelectorAll("#gunPick .mapcard").forEach(x=>x.classList.remove("on")); b.classList.add("on"); selectedGun=b.dataset.gun; if(window.SFX) SFX.ui(); }; });
  const keys = {}; const sticks = { l:{dx:0,dy:0,on:0}, r:{dx:0,dy:0,on:0} };
  const mouse = {sx:0,sy:0,on:0};
  let mode="menu", localTwo=false, net=null, youId="p1", lobbyRoster=[];
  let players=[], bullets=[], nades=[], pickups=[], particles=[], flashes=[];
  let startAt=0, winner=null, tick=0, camPos={x:960,y:540}, camCache={sc:1,ox:0,oy:0};
  function uid(){ return Math.random().toString(36).slice(2,8); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
  function spawnPoint(){ return SPAWNS[(Math.random()*SPAWNS.length)|0]; }
  function fit(){ const dpr=Math.min(2,window.devicePixelRatio||1); const w=window.innerWidth,h=window.innerHeight; canvas.style.width=w+"px"; canvas.style.height=h+"px"; canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); VW=w; VH=h; }
  window.addEventListener("resize", fit); window.addEventListener("orientationchange", ()=>setTimeout(fit,200)); fit();
  function followTarget(){ return players.find(p=>p.id===youId) || players.find(p=>p.kind==="human") || {x:WW/2,y:WH/2,weapon:"pistol"}; }
  function updateCam(){
    const me=followTarget();
    const zoomed = me.weapon==="sniper" ? 620 : 500;
    const viewW=zoomed, viewH=zoomed*0.58;
    const sc=Math.max(VW/viewW, VH/viewH);
    const visW=VW/sc, visH=VH/sc;
    const aim=me.aim||0;
    const look=Math.sin(aim)*visH*0.30;
    const tx=clamp(me.x, visW/2, Math.max(visW/2, WW-visW/2));
    const ty=clamp(me.y+look, visH/2, Math.max(visH/2, WH-visH/2));
    camPos.x += (tx-camPos.x)*0.14;
    camPos.y += (ty-camPos.y)*0.07;
    camCache={sc, ox:VW/2-camPos.x*sc, oy:VH/2-camPos.y*sc};
  }
  function cam(){ return camCache; }
  function wx(x){ const c=camCache; return c.ox+x*c.sc; }
  function wy(y){ const c=camCache; return c.oy+y*c.sc; }
  function onScreen(x,y,pad){ pad=pad||80; const sx=wx(x),sy=wy(y); return sx>-pad&&sy>-pad&&sx<VW+pad&&sy<VH+pad; }
  function useMap(id){ mapCache=null; mapCacheId="";  mapId=MAPS[id]?id:"canyon"; MAP=MAPS[mapId].plats||[]; SPAWNS=MAPS[mapId].spawns||[]; WALLS=MAPS[mapId].walls||MAP; }
  function hearDist(x,y){ const lis=players.find(o=>o.id===youId); return lis?Math.hypot(x-lis.x,y-lis.y):0; }
  function gunLen(p){ return p.weapon==="sniper"?38:p.weapon==="shot"?32:p.weapon==="smg"?28:26; }
  function muzzleOf(p){
    const a=p.aim||0;
    const len=8+gunLen(p);
    return { x:p.x+Math.cos(a)*len, y:p.y-3+Math.sin(a)*len, a };
  }
  function makePlayer(id,name,si,kind,gun){
    const s=spawnPoint(); const wpn=gun||selectedGun||"pistol";
    return { id,name,kind,skin:SKINS[si%SKINS.length],skinI:si%SKINS.length, x:s.x,y:s.y,vx:0,vy:0,dir:1,aim:0,walk:0,bob:0,grounded:false, hp:100,maxHp:100,jet:100,weapon:wpn,ammo:9999,nades:2, kills:0,deaths:0,alive:true,respawn:0,fireCd:0,nadeCd:0, input:{l:0,r:0,u:0,d:0,jet:0,fire:0,nade:0,swap:0} };
  }
  function resetWorld(list){
    useMap(selectedMap); players=list; bullets=[]; nades=[]; particles=[]; flashes=[];
    const mid=SPAWNS[2]||{x:960,y:500};
    pickups=[{x:mid.x,y:mid.y-20,t:"sniper",tmr:0},{x:(SPAWNS[0]||mid).x,y:(SPAWNS[0]||mid).y-20,t:"smg",tmr:0},{x:(SPAWNS[1]||mid).x,y:(SPAWNS[1]||mid).y-20,t:"shot",tmr:0},{x:960,y:1000,t:"health",tmr:0}];
    startAt=performance.now(); winner=null; mode="play"; menu.classList.add("hidden"); end.classList.add("hidden"); goFs();
    if(window.SFX){ SFX.boot(); SFX.start(); }
  }
  function startSolo(){ const name=(nameInput.value||"PLAYER").toUpperCase(); const list=[makePlayer("p1",name,0,"human",selectedGun)]; const bots=["smg","shot","sniper","pistol"]; for(let i=0;i<4;i++) list.push(makePlayer("bot"+i,"BOT "+(i+1),i+1,"bot",bots[i])); youId="p1"; localTwo=false; net=null; resetWorld(list); }
  function startLocal(){ resetWorld([makePlayer("p1",(nameInput.value||"P1").toUpperCase(),0,"human",selectedGun), makePlayer("p2","P2",1,"human","smg"), makePlayer("bot0","BOT 1",2,"bot","sniper"), makePlayer("bot1","BOT 2",3,"bot","shot")]); youId="p1"; localTwo=true; net=null; }
  function inWall(x,y,pad){
    pad = pad==null ? 2 : pad;
    for(const w of WALLS){
      if(x>=w.x-pad && x<=w.x+w.w+pad && y>=w.y-pad && y<=w.y+w.h+pad) return true;
    }
    return false;
  }
  function segHitsWall(x0,y0,x1,y1){
    const n=Math.max(6, Math.ceil(Math.hypot(x1-x0,y1-y0)/2.5));
    for(let i=1;i<=n;i++){
      const t=i/n;
      if(inWall(x0+(x1-x0)*t, y0+(y1-y0)*t, 1)) return true;
    }
    return false;
  }
  function bulletHitsPlayer(px,py,x0,y0,x1,y1){
    const r=24;
    if(Math.hypot(px-x1,py-y1)<r) return true;
    const vx=x1-x0, vy=y1-y0, l2=vx*vx+vy*vy;
    if(l2<0.01) return Math.hypot(px-x0,py-y0)<r;
    let t=((px-x0)*vx+(py-y0)*vy)/l2;
    t=Math.max(0,Math.min(1,t));
    return Math.hypot(px-(x0+vx*t), py-(y0+vy*t))<r;
  }
  function platHit(p){
    let grounded=false;
    for(const w of WALLS){
      const left=p.x-10, right=p.x+10, top=p.y-16, bot=p.y+18;
      if(right<=w.x || left>=w.x+w.w || bot<=w.y || top>=w.y+w.h) continue;
      const ox=Math.min(right,w.x+w.w)-Math.max(left,w.x);
      const oy=Math.min(bot,w.y+w.h)-Math.max(top,w.y);
      if(ox<oy){
        if(p.x<w.x+w.w*0.5) p.x=w.x-10; else p.x=w.x+w.w+10;
        p.vx=0;
      } else {
        if(p.vy>=0 && (p.y+18-w.y)<22){ p.y=w.y-18; p.vy=0; grounded=true; }
        else { p.y=w.y+w.h+16; if(p.vy<0) p.vy=0; }
      }
    }
    return grounded;
  }
  function screenToWorld(sx,sy){ const c=cam(); return {x:(sx-c.ox)/c.sc, y:(sy-c.oy)/c.sc}; }
  function readHuman(p, slot){ const i=p.input; if(slot===1){ if(localTwo){ i.l=keys.a?1:0; i.r=keys.d?1:0; i.jet=keys[" "]?1:0; i.fire=keys.j?1:0; i.nade=keys.k?1:0; i.swap=keys.q?1:0; } else { i.l=keys.a||keys.arrowleft||sticks.l.dx<-0.25?1:0; i.r=keys.d||keys.arrowright||sticks.l.dx>0.25?1:0; i.jet=keys[" "]||keys.shift||sticks.l.dy<-0.55?1:0; i.fire=keys.j||keys.z||keys.enter||(sticks.r.on && Math.hypot(sticks.r.dx,sticks.r.dy)>0.34)?1:0; i.nade=keys.k||keys.x?1:0; i.swap=keys.q||keys.e?1:0; if(sticks.r.on && Math.hypot(sticks.r.dx,sticks.r.dy)>0.28){ const tgt=Math.atan2(sticks.r.dy,sticks.r.dx); let d=tgt-(p.aim||0); while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2; p.aim=(p.aim||0)+d*0.16; } else if(mouse.on){ const w=screenToWorld(mouse.sx,mouse.sy); p.aim=Math.atan2(w.y-(p.y-3),w.x-p.x); } } p.dir = Math.cos(p.aim||0)>=0?1:-1; } else { i.l=keys.arrowleft?1:0; i.r=keys.arrowright?1:0; i.jet=keys.shift?1:0; i.fire=keys["/"]?1:0; i.nade=keys["."]?1:0; i.swap=keys[","]?1:0; } }
  function botThink(p){ const foes=players.filter(o=>o.alive&&o.id!==p.id); if(!foes.length) return; foes.sort((a,b)=>dist(a,p)-dist(b,p)); const t=foes[0], d=dist(t,p); const range=p.weapon==="sniper"?700:p.weapon==="shot"?220:420; p.input.l=t.x<p.x-24?1:0; p.input.r=t.x>p.x+24?1:0; p.input.jet=t.y<p.y-40||p.y>980?1:0; p.input.fire=d<range&&Math.random()<(p.weapon==="sniper"?0.07:0.16)?1:0; p.dir=t.x>=p.x?1:-1; p.aim=Math.atan2(t.y-(p.y-3),t.x-p.x); }
  function fire(p){
    const g=GUN[p.weapon]||GUN.pistol; if(p.fireCd>0) return;
    p.fireCd=g.cd; if(window.SFX && onScreen(p.x,p.y,12)) SFX.shoot(p.weapon, hearDist(p.x,p.y));
    const muz=muzzleOf(p); const base=muz.a;
    let mx=muz.x, my=muz.y;
    if(inWall(mx,my,0) || segHitsWall(p.x, p.y-3, mx, my)){
      mx=p.x+Math.cos(base)*10;
      my=p.y-3+Math.sin(base)*10;
    }
    flashes.push({x:mx,y:my,a:base,life:8,max:8});
    let close=false;
    for(const o of players){
      if(!o.alive||o.id===p.id) continue;
      if(bulletHitsPlayer(o.x,o.y,p.x,p.y-3,mx,my) || Math.hypot(o.x-p.x,o.y-p.y)<28){
        hurt(o,g.dmg,p.id); close=true;
      }
    }
    if(close) return;
    for(let i=0;i<g.n;i++){
      const a=base+(Math.random()-0.5)*g.spread;
      bullets.push({x:mx,y:my,vx:Math.cos(a)*g.spd,vy:Math.sin(a)*g.spd,a,owner:p.id,dmg:g.dmg,life:p.weapon==="sniper"?78:56,sniper:p.weapon==="sniper"});
    }
  }
  function throwNade(p){ if(p.nadeCd>0||p.nades<=0) return; p.nades--; p.nadeCd=56; const a=p.aim||(p.dir>0?-0.4:Math.PI+0.4); nades.push({x:p.x,y:p.y,vx:Math.cos(a)*5.5,vy:Math.sin(a)*5.5-2.2,owner:p.id,fuse:78}); }
  function explode(x,y,owner,r,dmg){ if(window.SFX && onScreen(x,y,12)) SFX.boom(hearDist(x,y)); for(let i=0;i<16;i++) particles.push({x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,life:18,c:"#ffb020"}); for(const p of players){ if(!p.alive) continue; const d=Math.hypot(p.x-x,p.y-y); if(d<r) hurt(p,dmg*(1-d/r),owner); } }
  function hurt(p,dmg,owner){ p.hp-=dmg; if(window.SFX && onScreen(p.x,p.y,12)) SFX.hit(hearDist(p.x,p.y)); if(p.hp<=0){ p.hp=0; p.alive=false; p.deaths++; p.respawn=90; const k=players.find(o=>o.id===owner); if(k&&k.id!==p.id) k.kills++; if(window.SFX && onScreen(p.x,p.y,12)) SFX.die(); } }
  function cycleGun(p){ const i=GUNS.indexOf(p.weapon); p.weapon=GUNS[(i+1)%GUNS.length]; p.ammo=9999; }
  function stepPlayer(p){
    if(!p.alive){ p.respawn--; if(p.respawn<=0){ const s=spawnPoint(); Object.assign(p,{x:s.x,y:s.y,vx:0,vy:0,hp:p.maxHp||100,jet:100,ammo:9999,nades:2,alive:true}); } return; }
    const moving = p.input.l||p.input.r;
    const flying=p.input.jet&&p.jet>0;
    const steer=flying?MOVE*1.08:MOVE;
    if(p.input.l){ p.vx-=steer; }
    if(p.input.r){ p.vx+=steer; }
    p.vx=clamp(p.vx*(flying?0.91:FRIC),-MAX_VX,MAX_VX);
    if(flying){
      p.vy-=JET;
      if(p.vy>1.6) p.vy*=0.88;
      p.jet-=0.14;
      if(tick%3===0 && particles.length<36) particles.push({x:p.x+(Math.random()-0.5)*8,y:p.y+22,vx:(Math.random()-0.5)*0.6,vy:1.6+Math.random(),life:10,c:"flame"});
      if(window.SFX && p.id===youId) SFX.jet();
    } else p.jet=Math.min(100,p.jet+0.32);
    p.vy=clamp(p.vy+GRAV,-MAX_VY,MAX_VY); p.x+=p.vx; p.y+=p.vy; p.x=clamp(p.x,16,WW-16);
    if(p.y>WH+40){ p.hp=0; hurt(p,999,p.id); }
    p.grounded=platHit(p);
    if(p.grounded && moving) p.walk+=0.28; else if(!p.grounded) p.walk+=0.08; else p.walk*=0.82;
    p.bob = Math.sin(p.walk)*2.4;
    if(p.fireCd>0) p.fireCd--; if(p.nadeCd>0) p.nadeCd--;
    if(p.input.fire) fire(p); if(p.input.nade) throwNade(p);
    if(p.input.swap){ cycleGun(p); p.input.swap=0; }
    if(p.kind==="human") p.dir = Math.cos(p.aim||0)>=0?1:-1;
    for(const pk of pickups){ if(pk.tmr>0){ pk.tmr--; continue; } if(Math.hypot(pk.x-p.x,pk.y-p.y)<30){ if(pk.t==="health") p.hp=Math.min(p.maxHp||100,p.hp+45); if(GUN[pk.t]){ p.weapon=pk.t; p.ammo=9999; } pk.tmr=380; if(window.SFX) SFX.pickup(); } }
  }
  function stepWorld(){
    const now=performance.now();
    for(const p of players){ if(p.id!==youId && p.kind==="human" && p.inAt && now-p.inAt>220){ if(p.input){ p.input.jet=0; p.input.fire=0; } } }

    tick++;
    const left=MATCH_MS-(performance.now()-startAt);
    if(left<=0&&!winner){ winner=[...players].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths)[0]; mode="end"; document.getElementById("endTitle").textContent=winner.name+" wins"; document.getElementById("endBody").textContent=players.map(p=>p.name+" "+p.kills+"K/"+p.deaths+"D").join(" · "); end.classList.remove("hidden"); if(window.SFX) SFX.win(); return; }
    for(const p of players){ if(p.kind==="bot") botThink(p); stepPlayer(p); }
    for(const b of bullets){
      const ox=b.x, oy=b.y;
      b.x+=b.vx; b.y+=b.vy; b.life--;
      if(segHitsWall(ox,oy,b.x,b.y) || inWall(b.x,b.y,1)){ b.life=0; continue; }
      for(const p of players){
        if(!p.alive||p.id===b.owner) continue;
        if(bulletHitsPlayer(p.x,p.y,ox,oy,b.x,b.y)){ hurt(p,b.dmg,b.owner); b.life=0; break; }
      }
    }
    bullets=bullets.filter(b=>b.life>0);
    for(const n of nades){ n.vy+=0.18; n.x+=n.vx; n.y+=n.vy; if(inWall(n.x,n.y)){ n.vx*=-0.3; n.vy=0; n.y-=2; } n.fuse--; if(n.fuse<=0) explode(n.x,n.y,n.owner,100,55); }
    nades=nades.filter(n=>n.fuse>0);
    for(const q of particles){ q.x+=q.vx; q.y+=q.vy; q.life--; } particles=particles.filter(q=>q.life>0);
    for(const f of flashes) f.life--; flashes=flashes.filter(f=>f.life>0);
  }
  function drawSoldier(p){
    if(!onScreen(p.x,p.y,90)) return;
    const x=wx(p.x), y=wy(p.y+(p.bob||0)), s=cam().sc*0.82; const im=spriteImgs[p.skinI]; const w=40*s,h=36*s;
    const lean = clamp((p.vx||0)*0.08,-0.18,0.18);
    const swing=Math.sin(p.walk||0)*0.7;
    ctx.save(); ctx.translate(x,y); ctx.rotate(lean);
    if(p.input&&p.input.jet&&p.jet>0 && fxImg.flame){
      const pulse=0.85+Math.sin(tick*0.4)*0.18;
      ctx.drawImage(fxImg.flame, -10*s*pulse, 5*s, 20*s*pulse, 32*s*pulse);
    }
    for(const side of [-1,1]){
      ctx.save(); ctx.translate(side*3.5*s, 6*s); ctx.rotate(side*swing);
      if(fxImg.boot) ctx.drawImage(fxImg.boot, -4*s, 0, 8*s, 13*s);
      else { ctx.fillStyle="#1a1510"; ctx.fillRect(-3*s,0,5*s,12*s); }
      ctx.restore();
    }
    if((p.dir||1)<0) ctx.scale(-1,1);
    if(im) ctx.drawImage(im,-w*0.42,-h*0.72,w,h);
    else { ctx.fillStyle=p.skin.outfit; ctx.fillRect(-5*s,-3*s,10*s,12*s); }
    ctx.restore();
    const aim=p.aim||0;
    const gw = gunLen(p)*s;
    ctx.save(); ctx.translate(x, y-3*s); ctx.rotate(aim);
    if(fxImg.gun) ctx.drawImage(fxImg.gun, 6*s, -4*s, gw, 8*s);
    else { ctx.fillStyle="#1a1a1a"; ctx.fillRect(6*s,-2*s,gw,4*s); }
    ctx.fillStyle="#2a2a2a"; ctx.fillRect(4*s,-3*s,5*s,6*s);
    ctx.restore();
    if(p.id===youId){
      const muz=muzzleOf(p);
      const reach=p.weapon==="sniper"?520:280;
      ctx.save();
      ctx.strokeStyle="rgba(255,80,80,0.55)";
      ctx.lineWidth=Math.max(1,1.2*s);
      ctx.setLineDash([6,5]);
      ctx.beginPath();
      ctx.moveTo(wx(muz.x), wy(muz.y));
      ctx.lineTo(wx(muz.x+Math.cos(aim)*reach), wy(muz.y+Math.sin(aim)*reach));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle="#ff4d4d";
      ctx.beginPath(); ctx.arc(wx(muz.x), wy(muz.y), Math.max(2,2.2*s), 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    const barW=28;
    ctx.fillStyle="#0009"; ctx.fillRect(x-barW/2,y-28*s,barW,4);
    ctx.fillStyle=p.hp>40?"#3dff8a":"#ff4d4d"; ctx.fillRect(x-barW/2,y-28*s,barW*(p.hp/(p.maxHp||100)),4);
    ctx.fillStyle="#fff"; ctx.font=Math.max(9,8*s)+"px sans-serif"; ctx.textAlign="center";
    ctx.fillText(p.name,x,y-32*s);
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
    ctx.fillText(me.weapon.toUpperCase()+"  UNLIM   JET "+jet, 16, 78);
    const left=Math.max(0,MATCH_MS-(performance.now()-startAt));
    const mm=(left/60000)|0, ss=((left/1000)|0)%60;
    const clock=mm+":"+(ss<10?"0":"")+ss;
    ctx.font="bold 22px sans-serif";
    ctx.textAlign="right"; ctx.fillStyle="#ffe14a";
    ctx.fillText(clock, VW-12, 26);
    ctx.font="bold 13px sans-serif"; ctx.fillStyle="#fff";
    ctx.fillText("KILLS "+(me.kills|0), VW-12, 46);
    if(net){
      ctx.font="11px sans-serif";
      ctx.fillText((net.code||"PUB")+"  "+players.filter(p=>p.kind==="human").length+"P", VW-12, 64);
      ctx.fillStyle = pingMs<80?"#3dff8a": pingMs<160?"#ffe14a":"#ff4d4d";
      ctx.fillText(pingMs?("PING "+pingMs+" ms"):"PING --", VW-12, 80);
    }
  }

  function drawEnemyArrows(me){
    for(const p of players){
      if(!p.alive||p.id===me.id) continue;
      const sx=wx(p.x), sy=wy(p.y);
      if(sx>28&&sx<VW-28&&sy>28&&sy<VH-28) continue;
      const ang=Math.atan2(sy-VH/2,sx-VW/2);
      const pad=26;
      const dx=Math.cos(ang), dy=Math.sin(ang);
      let t=1e9;
      if(dx>0.001) t=Math.min(t,(VW-pad-VW/2)/dx);
      if(dx<-0.001) t=Math.min(t,(pad-VW/2)/dx);
      if(dy>0.001) t=Math.min(t,(VH-pad-VH/2)/dy);
      if(dy<-0.001) t=Math.min(t,(pad-VH/2)/dy);
      const ax=VW/2+dx*t, ay=VH/2+dy*t;
      ctx.save();
      ctx.translate(ax,ay); ctx.rotate(ang);
      ctx.fillStyle=p.skinI===0?"#3dff8a":"#ff4d4d";
      ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-8,-8); ctx.lineTo(-8,8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function ensureMapCache(){
    if(mapCache && mapCacheId===mapId) return mapCache;
    const cv=document.createElement("canvas");
    cv.width=WW; cv.height=WH;
    const x=cv.getContext("2d");
    if(bgImgs[mapId]) x.drawImage(bgImgs[mapId],0,0,WW,WH);
    else { x.fillStyle="#111"; x.fillRect(0,0,WW,WH); }
    mapCache=cv; mapCacheId=mapId;
    return cv;
  }
  function draw(){
    updateCam();
    ctx.clearRect(0,0,VW,VH); ctx.fillStyle="#050608"; ctx.fillRect(0,0,VW,VH); const c=cam();
    const mc=ensureMapCache();
    const sx=clamp(-c.ox/c.sc,0,WW), sy=clamp(-c.oy/c.sc,0,WH);
    const sw=Math.min(VW/c.sc,WW-sx), sh=Math.min(VH/c.sc,WH-sy);
    ctx.drawImage(mc, sx,sy,sw,sh, c.ox+sx*c.sc, c.oy+sy*c.sc, sw*c.sc, sh*c.sc);
    for(const p of players) if(p.alive) drawSoldier(p);
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
    const me=players.find(p=>p.id===youId)||players[0]; if(me){ drawEnemyArrows(me); drawHud(me); }
  }
  function slimP(p){
    return {id:p.id,name:p.name,kind:p.kind,skinI:p.skinI,x:p.x,y:p.y,vx:p.vx,vy:p.vy,dir:p.dir,aim:p.aim,walk:p.walk,hp:p.hp,maxHp:p.maxHp,jet:p.jet,weapon:p.weapon,ammo:p.ammo,nades:p.nades,kills:p.kills,deaths:p.deaths,alive:p.alive,respawn:p.respawn,fireCd:p.fireCd,nadeCd:p.nadeCd,input:p.input,grounded:p.grounded};
  }
  function serialize(){ return {elapsed:performance.now()-startAt,players:players.map(slimP),bullets,nades,pickups,flashes,winner,mode,mapId}; }
  function applySnap(s){
    const keep=players.find(p=>p.id===youId);
    const saved=keep?{x:keep.x,y:keep.y,vx:keep.vx,vy:keep.vy,input:keep.input,aim:keep.aim,walk:keep.walk}:null;
    if(s.elapsed!=null) startAt=performance.now()-s.elapsed; else if(s.startAt) startAt=s.startAt; const incoming=s.players||[];
    const mineB=(bullets||[]).filter(b=>b.owner===youId);
    const otherB=(s.bullets||[]).filter(b=>b.owner!==youId);
    bullets=mineB.concat(otherB);
    nades=s.nades; pickups=s.pickups; flashes=s.flashes||[]; winner=s.winner;
    if(s.mapId) useMap(s.mapId);
    const byId={};
    incoming.forEach((np,i)=>{
      if(np.skinI==null) np.skinI=i%SKINS.length; np.skin=SKINS[np.skinI];
      if(!np.input) np.input={l:0,r:0,u:0,d:0,jet:0,fire:0,nade:0,swap:0};
      const sx=np.x, sy=np.y;
      np.tx=sx; np.ty=sy;
      const old=players.find(p=>p.id===np.id);
      if(old && np.id===youId){
        const err=Math.hypot(old.x-sx, old.y-sy);
        if(err>90){ np.x=sx; np.y=sy; np.vx=np.vx; }
        else { np.x=old.x; np.y=old.y; np.vx=old.vx; np.vy=old.vy; }
      }
      byId[np.id]=np;
    });
    if(saved && byId[youId]){
      const me=byId[youId];
      me.input=saved.input||me.input;
      if(saved.aim!=null) me.aim=saved.aim;
    }
    players=incoming;
    if(s.mode==="end"&&mode!=="end"){ mode="end"; document.getElementById("endTitle").textContent=(winner&&winner.name)+" wins"; end.classList.remove("hidden"); if(window.SFX) SFX.win(); }
  }
  let snapT=0, inT=0, pingMs=0, pingAt=0, mapCache=null, mapCacheId="";
  function loop(){
    requestAnimationFrame(loop);
    const me=players.find(p=>p.id===youId);
    if(mode==="play"){
      if(me){ if(!me.input) me.input={l:0,r:0,u:0,d:0,jet:0,fire:0,nade:0,swap:0}; readHuman(me,1); }
      if(localTwo){ const p2=players.find(p=>p.id==="p2"); if(p2) readHuman(p2,2); }
      const host=!net||net.role==="host";
      const now=performance.now();
      if(host){
        stepWorld();
        if(net&&net.conns&&net.conns.length && now-snapT>40){
          snapT=now; const snap=serialize();
          net.conns.forEach(c=>{ try{c.send({t:"snap",snap});}catch(e){} });
        }
      } else if(net&&net.hostConn&&me){
        stepPlayer(me);
        for(const p of players){
          if(p.id===youId||!p.alive) continue;
          p.x+=p.vx||0; p.y+=p.vy||0;
          if(p.tx!=null){ p.x+=(p.tx-p.x)*0.55; p.y+=(p.ty-p.y)*0.55; }
        }
        for(const b of bullets){ b.x+=b.vx; b.y+=b.vy; b.life--; }
        bullets=bullets.filter(b=>b.life>0);
        if(now-inT>16){ inT=now; try{ net.hostConn.send({t:"in",id:youId,input:me.input,aim:me.aim}); }catch(e){} }
        if(now-pingAt>1000){ pingAt=now; try{ net.hostConn.send({t:"ping",t0:now}); }catch(e){} }
      }
      if(net&&net.role==="host"&&net.conns&&net.conns.length&&now-pingAt>1000){
        pingAt=now; sendAll({t:"ping",t0:now});
      }
      draw();
    }
  }
  function roomCode(){ const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<5;i++) s+=a[(Math.random()*a.length)|0]; return s; }

  const lostEl=document.getElementById("lost");
  function connectionLost(){
    if(mode!=="play") return;
    mode="menu";
    if(lostEl) lostEl.classList.remove("hidden");
    if(menu) menu.classList.add("hidden");
    if(lobbyEl) lobbyEl.classList.add("hidden");
    if(end) end.classList.add("hidden");
    try{ if(net&&net.peer) net.peer.destroy(); }catch(e){}
    net=null; lobbyRoster=[]; counting=false;
  }
  function bindLostWatch(conn){
    if(!conn) return;
    conn.on("close",()=>connectionLost());
    conn.on("disconnected",()=>connectionLost());
    conn.on("error",()=>connectionLost());
  }
  const lobbyEl=document.getElementById("lobby");
  const lobbyCodeEl=document.getElementById("lobbyCode");
  const lobbyStatusEl=document.getElementById("lobbyStatus");
  const lobbyListEl=document.getElementById("lobbyList");
  const PEER_CFG={ config:{ iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}] } };
  const MAXP=5, ROOMS=6;
  function liveId(n){ return "swhenq"+n; }
  function renderLobby(){
    if(!lobbyListEl) return;
    const skins=["assets/soldier_green.svg","assets/soldier_blue.svg","assets/soldier_pink.svg","assets/soldier_gold.svg","assets/soldier_red.svg","assets/soldier_lime.svg"];
    lobbyListEl.innerHTML=lobbyRoster.map((p,i)=>{
      const me=p.id===youId?" me":"";
      const dot=p.ready?"on":(p.id===youId?"wait":"");
      const rank=(p.name||"P").length*3%80;
      const av=skins[i%skins.length];
      return "<li class=\""+me+"\"><span class=\"rank\">"+rank+"</span><i class=\"dot "+dot+"\"></i><img class=\"av\" src=\""+av+"\" alt=\"\"><span>"+p.name+"</span></li>";
    }).join("")||"<li>Finding soldiers...</li>";
    if(lobbyCodeEl) lobbyCodeEl.textContent="ROOM "+((net&&net.slot!=null)?(net.slot+1):"1")+"  "+lobbyRoster.length+"/"+MAXP;
    if(lobbyStatusEl) lobbyStatusEl.innerHTML=lobbyRoster.length<2?"SELECTING A SERVER<br>ACQUIRING A LOBBY":"LOBBY READY<br>TAP READY";
    const cd=document.getElementById("countDown");
    if(cd && !counting) cd.classList.add("hidden");
  }
  function showLobby(msg){
    menu.classList.add("hidden"); if(end) end.classList.add("hidden");
    lobbyEl.classList.remove("hidden");
    if(msg&&lobbyStatusEl) lobbyStatusEl.textContent=msg;
    renderLobby();
  }
  function hideLobby(){ if(lobbyEl) lobbyEl.classList.add("hidden"); }
  function sendAll(msg){ if(!net||!net.conns) return; net.conns.forEach(c=>{ try{c.send(msg);}catch(e){} }); }
  function dropPlayer(id){
    lobbyRoster=lobbyRoster.filter(p=>p.id!==id);
    players=players.filter(p=>p.id!==id);
    counting=false;
    renderLobby();
    if(net&&net.role==="host") sendAll({t:"lobby",roster:lobbyRoster,slot:net.slot});
  }
  function leaveLobby(){
    try{ if(net&&net.role==="client"&&net.hostConn) net.hostConn.send({t:"leave",id:youId}); }catch(e){}
    hideLobby(); menu.classList.remove("hidden"); mode="menu";
    if(net&&net.peer) try{net.peer.destroy();}catch(e){}
    net=null; lobbyRoster=[]; players=[]; counting=false;
    const cd=document.getElementById("countDown"); if(cd) cd.classList.add("hidden");
  }
  function beginMatch(){
    if(mode==="play") return;
    hideLobby();
    if(net&&net.role==="host"){
      resetWorld(lobbyRoster.map((r,i)=>makePlayer(r.id,r.name,i,"human",r.gun||"pistol")));
      sendAll({t:"start"}); sendAll({t:"snap",snap:serialize()});
    }
  }
  let counting=false;
  function allReady(){ return lobbyRoster.length>=2 && lobbyRoster.every(p=>p.ready); }
  function markReady(id){
    const p=lobbyRoster.find(x=>x.id===id); if(p) p.ready=true;
    renderLobby();
    if(net&&net.role==="host"){
      sendAll({t:"lobby",roster:lobbyRoster,slot:net.slot});
      if(allReady()&&!counting) startCountdown();
    }
  }
  function startCountdown(){
    counting=true; let n=3;
    const tick=()=>{
      sendAll({t:"count",n});
      showCount(n);
      if(n<=0){ beginMatch(); counting=false; return; }
      n--; setTimeout(tick,1000);
    };
    tick();
  }
  function showCount(n){
    const el=document.getElementById("countDown");
    if(!el) return;
    if(!counting && !(net&&net.role!=="host")) { el.classList.add("hidden"); return; }
    if(!allReady() && net&&net.role==="host"){ el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    el.textContent=n<=0?"GAME STARTS IN: GO":"GAME STARTS IN: "+n;
  }
  function iAmReady(){
    if(net&&net.role==="host") markReady(youId);
    else if(net&&net.hostConn){ try{ net.hostConn.send({t:"ready",id:youId}); }catch(e){} markReady(youId); }
  }
  function attachHost(conn){
    if(!net.conns.includes(conn)) net.conns.push(conn);
    conn.on("close",()=>{ if(conn.pid) dropPlayer(conn.pid); net.conns=net.conns.filter(c=>c!==conn); if(mode==="play" && players.filter(p=>p.kind==="human"&&p.id!==youId).length===0) connectionLost(); });
    conn.on("data",msg=>{
      if(msg.t==="leave"){ dropPlayer(msg.id); return; }
      if(msg.t==="hello"){
        if(msg.probe){ try{ conn.send({t:"lobby",roster:lobbyRoster,slot:net.slot}); }catch(e){} return; }
        if(lobbyRoster.length>=MAXP){ try{ conn.send({t:"full"}); }catch(e){} return; }
        if(!lobbyRoster.find(p=>p.id===msg.id)){
          conn.pid=msg.id;
          lobbyRoster.push({id:msg.id,name:msg.name,gun:msg.gun||"pistol",ready:false});
          renderLobby();
          sendAll({t:"lobby",roster:lobbyRoster,slot:net.slot});
          if(mode==="play"&&!players.find(p=>p.id===msg.id))
            players.push(makePlayer(msg.id,msg.name,players.length,"human",msg.gun||"pistol"));
          try{ conn.send({t:"lobby",roster:lobbyRoster,slot:net.slot}); }catch(e){}
        }
      }
      if(msg.t==="ready") markReady(msg.id);
      if(msg.t==="ping"){ try{ conn.send({t:"pong",t0:msg.t0}); }catch(e){} }
      if(msg.t==="pong"&&msg.t0) pingMs=Math.max(1, Math.round(performance.now()-msg.t0));
      if(msg.t==="in"){ const p=players.find(x=>x.id===msg.id); if(p){ p.input=msg.input||p.input; if(msg.aim!=null) p.aim=msg.aim; p.inAt=performance.now(); } }
    });
  }
  function hostSlot(name, slot, gen){
    if(gen!=null && gen!==matchGen) return;
    const peer=new Peer(liveId(slot), PEER_CFG);
    let opened=false;
    net={role:"host",code:"R"+(slot+1),peer,conns:[],slot}; youId="p1"; localTwo=false;
    lobbyRoster=[{id:"p1",name,gun:selectedGun,ready:false}];
    showLobby("Opening room...");
    peer.on("open",()=>{ opened=true; showLobby("Waiting for players"); renderLobby(); });
    peer.on("connection",attachHost);
    peer.on("error",err=>{
      if(opened) return;
      try{ peer.destroy(); }catch(e){}
      joinSlot(name, 0, function(){ setTimeout(()=>{ if(gen===matchGen) hostSlot(name, 0, gen); }, 1200); }, gen);
    });
  }
  function joinSlot(name, slot, next, gen){
    if(gen!=null && gen!==matchGen) return;
    const my=uid();
    const peer=new Peer(PEER_CFG);
    net={role:"client",code:"R"+(slot+1),peer,hostConn:null,slot}; youId=my; localTwo=false;
    showLobby("Joining room...");
    let opened=false, tries=0;
    function connect(){
      if(gen!==matchGen) return;
      const conn=peer.connect(liveId(slot),{reliable:true});
      net.hostConn=conn;
      conn.on("open",()=>{
        opened=true;
        conn.send({t:"hello",id:my,name,gun:selectedGun});
        showLobby("In lobby");
      });
      conn.on("data",msg=>{
        if(msg.t==="full"){ try{peer.destroy();}catch(e){} if(gen===matchGen) hostSlot(name, 1, gen); return; }
        if(msg.t==="lobby"){ lobbyRoster=msg.roster||lobbyRoster; if(msg.slot!=null) net.slot=msg.slot; counting=false; renderLobby(); }
        if(msg.t==="count"){ counting=true; showCount(msg.n); }
        if(msg.t==="ping"){ try{ conn.send({t:"pong",t0:msg.t0}); }catch(e){} }
        if(msg.t==="pong"&&msg.t0) pingMs=Math.max(1, Math.round(performance.now()-msg.t0));
        if(msg.t==="start"||msg.t==="snap"){
          hideLobby();
          if(msg.snap) applySnap(msg.snap);
          mode="play"; menu.classList.add("hidden"); goFs();
          bindLostWatch(conn);
          if(window.SFX){ SFX.boot(); SFX.start(); }
        }
      });
      conn.on("error",()=>{
        if(opened) return;
        tries++;
        if(tries<5) setTimeout(connect, 700);
        else if(gen===matchGen) next();
      });
    }
    peer.on("open", connect);
    peer.on("error",()=>{ if(!opened && gen===matchGen) setTimeout(connect, 800); });
  }
  let matchGen=0;
  function playNow(){
    if(typeof Peer==="undefined"){ alert("Online failed"); return; }
    const name=(nameInput.value||"PLAYER").toUpperCase();
    matchGen++;
    showLobby("Finding the same room...");
    hostSlot(name, 0, matchGen);
  }
  function joinOnline(){ playNow(); }
  function lobbyRefresh(){
    if(mode==="play" || counting) return;
    if(!lobbyEl || lobbyEl.classList.contains("hidden")) return;
    if(lobbyRoster.length>=2) return;
    const name=(nameInput&&nameInput.value||"PLAYER").toUpperCase();
    if(lobbyStatusEl) lobbyStatusEl.innerHTML="AUTO RETRY<br>FINDING PLAYERS";
    matchGen++;
    try{ if(net&&net.peer) net.peer.destroy(); }catch(e){}
    net=null; lobbyRoster=[];
    setTimeout(()=>hostSlot(name, 0, matchGen), 400+Math.random()*900);
  }
  setInterval(lobbyRefresh, 5000);

  function bindStick(el, side){
    let pid=null;
    const set=(ev)=>{
      const r=el.getBoundingClientRect();
      const dx=(ev.clientX-(r.left+r.width/2))/(r.width/2);
      const dy=(ev.clientY-(r.top+r.height/2))/(r.height/2);
      const mag=Math.hypot(dx,dy);
      const dead=side==="r"?0.18:0.12;
      const nx=mag>dead?dx:0, ny=mag>dead?dy:0;
      sticks[side].dx=clamp(nx,-1,1);
      sticks[side].dy=clamp(ny,-1,1);
      sticks[side].on=1;
      const travel=el.offsetWidth*0.28;
      el.querySelector("i").style.transform=`translate(${sticks[side].dx*travel}px,${sticks[side].dy*travel}px)`;
    };
    const up=(ev)=>{
      if(ev && pid!=null && ev.pointerId!==pid) return;
      pid=null;
      sticks[side].dx=sticks[side].dy=sticks[side].on=0;
      el.querySelector("i").style.transform="";
    };
    el.addEventListener("pointerdown",e=>{ e.preventDefault(); e.stopPropagation(); pid=e.pointerId; try{el.setPointerCapture(e.pointerId);}catch(err){} set(e); });
    el.addEventListener("pointermove",e=>{ if(pid!==e.pointerId) return; e.preventDefault(); e.stopPropagation(); set(e); });
    el.addEventListener("pointerup",up);
    el.addEventListener("pointercancel",up);
  }
  bindStick(document.getElementById("stickL"),"l"); bindStick(document.getElementById("stickR"),"r");
  window.addEventListener("offline",()=>connectionLost());
  window.addEventListener("pointerup",()=>{ sticks.l.on=0; sticks.l.dx=0; sticks.l.dy=0; sticks.r.on=0; });
  window.addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true; }); window.addEventListener("keyup",e=>{ keys[e.key.toLowerCase()]=false; });
  canvas.addEventListener("mousemove",e=>{
    if(e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    const r=canvas.getBoundingClientRect(); mouse.sx=e.clientX-r.left; mouse.sy=e.clientY-r.top; mouse.on=1;
  });
  canvas.addEventListener("mouseleave",()=>{ mouse.on=0; });
  canvas.addEventListener("mousedown",e=>{
    if(e.button!==0) return;
    if(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    const me=players.find(p=>p.id===youId); if(me) me.input.fire=1;
  });
  canvas.addEventListener("mouseup",()=>{ const me=players.find(p=>p.id===youId); if(me) me.input.fire=0; });
  function goFs(){ const el=document.documentElement; const req=el.requestFullscreen||el.webkitRequestFullscreen; if(req) req.call(el).catch(()=>{}); if(screen.orientation&&screen.orientation.lock) screen.orientation.lock("landscape").catch(()=>{}); }
  document.getElementById("btnFs").onclick=goFs; document.getElementById("btnSolo").onclick=startSolo; const btnPlay=document.getElementById("btnPlay"); if(btnPlay) btnPlay.onclick=playNow; const btnJoin=document.getElementById("btnJoin"); if(btnJoin) btnJoin.onclick=joinOnline; const btnLeave=document.getElementById("btnLeave"); if(btnLeave) btnLeave.onclick=leaveLobby; const btnReady=document.getElementById("btnReady"); if(btnReady) btnReady.onclick=iAmReady; const btnLost=document.getElementById("btnLost"); if(btnLost) btnLost.onclick=()=>{ if(lostEl) lostEl.classList.add("hidden"); menu.classList.remove("hidden"); };
  document.getElementById("btnAgain").onclick=()=>{ mode="menu"; end.classList.add("hidden"); menu.classList.remove("hidden"); if(net&&net.peer) try{net.peer.destroy();}catch(e){} net=null; if(window.SFX) SFX.menu(); };
  const muteBtn=document.getElementById("btnMute");
  if(muteBtn) muteBtn.onclick=()=>{ if(!window.SFX) return; const on=SFX.toggle(); muteBtn.textContent=on?"SFX":"MUTE"; };
  requestAnimationFrame(loop);
})();
