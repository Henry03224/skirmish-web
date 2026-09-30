(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const menu = document.getElementById("menu");
  const end = document.getElementById("end");
  const hudMeta = document.getElementById("hudMeta");
  const nameInput = document.getElementById("nameInput");
  const roomInput = document.getElementById("roomInput");
  const touchUI = document.getElementById("touch");

  const W = 1280, H = 720;
  const GRAV = 0.45, JET = 0.72, MOVE = 0.55, FRIC = 0.86, MAX_VX = 7.2, MAX_VY = 11;
  const MATCH_MS = 120000;
  const COLORS = ["#3dff8a", "#4db7ff", "#ffb020", "#ff6ad5", "#ff4d4d", "#c8ff4d"];

  const MAP = [
    { x: 0, y: 680, w: 1280, h: 40 },
    { x: 80, y: 540, w: 220, h: 18 },
    { x: 980, y: 540, w: 220, h: 18 },
    { x: 430, y: 470, w: 420, h: 18 },
    { x: 160, y: 360, w: 180, h: 18 },
    { x: 940, y: 360, w: 180, h: 18 },
    { x: 520, y: 280, w: 240, h: 18 },
    { x: 40, y: 200, w: 160, h: 18 },
    { x: 1080, y: 200, w: 160, h: 18 },
    { x: 300, y: 140, w: 140, h: 16 },
    { x: 840, y: 140, w: 140, h: 16 },
  ];
  const SPAWNS = [
    { x: 120, y: 620 }, { x: 1160, y: 620 }, { x: 640, y: 430 },
    { x: 200, y: 320 }, { x: 1080, y: 320 }, { x: 640, y: 240 },
  ];

  const keys = {};
  let mode = "menu";
  let localTwo = false;
  let net = null;
  let youId = "p1";
  let players = [];
  let bullets = [];
  let nades = [];
  let pickups = [];
  let particles = [];
  let startAt = 0;
  let winner = null;

  function uid() { return Math.random().toString(36).slice(2, 8); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function spawnPoint() { return SPAWNS[Math.floor(Math.random() * SPAWNS.length)]; }

  function makePlayer(id, name, color, kind) {
    const s = spawnPoint();
    return {
      id, name, color, kind,
      x: s.x, y: s.y, vx: 0, vy: 0, dir: 1,
      hp: 100, jet: 100, ammo: 24, nades: 2, weapon: "pistol",
      kills: 0, deaths: 0, alive: true, respawn: 0, fireCd: 0, nadeCd: 0,
      aim: 0, input: { l: 0, r: 0, u: 0, d: 0, jet: 0, fire: 0, nade: 0 },
    };
  }

  function resetWorld(list) {
    players = list; bullets = []; nades = []; particles = [];
    pickups = [
      { x: 640, y: 250, t: "smg", tmr: 0 },
      { x: 170, y: 330, t: "shot", tmr: 0 },
      { x: 1110, y: 330, t: "health", tmr: 0 },
    ];
    startAt = performance.now(); winner = null; mode = "play";
    menu.classList.add("hidden"); end.classList.add("hidden");
  }

  function startSolo() {
    const name = (nameInput.value || "PLAYER").toUpperCase();
    const list = [makePlayer("p1", name, COLORS[0], "human")];
    for (let i = 0; i < 4; i++) list.push(makePlayer("bot" + i, "BOT " + (i + 1), COLORS[i + 1], "bot"));
    youId = "p1"; localTwo = false; net = null; resetWorld(list);
  }

  function startLocal() {
    const n1 = (nameInput.value || "P1").toUpperCase();
    resetWorld([
      makePlayer("p1", n1, COLORS[0], "human"),
      makePlayer("p2", "P2", COLORS[1], "human"),
      makePlayer("bot0", "BOT 1", COLORS[2], "bot"),
      makePlayer("bot1", "BOT 2", COLORS[3], "bot"),
    ]);
    youId = "p1"; localTwo = true; net = null;
  }

  function platHit(p) {
    for (const m of MAP) {
      if (p.x > m.x && p.x < m.x + m.w && p.y + 18 > m.y && p.y + 18 < m.y + m.h + 16 && p.vy >= 0) {
        p.y = m.y - 18; p.vy = 0; return true;
      }
    }
    return false;
  }

  function readLocalInput(p, slot) {
    const i = p.input;
    if (slot === 1) {
      if (localTwo) {
        i.l = keys["a"] ? 1 : 0; i.r = keys["d"] ? 1 : 0;
        i.u = keys["w"] ? 1 : 0; i.d = keys["s"] ? 1 : 0;
        i.jet = keys[" "] ? 1 : 0; i.fire = keys["j"] ? 1 : 0; i.nade = keys["k"] ? 1 : 0;
      } else {
        i.l = keys["a"] || keys["arrowleft"] ? 1 : 0;
        i.r = keys["d"] || keys["arrowright"] ? 1 : 0;
        i.u = keys["w"] || keys["arrowup"] ? 1 : 0;
        i.d = keys["s"] || keys["arrowdown"] ? 1 : 0;
        i.jet = keys[" "] || keys["shift"] ? 1 : 0;
        i.fire = keys["j"] || keys["enter"] || keys["z"] ? 1 : 0;
        i.nade = keys["k"] || keys["x"] ? 1 : 0;
      }
    } else {
      i.l = keys["arrowleft"] ? 1 : 0; i.r = keys["arrowright"] ? 1 : 0;
      i.u = keys["arrowup"] ? 1 : 0; i.d = keys["arrowdown"] ? 1 : 0;
      i.jet = keys["shift"] ? 1 : 0; i.fire = keys["/"] ? 1 : 0;
      i.nade = keys["?"] || keys["."] ? 1 : 0;
    }
  }

  function botThink(p) {
    const foes = players.filter((o) => o.alive && o.id !== p.id);
    if (!foes.length) return;
    foes.sort((a, b) => dist(a, p) - dist(b, p));
    const t = foes[0];
    p.input.l = t.x < p.x - 20 ? 1 : 0;
    p.input.r = t.x > p.x + 20 ? 1 : 0;
    p.input.jet = t.y < p.y - 30 || p.y > 620 ? 1 : 0;
    p.input.fire = dist(t, p) < 420 && Math.random() < 0.35 ? 1 : 0;
    p.input.nade = dist(t, p) < 180 && Math.random() < 0.02 ? 1 : 0;
    p.dir = t.x >= p.x ? 1 : -1;
    p.aim = Math.atan2(t.y - p.y, t.x - p.x);
  }

  function fire(p) {
    if (p.fireCd > 0 || p.ammo <= 0) return;
    const w = p.weapon;
    const n = w === "shot" ? 5 : 1;
    const spread = w === "shot" ? 0.28 : w === "smg" ? 0.08 : 0.03;
    const spd = w === "shot" ? 13 : 16;
    const dmg = w === "shot" ? 12 : w === "smg" ? 9 : 16;
    p.fireCd = w === "smg" ? 7 : w === "shot" ? 28 : 16;
    p.ammo -= w === "shot" ? 2 : 1;
    const base = p.aim || (p.dir > 0 ? 0 : Math.PI);
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * spread;
      bullets.push({
        x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 8,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        owner: p.id, dmg, life: 50,
      });
    }
  }

  function throwNade(p) {
    if (p.nadeCd > 0 || p.nades <= 0) return;
    p.nades--; p.nadeCd = 50;
    const a = p.aim || (p.dir > 0 ? -0.4 : Math.PI + 0.4);
    nades.push({ x: p.x, y: p.y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8 - 3, owner: p.id, fuse: 70 });
  }

  function explode(x, y, owner, r, dmg) {
    for (let i = 0; i < 18; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 20 + Math.random() * 16, c: "#ffb020" });
    }
    for (const p of players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r) hurt(p, dmg * (1 - d / r), owner);
    }
  }

  function hurt(p, dmg, owner) {
    p.hp -= dmg;
    if (p.hp <= 0) {
      p.hp = 0; p.alive = false; p.deaths++; p.respawn = 90;
      const k = players.find((o) => o.id === owner);
      if (k && k.id !== p.id) k.kills++;
      explode(p.x, p.y, owner, 30, 0);
    }
  }

  function stepPlayer(p) {
    if (!p.alive) {
      p.respawn--;
      if (p.respawn <= 0) {
        const s = spawnPoint();
        p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0;
        p.hp = 100; p.jet = 100; p.ammo = 24; p.nades = 2; p.weapon = "pistol"; p.alive = true;
      }
      return;
    }
    if (p.input.l) { p.vx -= MOVE; p.dir = -1; }
    if (p.input.r) { p.vx += MOVE; p.dir = 1; }
    p.vx = clamp(p.vx * FRIC, -MAX_VX, MAX_VX);
    if (p.input.jet && p.jet > 0) {
      p.vy -= JET; p.jet -= 1.15;
      particles.push({ x: p.x, y: p.y + 16, vx: (Math.random() - 0.5), vy: 2, life: 10, c: "#7cf" });
    } else p.jet = Math.min(100, p.jet + 0.45);
    p.vy = clamp(p.vy + GRAV, -MAX_VY, MAX_VY);
    p.x += p.vx; p.y += p.vy;
    p.x = clamp(p.x, 16, W - 16);
    if (p.y > H + 40) { p.hp = 0; hurt(p, 999, p.id); }
    platHit(p);
    if (p.fireCd > 0) p.fireCd--;
    if (p.nadeCd > 0) p.nadeCd--;
    if (p.input.fire) fire(p);
    if (p.input.nade) throwNade(p);
    if (!p.aim || p.kind === "human") p.aim = p.dir > 0 ? 0 : Math.PI;
    for (const pk of pickups) {
      if (pk.tmr > 0) { pk.tmr--; continue; }
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 28) {
        if (pk.t === "health") p.hp = Math.min(100, p.hp + 40);
        if (pk.t === "smg") { p.weapon = "smg"; p.ammo = 40; }
        if (pk.t === "shot") { p.weapon = "shot"; p.ammo = 16; }
        pk.tmr = 400;
      }
    }
  }

  function stepWorld() {
    const left = MATCH_MS - (performance.now() - startAt);
    if (left <= 0 && !winner) {
      winner = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0];
      mode = "end";
      document.getElementById("endTitle").textContent = winner.name + " wins";
      document.getElementById("endBody").textContent = players.map((p) => p.name + "  " + p.kills + "K / " + p.deaths + "D").join(" · ");
      end.classList.remove("hidden");
      return;
    }
    for (const p of players) { if (p.kind === "bot") botThink(p); stepPlayer(p); }
    for (const b of bullets) {
      b.x += b.vx; b.y += b.vy; b.life--;
      for (const m of MAP) if (b.x > m.x && b.x < m.x + m.w && b.y > m.y && b.y < m.y + m.h) b.life = 0;
      for (const p of players) {
        if (!p.alive || p.id === b.owner) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 16) { hurt(p, b.dmg, b.owner); b.life = 0; }
      }
    }
    bullets = bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < W + 20);
    for (const n of nades) {
      n.vy += 0.28; n.x += n.vx; n.y += n.vy; n.vx *= 0.99;
      if (platHit({ x: n.x, y: n.y, vy: n.vy })) { n.vy *= -0.35; n.vx *= 0.7; }
      n.fuse--;
      if (n.fuse <= 0) explode(n.x, n.y, n.owner, 90, 55);
    }
    nades = nades.filter((n) => n.fuse > 0);
    for (const q of particles) { q.x += q.vx; q.y += q.vy; q.life--; }
    particles = particles.filter((q) => q.life > 0);
  }

  function drawStick(p) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.strokeStyle = p.color; ctx.fillStyle = p.color; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, -10, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 10);
    ctx.moveTo(-9, 2); ctx.lineTo(9, 2);
    ctx.moveTo(0, 10); ctx.lineTo(-7, 18); ctx.moveTo(0, 10); ctx.lineTo(7, 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(p.dir * 16, 0); ctx.stroke();
    ctx.fillRect(p.dir * 14, -2, 8, 3); ctx.restore();
    ctx.fillStyle = "#0008"; ctx.fillRect(p.x - 16, p.y - 28, 32, 4);
    ctx.fillStyle = p.hp > 40 ? "#3dff8a" : "#ff4d4d"; ctx.fillRect(p.x - 16, p.y - 28, 32 * (p.hp / 100), 4);
    ctx.fillStyle = "#e8f0e8"; ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(p.name, p.x, p.y - 32);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1b2a33"); g.addColorStop(1, "#0c1418");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1e3a2a";
    for (let i = 0; i < 8; i++) ctx.fillRect(80 + i * 160, 80, 40, H);
    ctx.fillStyle = "#24363c";
    for (const m of MAP) ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = "#3dff8a55";
    for (const m of MAP) ctx.fillRect(m.x, m.y, m.w, 3);
    for (const pk of pickups) {
      if (pk.tmr > 0) continue;
      ctx.fillStyle = pk.t === "health" ? "#3dff8a" : pk.t === "smg" ? "#4db7ff" : "#ffb020";
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 8, 0, Math.PI * 2); ctx.fill();
    }
    for (const q of particles) {
      ctx.globalAlpha = clamp(q.life / 20, 0, 1); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 3, 3); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#ffd27a";
    for (const b of bullets) ctx.fillRect(b.x, b.y, 4, 2);
    ctx.fillStyle = "#9c6";
    for (const n of nades) { ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, Math.PI * 2); ctx.fill(); }
    for (const p of players) if (p.alive) drawStick(p);
    const me = players.find((p) => p.id === youId) || players[0];
    if (me) {
      ctx.fillStyle = "#e8f0e8"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(me.weapon.toUpperCase() + "  AMMO " + Math.max(0, me.ammo) + "  NADE " + me.nades + "  JET " + (me.jet | 0), 16, 24);
      const left = Math.max(0, MATCH_MS - (performance.now() - startAt));
      ctx.textAlign = "right"; ctx.fillText((left / 1000 | 0) + "s", W - 16, 24);
      ctx.font = "12px sans-serif";
      players.slice().sort((a, b) => b.kills - a.kills).forEach((p, i) => {
        ctx.fillStyle = p.color; ctx.fillText(p.name + " " + p.kills + "/" + p.deaths, W - 16, 48 + i * 16);
      });
    }
  }

  function serialize() {
    return { startAt, players: players.map((p) => ({ ...p })), bullets, nades, pickups, winner, mode };
  }
  function applySnap(s) {
    startAt = s.startAt; players = s.players; bullets = s.bullets; nades = s.nades; pickups = s.pickups; winner = s.winner;
    if (s.mode === "end" && mode !== "end") {
      mode = "end";
      document.getElementById("endTitle").textContent = (winner && winner.name) + " wins";
      end.classList.remove("hidden");
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    const me = players.find((p) => p.id === youId);
    if (mode === "play") {
      if (me && me.kind === "human") readLocalInput(me, 1);
      if (localTwo) {
        const p2 = players.find((p) => p.id === "p2");
        if (p2) readLocalInput(p2, 2);
      }
      const host = !net || net.role === "host";
      if (host) {
        stepWorld();
        if (net && net.conns) {
          const snap = serialize();
          net.conns.forEach((c) => { try { c.send({ t: "snap", snap }); } catch (e) {} });
        }
      } else if (net && me) {
        try { net.hostConn.send({ t: "in", id: youId, input: me.input }); } catch (e) {}
      }
      draw();
      const left = Math.max(0, MATCH_MS - (performance.now() - startAt));
      hudMeta.textContent = (net ? "ONLINE " + (net.code || "") + " · " : "") + (left / 1000 | 0) + "s";
    }
  }

  function roomCode() {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  function hostOnline() {
    if (typeof Peer === "undefined") { alert("PeerJS failed to load. Use Play vs Bots."); return; }
    const code = roomCode();
    const name = (nameInput.value || "HOST").toUpperCase();
    const peer = new Peer("skirmish-" + code);
    net = { role: "host", code, peer, conns: [] };
    youId = "p1"; localTwo = false;
    peer.on("open", () => { hudMeta.textContent = "ROOM " + code; resetWorld([makePlayer("p1", name, COLORS[0], "human")]); });
    peer.on("connection", (conn) => {
      net.conns.push(conn);
      conn.on("data", (msg) => {
        if (msg.t === "hello") {
          if (players.length >= 6) return;
          players.push(makePlayer(msg.id, msg.name, COLORS[players.length % COLORS.length], "human"));
        }
        if (msg.t === "in") {
          const p = players.find((x) => x.id === msg.id);
          if (p) p.input = msg.input;
        }
      });
    });
    peer.on("error", (e) => { hudMeta.textContent = String(e); });
  }

  function joinOnline() {
    if (typeof Peer === "undefined") { alert("PeerJS failed to load."); return; }
    const code = (roomInput.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) return;
    const name = (nameInput.value || "GUEST").toUpperCase();
    const my = uid();
    const peer = new Peer();
    net = { role: "client", code, peer, hostConn: null };
    youId = my; localTwo = false;
    peer.on("open", () => {
      const conn = peer.connect("skirmish-" + code);
      net.hostConn = conn;
      conn.on("open", () => { conn.send({ t: "hello", id: my, name }); menu.classList.add("hidden"); mode = "play"; });
      conn.on("data", (msg) => { if (msg.t === "snap") applySnap(msg.snap); });
    });
    peer.on("error", (e) => { hudMeta.textContent = String(e); });
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  const isTouch = matchMedia("(pointer: coarse)").matches;
  if (isTouch) touchUI.classList.remove("hidden");
  const pad = document.getElementById("padMove");
  function padSet(ev) {
    const t = ev.touches ? ev.touches[0] : ev;
    const r = pad.getBoundingClientRect();
    const x = t.clientX - r.left - r.width / 2;
    const y = t.clientY - r.top - r.height / 2;
    const me = players.find((p) => p.id === youId);
    if (!me) return;
    me.input.l = x < -12 ? 1 : 0; me.input.r = x > 12 ? 1 : 0;
    me.input.u = y < -12 ? 1 : 0; me.input.d = y > 12 ? 1 : 0;
  }
  pad.addEventListener("touchstart", padSet);
  pad.addEventListener("touchmove", padSet);
  pad.addEventListener("touchend", () => {
    const me = players.find((p) => p.id === youId);
    if (me) me.input.l = me.input.r = me.input.u = me.input.d = 0;
  });
  document.querySelectorAll(".btns button").forEach((b) => {
    const act = b.dataset.act;
    const down = () => {
      const me = players.find((p) => p.id === youId); if (!me) return;
      if (act === "jump") me.input.jet = 1;
      if (act === "fire") me.input.fire = 1;
      if (act === "nade") me.input.nade = 1;
    };
    const up = () => {
      const me = players.find((p) => p.id === youId); if (!me) return;
      if (act === "jump") me.input.jet = 0;
      if (act === "fire") me.input.fire = 0;
      if (act === "nade") me.input.nade = 0;
    };
    b.addEventListener("touchstart", (e) => { e.preventDefault(); down(); });
    b.addEventListener("touchend", up);
  });

  document.getElementById("btnSolo").onclick = startSolo;
  document.getElementById("btnLocal").onclick = startLocal;
  document.getElementById("btnHost").onclick = hostOnline;
  document.getElementById("btnJoin").onclick = joinOnline;
  document.getElementById("btnAgain").onclick = () => {
    mode = "menu"; end.classList.add("hidden"); menu.classList.remove("hidden");
    if (net && net.peer) try { net.peer.destroy(); } catch (e) {}
    net = null;
  };

  requestAnimationFrame(loop);
})();
