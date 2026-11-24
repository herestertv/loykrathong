/* Digital Loy Krathong — app logic (no build step, no dependencies) */
{
'use strict';

/* ------------------------------------------------------------------ config */
const CFG = Object.assign({GOOGLE_MAPS_API_KEY:'',GOOGLE_MAPS_MAP_ID:'',SUPABASE_URL:'',SUPABASE_ANON_KEY:'',FORCE_DEMO:false}, window.LK_CONFIG || {});
const USE_GOOGLE = !CFG.FORCE_DEMO && !!CFG.GOOGLE_MAPS_API_KEY;
const USE_SUPABASE = !CFG.FORCE_DEMO && !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WISH_MAX = 250, NICK_MAX = 30, REAL_MAX = 60, COOLDOWN_MS = 30000;

/* ----------------------------------------------------------------- helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const store_ = {get(k){try{return JSON.parse(localStorage.getItem(k))}catch{return null}}, set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const sess = {get(k){try{return JSON.parse(sessionStorage.getItem(k))}catch{return null}}, set(k,v){try{sessionStorage.setItem(k,JSON.stringify(v))}catch{}}};
const fmtDate = iso => { try { return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)); } catch { return iso; } };
const km = (a, b) => { const R = 6371, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lng - a.lng) * t; const h = Math.sin(dLa/2)**2 + Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
const fmtKm = d => d < 1 ? `${Math.round(d*1000)} ม.` : `${d < 10 ? d.toFixed(1) : Math.round(d)} กม.`;
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* -------------------------------------------------------------------- data */
const KRATHONGS = [
  {id:'pink-lotus', name:'กระทงดอกบัวสีชมพู', img:'assets/k-pink-lotus.webp', flame:[.465,.17], desc:'กลีบบัวสีชมพูซ้อนชั้น ฐานใบตองพับ ปักธูปเทียน สื่อถึงความรักและความบริสุทธิ์ของจิตใจ'},
  {id:'banana-leaf', name:'กระทงใบตองแบบดั้งเดิม', img:'assets/k-banana-leaf.webp', flame:[.55,.08], desc:'ใบตองพับกลีบผกาเรียงรอบ โรยดอกดาวเรืองสีทอง เรียบง่ายแบบกระทงที่คนไทยคุ้นเคย'},
  {id:'purple-gold', name:'กระทงดอกไม้สีม่วงและทอง', img:'assets/k-purple-gold.webp', flame:[.465,.17], desc:'กลีบม่วงอมทอง ประดับดอกไม้สีทอง ให้ความรู้สึกสง่างามและเป็นมงคล'},
  {id:'elaborate-lotus', name:'กระทงดอกบัวแบบประณีต', img:'assets/k-elaborate-lotus.webp', flame:[.5,.02], drawCandle:true, desc:'กลีบบัวซ้อนหลายชั้นอย่างประณีต รูปทรงกว้างลอยน้ำได้มั่นคง'},
  {id:'we-special', name:'กระทง WE Special Edition', img:'assets/k-we-special.webp', flame:[.45,.06], tag:'Special', desc:'กระทงรุ่นพิเศษจาก WE ใบตองเขียว กลีบม่วงเหลือง ดอกมะลิ ดอกกล้วยไม้ และโบว์สีทอง'}
];
const KT = Object.fromEntries(KRATHONGS.map(k => [k.id, k]));

// Starter places. Coordinates are approximate (used in Demo Mode; Google mode snaps to the real place).
const PLACES = [
  {id:'chao-phraya', name:'แม่น้ำเจ้าพระยา', en:'Chao Phraya River', province:'กรุงเทพมหานคร', lat:13.7225, lng:100.5130, detail:'แม่น้ำสายหลักของกรุงเทพฯ ริมฝั่งมีท่าน้ำและวัดสำคัญหลายแห่ง'},
  {id:'rama8', name:'สะพานพระราม 8', en:'Rama VIII Bridge', province:'กรุงเทพมหานคร', lat:13.7697, lng:100.4975, detail:'สะพานขึงข้ามแม่น้ำเจ้าพระยา มีสวนสาธารณะริมน้ำใต้สะพานฝั่งพระนคร'},
  {id:'wat-arun', name:'วัดอรุณราชวราราม', en:'Wat Arun', province:'กรุงเทพมหานคร', lat:13.7437, lng:100.4889, detail:'วัดริมแม่น้ำเจ้าพระยาฝั่งธนบุรี โดดเด่นด้วยพระปรางค์องค์ใหญ่'},
  {id:'ong-ang', name:'คลองโอ่งอ่าง', en:'Khlong Ong Ang', province:'กรุงเทพมหานคร', lat:13.7466, lng:100.5025, detail:'คลองในย่านเมืองเก่า ปรับปรุงเป็นทางเดินริมคลองและถนนคนเดิน'},
  {id:'benjakitti', name:'สวนเบญจกิติ', en:'Benjakitti Park', province:'กรุงเทพมหานคร', lat:13.7290, lng:100.5580, detail:'สวนสาธารณะขนาดใหญ่ใจกลางเมือง มีบึงน้ำและทางเดินยกระดับ'},
  {id:'lumphini', name:'สวนลุมพินี', en:'Lumphini Park', province:'กรุงเทพมหานคร', lat:13.7314, lng:100.5414, detail:'สวนสาธารณะเก่าแก่ใจกลางกรุงเทพฯ มีสระน้ำขนาดใหญ่'},
  {id:'tha-phae', name:'ประตูท่าแพ', en:'Tha Phae Gate', province:'เชียงใหม่', lat:18.7877, lng:98.9933, detail:'ประตูเมืองเก่าเชียงใหม่ ย่านจัดงานประเพณียี่เป็ง'},
  {id:'ping-cm', name:'แม่น้ำปิง', en:'Ping River (Chiang Mai)', province:'เชียงใหม่', lat:18.7880, lng:99.0045, detail:'แม่น้ำสายหลักของเมืองเชียงใหม่ จุดลอยกระทงช่วงเทศกาลยี่เป็ง'},
  {id:'sukhothai', name:'อุทยานประวัติศาสตร์สุโขทัย', en:'Sukhothai Historical Park', province:'สุโขทัย', lat:17.0170, lng:99.7036, detail:'แหล่งมรดกโลก สถานที่จัดงาน “ลอยกระทง เผาเทียน เล่นไฟ”'},
  {id:'si-fai', name:'บึงสีไฟ', en:'Bueng Si Fai', province:'พิจิตร', lat:16.4690, lng:100.3410, detail:'บึงน้ำจืดขนาดใหญ่ของจังหวัดพิจิตร'},
  {id:'kaen-nakhon', name:'บึงแก่นนคร', en:'Bueng Kaen Nakhon', province:'ขอนแก่น', lat:16.4140, lng:102.8370, detail:'บึงกลางเมืองขอนแก่น มีทางเดินรอบบึงและพระมหาธาตุแก่นนคร'},
  {id:'nong-prajak', name:'สวนสาธารณะหนองประจักษ์', en:'Nong Prajak Park', province:'อุดรธานี', lat:17.4120, lng:102.7830, detail:'สวนสาธารณะและหนองน้ำกลางเมืองอุดรธานี'},
  {id:'ayutthaya', name:'อุทยานประวัติศาสตร์พระนครศรีอยุธยา', en:'Ayutthaya Historical Park', province:'พระนครศรีอยุธยา', lat:14.3560, lng:100.5600, detail:'เมืองเก่าแหล่งมรดกโลก ล้อมรอบด้วยแม่น้ำสามสาย'},
  {id:'kwai-bridge', name:'สะพานข้ามแม่น้ำแคว', en:'River Kwai Bridge', province:'กาญจนบุรี', lat:14.0406, lng:99.5036, detail:'สะพานประวัติศาสตร์ข้ามแม่น้ำแควใหญ่'},
  {id:'ping-tak', name:'แม่น้ำปิง จังหวัดตาก', en:'Ping River (Tak)', province:'ตาก', lat:16.8790, lng:99.1260, detail:'ริมแม่น้ำปิงในตัวเมืองตาก แหล่งประเพณีลอยกระทงสาย'},
  {id:'mekong-np', name:'ริมโขง นครพนม', en:'Mekong Riverside (Nakhon Phanom)', province:'นครพนม', lat:17.4050, lng:104.7810, detail:'ทางเดินริมแม่น้ำโขง มองเห็นฝั่งลาว'}
];
const PLACE_BY_ID = Object.fromEntries(PLACES.map(p => [p.id, p]));
const FEATURED = ['chao-phraya','rama8','wat-arun','ong-ang','benjakitti','tha-phae','ping-cm','sukhothai','si-fai','kaen-nakhon','nong-prajak'];

// Coarse outline of Thailand for the demo map (lng, lat).
const TH = [[98.0,19.8],[98.9,19.75],[99.5,20.15],[100.1,20.42],[100.5,20.2],[100.6,19.5],[101.25,19.6],[101.0,18.4],[101.1,17.5],[102.1,18.2],[102.7,17.9],[103.4,18.4],[104.0,18.3],[104.7,17.5],[104.8,16.5],[105.6,15.7],[105.5,14.4],[104.0,14.3],[102.9,14.2],[102.5,13.6],[102.3,12.2],[102.9,11.65],[102.1,12.2],[101.4,12.65],[100.95,12.7],[100.9,13.45],[100.5,13.5],[100.0,13.4],[100.0,12.6],[99.95,12.0],[99.5,10.9],[99.2,10.3],[99.25,9.2],[99.9,9.2],[100.4,7.3],[101.0,6.85],[101.7,6.75],[102.1,6.2],[101.1,5.7],[100.2,6.45],[99.7,6.9],[99.3,7.4],[98.4,8.2],[98.3,9.0],[98.6,9.95],[98.75,10.6],[99.2,11.1],[99.65,11.8],[99.2,12.3],[99.15,13.0],[98.6,14.3],[98.2,15.1],[98.6,16.1],[98.9,16.6],[98.5,17.0],[97.7,18.3],[97.35,18.55],[97.75,19.3]];

/* ------------------------------------------------------------- moderation */
const BAD = ['ควย','เย็ด','เหี้ย','สัส','สันดาน','ไอ้สัตว์','อีดอก','อีสัตว์','แม่มึงตาย','fuck','shit','bitch','cunt','asshole','motherfucker','nigger','porn'];
const NAME_RE = /^[\p{L}\p{M}\p{N}\s.'’\-_()]+$/u;
function moderate(text) {
  const t = text.toLowerCase().replace(/[\s._\-*]+/g, '');
  if (BAD.some(w => t.includes(w))) return 'ข้อความมีถ้อยคำที่ไม่เหมาะสม กรุณาแก้ไข';
  if (/(https?:\/\/|www\.|\.(com|net|org|co|io|me|th)\b|line\.me|t\.me\/|@[a-z0-9_]{3,})/i.test(text)) return 'ไม่อนุญาตให้ใส่ลิงก์หรือช่องทางติดต่อในคำอธิษฐาน';
  if (/\d{9,}/.test(text.replace(/[\s\-().]/g, ''))) return 'ไม่อนุญาตให้ใส่เบอร์โทรศัพท์หรือเลขบัญชี';
  if (/(.)\1{9,}/u.test(text)) return 'ข้อความมีตัวอักษรซ้ำมากเกินไป';
  return '';
}
const clean = s => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, '').replace(/\n{3,}/g, '\n\n').trim();

/* =================================================================== STORES
   Each store: name, label, ready(), save(rec, privateRec) -> {id}, list() -> items[], subscribe?(cb) */
function publicShape(r) {
  return {id:r.id, nickname:r.nickname, wish:r.wish, krathong:r.krathong, placeName:r.placeName, province:r.province, lat:r.lat, lng:r.lng, createdAt:r.createdAt, sample:!!r.sample};
}

const SAMPLES = [
  {id:'s1', nickname:'เตอร์', wish:'ขอให้ปีนี้เป็นปีที่ดี ประสบความสำเร็จในทุกสิ่งที่ตั้งใจ สุขภาพแข็งแรง และพบเจอแต่คนที่ดี', krathong:'we-special', placeName:'สะพานพระราม 8', province:'กรุงเทพมหานคร', lat:13.7697, lng:100.4975, hoursAgo:2},
  {id:'s2', nickname:'มายด์', wish:'ขอให้ครอบครัวมีความสุข พ่อแม่สุขภาพแข็งแรง', krathong:'pink-lotus', placeName:'แม่น้ำปิง', province:'เชียงใหม่', lat:18.788, lng:99.0045, hoursAgo:5},
  {id:'s3', nickname:'Ben', wish:'May this year bring calm, courage and kind people.', krathong:'banana-leaf', placeName:'อุทยานประวัติศาสตร์สุโขทัย', province:'สุโขทัย', lat:17.017, lng:99.7036, hoursAgo:9},
  {id:'s4', nickname:'ปอนด์', wish:'ขอให้สอบติดคณะที่ตั้งใจไว้', krathong:'purple-gold', placeName:'บึงแก่นนคร', province:'ขอนแก่น', lat:16.414, lng:102.837, hoursAgo:20}
].map(s => ({...s, sample:true, createdAt:new Date(Date.now() - s.hoursAgo * 36e5).toISOString()}));

const LocalStore = {
  name:'local', label:'บันทึกในเบราว์เซอร์นี้ (Demo)',
  async ready() { return true; },
  async save(rec) {
    await sleep(500);
    const all = store_.get('lk.local.krathongs') || [];
    if (all.some(x => x.clientId === rec.clientId)) return {id: rec.id, duplicate:true};
    all.unshift({...rec}); store_.set('lk.local.krathongs', all.slice(0, 300));
    return {id: rec.id};
  },
  async list() {
    const mine = (store_.get('lk.local.krathongs') || []).filter(r => r.isPublic && r.status === 'released').map(publicShape);
    return [...mine, ...SAMPLES.map(publicShape)];
  }
};

// Artifact-hosted shared store (works when this page runs as a Claude artifact).
const ClaudeDbStore = {
  name:'claude', label:'ฐานข้อมูลที่แชร์ร่วมกัน (Live)', db:null, uid:null, cache:[], listeners:new Set(), unsub:null, loaded:false, lastErr:null,
  async ready() {
    if (!window.claude || typeof window.claude.use !== 'function') return false;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db) return false;
      this.db = db;
      this.uid = user ? await user.id() : null;
      this.canWrite = user ? await user.can('data.write') : null;
      return !!this.uid;
    } catch { return false; }
  },
  async save(rec) {
    const ref = this.db.doc('krathongs/' + this.uid);
    const snap = await ref.get();
    const items = snap.exists ? [...(snap.data().items || [])] : [];
    if (items.some(x => x.clientId === rec.clientId)) return {id: rec.id, duplicate:true};
    const pub = {
      id: rec.id, clientId: rec.clientId, krathong: rec.krathong, placeName: rec.placeName, province: rec.province,
      lat: rec.lat, lng: rec.lng, createdAt: rec.createdAt, status: rec.status, isPublic: rec.isPublic,
      // Private wishes keep their place and time only; nickname and text stay in the owner's private record.
      nickname: rec.isPublic ? rec.nickname : '', wish: rec.isPublic ? rec.wish : '', wishHash: rec.wishHash
    };
    items.unshift(pub);
    await ref.set({items: items.slice(0, 40), updatedAt: rec.createdAt});
    try { await this.db.collection('data/users/' + this.uid).doc('k-' + rec.id).set(rec); } catch {}
    return {id: rec.id};
  },
  subscribe(cb) {
    this.listeners.add(cb);
    if (!this.unsub) {
      const timer = setTimeout(() => { if (!this.loaded) { this.lastErr = 'timeout'; this.emit(); } }, 10000);
      this.unsub = this.db.collection('krathongs').limit(1000).onSnapshot(snap => {
        const all = [];
        snap.docs.forEach(d => (d.data().items || []).forEach(it => all.push(it)));
        this.cache = all;
        if (!snap.metadata.fromCache) { this.loaded = true; this.lastErr = null; clearTimeout(timer); }
        this.emit();
      }, err => { clearTimeout(timer); this.lastErr = err?.code || 'error'; this.emit(); });
    } else if (this.loaded) cb();
    return () => this.listeners.delete(cb);
  },
  emit() { this.listeners.forEach(f => f()); },
  async list() {
    return this.cache.filter(r => r && r.isPublic && r.status === 'released' && r.wish).map(publicShape)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  count() { return this.cache.filter(r => r && r.status === 'released').length; }
};

// Supabase via REST (no SDK needed). See supabase/schema.sql.
const SupabaseStore = {
  name:'supabase', label:'Supabase (Live)',
  base() { return CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1'; },
  headers(extra) { return Object.assign({apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json'}, extra || {}); },
  async ready() { return true; },
  async save(rec) {
    const res = await fetch(this.base() + '/rpc/release_krathong', {method:'POST', headers:this.headers(), body:JSON.stringify({
      p_client_id: rec.clientId, p_real_name: rec.realName || null, p_nickname: rec.nickname, p_wish: rec.wish,
      p_krathong_type: rec.krathong, p_place_name: rec.placeName, p_place_id: rec.placeId || null, p_province: rec.province || null,
      p_address: rec.address || null, p_lat: rec.lat, p_lng: rec.lng, p_is_public: rec.isPublic, p_fingerprint: rec.fingerprint
    })});
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(body.message || ('HTTP ' + res.status)); e.code = body.code || res.status; e.hint = body.hint; throw e; }
    const row = Array.isArray(body) ? body[0] : body;
    return {id: row?.id || rec.id, status: row?.status};
  },
  async list({q = '', province = '', offset = 0, limit = 24} = {}) {
    const p = new URLSearchParams({select:'id,nickname,wish,krathong_type,place_name,province,lat,lng,released_at', order:'released_at.desc', limit:String(limit), offset:String(offset)});
    if (province) p.set('province', 'eq.' + province);
    if (q) { const s = q.replace(/[,()*%]/g, ' ').trim(); if (s) p.set('or', `(nickname.ilike.*${s}*,wish.ilike.*${s}*,place_name.ilike.*${s}*)`); }
    const res = await fetch(this.base() + '/public_krathongs?' + p, {headers:this.headers({Prefer:'count=exact'})});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    const total = Number((res.headers.get('content-range') || '').split('/')[1]) || null;
    return {items: rows.map(r => ({id:r.id, nickname:r.nickname, wish:r.wish, krathong:r.krathong_type, placeName:r.place_name, province:r.province, lat:r.lat, lng:r.lng, createdAt:r.released_at})), total, server:true};
  },
  async provinces() {
    const res = await fetch(this.base() + '/rpc/public_provinces', {method:'POST', headers:this.headers(), body:'{}'});
    if (!res.ok) return [];
    return (await res.json()).map(r => r.province).filter(Boolean);
  }
};

let Store = LocalStore;
const storeReady = (async () => {
  if (USE_SUPABASE) { Store = SupabaseStore; return Store; }
  if (await ClaudeDbStore.ready()) { Store = ClaudeDbStore; return Store; }
  return Store;
})();

/* ==================================================================== STATE */
const blank = () => ({form:{realName:'', nickname:'', wish:'', isPublic:true}, krathong:null, place:null, step:1, clientId:uuid()});
let S = Object.assign(blank(), sess.get('lk.draft') || {});
const persist = () => sess.set('lk.draft', S);

/* =================================================================== ROUTER */
const VIEWS = ['home','create','gallery','float'];
let current = null;
function show(name) {
  if (current === 'float' && name !== 'float') Anim.stop();
  VIEWS.forEach(v => { $('#view-' + v).hidden = v !== name; });
  document.body.classList.toggle('floating', name === 'float');
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === name) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  current = name;
  Home.toggle(name === 'home');
  if (name === 'create') { goStep(S.step || 1, false); }
  if (name === 'gallery') Gallery.open();
  if (name !== 'float') window.scrollTo({top:0, behavior: REDUCED ? 'auto' : 'smooth'});
}
function route() {
  const h = (location.hash || '#home').slice(1);
  if (current === 'float' && h === 'create' && Release.busy) return;
  show(VIEWS.includes(h) && h !== 'float' ? h : 'home');
}
addEventListener('hashchange', route);
const nav = h => { if (location.hash === '#' + h) route(); else location.hash = h; };

/* ================================================================= STEPPER */
function goStep(n, focus = true) {
  if (n > 1 && !validateForm(false)) n = 1;
  else if (n > 2 && !S.krathong) n = 2;
  else if (n > 3 && !S.place) n = 3;
  S.step = n; persist();
  for (let i = 1; i <= 4; i++) $('#step-' + i).hidden = i !== n;
  $$('#stepper li').forEach(li => { const s = +li.dataset.s; li.classList.toggle('done', s < n); li.classList.toggle('cur', s === n); li.toggleAttribute('aria-current', s === n); if (s === n) li.setAttribute('aria-current','step'); });
  if (n === 2) KtPicker.render();
  if (n === 3) MapUI.open();
  if (n === 4) Confirm.render();
  if (focus) { const h = $('#step-' + n + ' h2'); h && h.focus({preventScroll:true}); window.scrollTo({top:0, behavior: REDUCED ? 'auto' : 'smooth'}); }
}

/* ==================================================================== FORM */
const F = {real:$('#f-real'), nick:$('#f-nick'), wish:$('#f-wish'), pub:$('#f-public')};
function setErr(input, el, msg) { $(el).textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
function validateForm(show = true) {
  const real = clean(F.real.value), nick = clean(F.nick.value), wish = clean(F.wish.value);
  let eR = '', eN = '', eW = '';
  if (real && (real.length > REAL_MAX || !NAME_RE.test(real))) eR = 'ชื่อจริงใช้ได้เฉพาะตัวอักษรไทย/อังกฤษ ตัวเลข และเว้นวรรค';
  else if (real) eR = moderate(real);
  if (!nick) eN = 'กรุณากรอกชื่อเล่น';
  else if (nick.length > NICK_MAX) eN = `ชื่อเล่นยาวได้ไม่เกิน ${NICK_MAX} ตัวอักษร`;
  else if (!NAME_RE.test(nick)) eN = 'ชื่อเล่นใช้ได้เฉพาะตัวอักษรไทย/อังกฤษ ตัวเลข และเว้นวรรค';
  else eN = moderate(nick);
  if (!wish) eW = 'กรุณาเขียนคำอธิษฐาน';
  else if (wish.length < 3) eW = 'คำอธิษฐานสั้นเกินไป';
  else if (wish.length > WISH_MAX) eW = `คำอธิษฐานยาวได้ไม่เกิน ${WISH_MAX} ตัวอักษร`;
  else eW = moderate(wish);
  if (show) { setErr(F.real, '#e-real', eR); setErr(F.nick, '#e-nick', eN); setErr(F.wish, '#e-wish', eW); }
  return !eR && !eN && !eW;
}
function syncForm() {
  if (F.wish.value.length > WISH_MAX) F.wish.value = F.wish.value.slice(0, WISH_MAX);
  S.form = {realName:F.real.value, nickname:F.nick.value, wish:F.wish.value, isPublic:F.pub.checked};
  persist();
  const n = F.wish.value.length, c = $('#wish-count');
  c.textContent = `${n}/${WISH_MAX}`; c.classList.toggle('warn', n >= 220 && n < WISH_MAX); c.classList.toggle('full', n >= WISH_MAX);
  const w = clean(F.wish.value), pv = $('#pv-wish');
  pv.textContent = w || 'คำอธิษฐานของคุณจะปรากฏที่นี่'; pv.classList.toggle('empty', !w);
  $('#pv-nick').textContent = clean(F.nick.value) || 'ชื่อเล่น';
  $('#pv-public').textContent = F.pub.checked ? 'จะแสดงในหน้ากระทงบนสายน้ำ (เฉพาะชื่อเล่น ไม่แสดงชื่อจริง)' : 'เก็บเป็นส่วนตัว — ไม่แสดงในหน้ากระทงบนสายน้ำ';
}
function fillForm() { F.real.value = S.form.realName || ''; F.nick.value = S.form.nickname || ''; F.wish.value = S.form.wish || ''; F.pub.checked = S.form.isPublic !== false; syncForm(); }
['input','change'].forEach(ev => $('#step-1').addEventListener(ev, e => {
  syncForm();
  if (e.target.getAttribute('aria-invalid') === 'true') validateForm(true);
}));
$('#step-1').addEventListener('submit', e => {
  e.preventDefault();
  if (validateForm(true)) goStep(2);
  else { const bad = $('#step-1 [aria-invalid=true]'); bad && bad.focus(); }
});
$('#fill-example').addEventListener('click', () => {
  if (!F.nick.value) F.nick.value = 'เตอร์';
  if (!F.real.value) F.real.value = 'ธนวัฒน์';
  F.wish.value = 'ขอให้ปีนี้เป็นปีที่ดี ประสบความสำเร็จในทุกสิ่งที่ตั้งใจ สุขภาพแข็งแรง และพบเจอแต่คนที่ดี';
  syncForm(); validateForm(true);
});

/* ======================================================== KRATHONG PICKER */
const KtPicker = {
  rendered:false,
  render() {
    const g = $('#kt-grid');
    if (!this.rendered) {
      g.innerHTML = KRATHONGS.map(k => `
        <div class="kt" role="radio" tabindex="-1" aria-checked="false" data-id="${k.id}" aria-label="${esc(k.name)}">
          ${k.tag ? `<span class="tag">${esc(k.tag)}</span>` : ''}<span class="chk" aria-hidden="true">✓</span>
          <img src="${k.img}" alt="" loading="lazy">
          <b>${esc(k.name)}</b>
          <button type="button" class="more" data-more="${k.id}">ดูรายละเอียด</button>
        </div>`).join('');
      g.addEventListener('click', e => {
        const more = e.target.closest('[data-more]');
        if (more) { e.stopPropagation(); return this.detail(more.dataset.more); }
        const c = e.target.closest('.kt'); if (c) this.select(c.dataset.id);
      });
      g.addEventListener('keydown', e => {
        const ids = KRATHONGS.map(k => k.id); let i = ids.indexOf(S.krathong);
        if (['ArrowRight','ArrowDown'].includes(e.key)) i = (i + 1) % ids.length;
        else if (['ArrowLeft','ArrowUp'].includes(e.key)) i = (i - 1 + ids.length) % ids.length;
        else if (e.key === ' ' || e.key === 'Enter') { const c = e.target.closest('.kt'); if (c && !e.target.closest('.more')) { e.preventDefault(); this.select(c.dataset.id); } return; }
        else return;
        e.preventDefault(); this.select(ids[i < 0 ? 0 : i]); $(`.kt[data-id="${ids[i < 0 ? 0 : i]}"]`).focus();
      });
      this.rendered = true;
    }
    this.sync();
  },
  select(id) { S.krathong = id; persist(); $('#e-kt').textContent = ''; this.sync(); },
  sync() {
    const sel = S.krathong;
    $$('.kt').forEach((c, i) => { const on = c.dataset.id === sel; c.setAttribute('aria-checked', on); c.tabIndex = on || (!sel && i === 0) ? 0 : -1; });
    const k = KT[sel], img = $('#kt-pv-img');
    if (k) { img.src = k.img; img.alt = k.name; $('#kt-pv-name').textContent = k.name; $('#kt-pv-desc').textContent = k.desc; }
    else { img.removeAttribute('src'); $('#kt-pv-name').textContent = 'ยังไม่ได้เลือกกระทง'; $('#kt-pv-desc').textContent = 'เลือกกระทงจากรายการเพื่อดูตัวอย่าง'; }
  },
  detail(id) {
    const k = KT[id];
    openDialog(`<img src="${k.img}" alt="${esc(k.name)}"><h3>${esc(k.name)}</h3><p>${esc(k.desc)}</p>
      <div class="cta-row"><button class="btn btn-gold" type="button" data-pick="${k.id}">เลือกกระทงนี้</button></div>`);
  }
};

/* ==================================================================== MAP */
const MapUI = {
  impl:null, inited:false,
  async open() {
    if (!this.inited) {
      this.inited = true;
      this.renderChips();
      this.bindSearch();
      $('#btn-nearby').addEventListener('click', () => this.nearby());
      $('#nearby-list').addEventListener('click', e => { const b = e.target.closest('[data-near]'); if (b) this.pick(this.nearbyCache[+b.dataset.near], true); });
      this.impl = DemoMap;
      if (USE_GOOGLE) {
        $('#map-loading').hidden = false;
        try { await GMap.init($('#map')); this.impl = GMap; }
        catch (err) { console.warn('Google Maps failed, using demo map', err); $('#map').innerHTML = ''; this.impl = DemoMap; this.notice('โหลด Google Maps ไม่สำเร็จ — ใช้แผนที่สาธิตแทน'); }
        $('#map-loading').hidden = true;
      }
      if (this.impl === DemoMap) DemoMap.init($('#map'));
      updateModeBadge();
    }
    this.impl.refresh && this.impl.refresh();
    if (S.place) this.showPlace(S.place, false);
  },
  notice(t) { $('#map-hint').textContent = t; },
  renderChips() {
    $('#preset-chips').innerHTML = FEATURED.map(id => `<button type="button" class="chip" data-place="${id}" aria-pressed="false">${esc(PLACE_BY_ID[id].name)}</button>`).join('');
    $('#preset-chips').addEventListener('click', e => { const b = e.target.closest('[data-place]'); if (b) this.pick({...PLACE_BY_ID[b.dataset.place], source:'preset'}, true); });
  },
  async pick(p, fly) {
    if (!p) return;
    if (this.impl === GMap && p.source === 'preset') { try { p = await GMap.resolvePreset(p) || p; } catch {} }
    S.place = {id:p.id, placeId:p.placeId || null, name:p.name, province:p.province || '', address:p.address || '', detail:p.detail || '', lat:+(+p.lat).toFixed(6), lng:+(+p.lng).toFixed(6), source:p.source || 'map'};
    persist(); $('#e-place').textContent = '';
    this.showPlace(S.place, fly);
  },
  showPlace(p, fly) {
    $('#place-card').innerHTML = `<h3>${esc(p.name)}</h3><p class="prov">${esc(p.province || 'ไม่ทราบจังหวัด')}</p>${p.detail || p.address ? `<p>${esc(p.detail || p.address)}</p>` : ''}<p class="coord">ละติจูด ${p.lat.toFixed(5)} · ลองจิจูด ${p.lng.toFixed(5)}</p>`;
    const pv = $('#place-preview'); pv.hidden = false; pv.textContent = `คุณกำลังจะลอยกระทง ณ ${p.name}`;
    $('#btn-nearby').disabled = false;
    $$('#preset-chips .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.place === p.id));
    this.impl && this.impl.select(p, fly);
  },
  nearbyCache:[],
  async nearby() {
    if (!S.place) return;
    const list = $('#nearby-list'), btn = $('#btn-nearby');
    btn.disabled = true; btn.classList.add('loading'); list.innerHTML = '';
    try {
      const res = await this.impl.nearby(S.place);
      this.nearbyCache = res;
      list.innerHTML = res.length ? res.map((p, i) => `<li><button type="button" data-near="${i}"><span>${esc(p.name)}<br><small>${esc(p.province || '')}</small></span><small>${fmtKm(km(S.place, p))}</small></button></li>`).join('')
        : '<li class="muted">ไม่พบสถานที่ใกล้เคียง</li>';
      this.impl.showNearby && this.impl.showNearby(res);
    } catch (e) { list.innerHTML = '<li class="err">ค้นหาสถานที่ใกล้เคียงไม่สำเร็จ ลองอีกครั้ง</li>'; }
    btn.disabled = false; btn.classList.remove('loading');
  },
  bindSearch() {
    const q = $('#place-q'), ul = $('#place-suggest');
    let items = [], active = -1;
    const close = () => { ul.hidden = true; q.setAttribute('aria-expanded','false'); active = -1; };
    const paint = () => { $$('li', ul).forEach((li, i) => li.setAttribute('aria-selected', i === active)); };
    const run = () => {
      const t = q.value.trim().toLowerCase();
      if (!t) { close(); return; }
      items = PLACES.filter(p => [p.name, p.en, p.province].some(s => s.toLowerCase().includes(t))).slice(0, 8);
      ul.innerHTML = items.length ? items.map((p, i) => `<li role="option" id="sg-${i}" data-i="${i}"><span>${esc(p.name)}</span><small>${esc(p.province)}</small></li>`).join('')
        : `<li class="none" role="option" aria-disabled="true">ไม่พบ “${esc(q.value.trim())}” ในรายการสาธิต${this.impl === GMap ? '' : ' — แตะบนแผนที่เพื่อปักหมุดเองได้'}</li>`;
      ul.hidden = false; q.setAttribute('aria-expanded','true'); active = -1;
    };
    q.addEventListener('input', run);
    q.addEventListener('focus', () => q.value && run());
    q.addEventListener('keydown', e => {
      if (ul.hidden) return;
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); paint(); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); const p = items[active < 0 ? 0 : active]; if (p) { this.pick({...p, source:'preset'}, true); q.value = p.name; close(); } }
      else if (e.key === 'Escape') close();
    });
    ul.addEventListener('mousedown', e => { const li = e.target.closest('[data-i]'); if (!li) return; e.preventDefault(); const p = items[+li.dataset.i]; this.pick({...p, source:'preset'}, true); q.value = p.name; close(); });
    q.addEventListener('blur', () => setTimeout(close, 150));
  }
};

/* ----------------------------------------------------------- demo (SVG) map */
const DemoMap = {
  el:null, svg:null, vb:null, full:null, K:100, COS:0.974,
  proj(lng, lat) { return [(lng - 97) * this.K * this.COS, (20.8 - lat) * this.K]; },
  unproj(x, y) { return {lng: x / (this.K * this.COS) + 97, lat: 20.8 - y / this.K}; },
  init(el) {
    this.el = el;
    const pts = TH.map(([lo, la]) => this.proj(lo, la));
    this.poly = pts;
    const d = 'M' + pts.map(p => p.map(n => n.toFixed(1)).join(',')).join('L') + 'Z';
    const [w, h] = this.proj(106, 5.3);
    this.full = {x:-20, y:-20, w:w + 40, h:h + 40};
    this.vb = {...this.full};
    let grid = '';
    for (let lo = 98; lo <= 105; lo++) { const [x] = this.proj(lo, 0); grid += `<line x1="${x}" y1="-50" x2="${x}" y2="${h + 50}"/>`; }
    for (let la = 6; la <= 20; la += 2) { const [, y] = this.proj(0, la); grid += `<line x1="-50" y1="${y}" x2="${w + 50}" y2="${y}"/>`; }
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="แผนที่ประเทศไทย (แผนที่สาธิต)">
      <defs>
        <radialGradient id="sea" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1b2c6b"/><stop offset="1" stop-color="#0b1236"/></radialGradient>
        <linearGradient id="landGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f6f5c"/><stop offset=".55" stop-color="#35536e"/><stop offset="1" stop-color="#3a3f7a"/></linearGradient>
      </defs>
      <rect x="-2000" y="-2000" width="5000" height="6000" fill="url(#sea)"/>
      <g stroke="rgba(191,230,247,.07)" stroke-width="1" vector-effect="non-scaling-stroke">${grid}</g>
      <path class="land" d="${d}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <g id="dm-near"></g><g id="dm-pins"></g><g id="dm-sel"></g>
    </svg>`;
    this.svg = $('svg', el);
    this.applyVB();
    this.bind();
    MapUI.notice('แผนที่สาธิต · พิกัดโดยประมาณ · แตะหมุดหรือแตะบนแผนที่เพื่อปักหมุด');
  },
  applyVB() {
    const v = this.vb; this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    this.drawPins();
  },
  scale() { const r = this.svg.getBoundingClientRect(); return Math.max(this.vb.w / (r.width || 600), this.vb.h / (r.height || 500)); },
  drawPins() {
    const s = this.scale(), r = 6 * s, fs = 12 * s;
    const showLabels = this.vb.w < this.full.w * 0.35;
    $('#dm-pins', this.svg).innerHTML = PLACES.map(p => {
      const [x, y] = this.proj(p.lng, p.lat), sel = S.place && S.place.id === p.id;
      return `<g class="pin${sel ? ' sel' : ''}" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name + ' ' + p.province)}">
        <circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="transparent"/>
        <circle class="dot" cx="${x}" cy="${y}" r="${r}" stroke-width="${1.6 * s}"/>
        ${showLabels || sel ? `<text x="${x + r * 1.6}" y="${y + fs * .35}" font-size="${fs}" stroke-width="${3 * s}">${esc(p.name)}</text>` : ''}
      </g>`;
    }).join('');
    const sg = $('#dm-sel', this.svg);
    if (S.place && !PLACE_BY_ID[S.place.id]) {
      const [x, y] = this.proj(S.place.lng, S.place.lat);
      sg.innerHTML = `<g class="pin sel"><circle class="halo" cx="${x}" cy="${y}" r="${r * 1.6}"/><circle class="dot" cx="${x}" cy="${y}" r="${r}" stroke-width="${1.6 * s}"/><text x="${x + r * 1.6}" y="${y + fs * .35}" font-size="${fs}" stroke-width="${3 * s}">${esc(S.place.name)}</text></g>`;
    } else if (S.place) {
      const [x, y] = this.proj(S.place.lng, S.place.lat);
      sg.innerHTML = `<circle class="halo" cx="${x}" cy="${y}" r="${r * 1.6}" style="fill:rgba(242,208,116,.35);pointer-events:none"/>`;
    } else sg.innerHTML = '';
  },
  zoomAt(f, cx, cy) {
    const v = this.vb, nw = Math.min(this.full.w * 1.2, Math.max(this.full.w / 80, v.w * f)), k = nw / v.w;
    if (cx == null) { cx = v.x + v.w / 2; cy = v.y + v.h / 2; }
    this.vb = {x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: v.w * k, h: v.h * k};
    this.applyVB();
  },
  flyTo(lng, lat, w) {
    const [x, y] = this.proj(lng, lat), r = this.svg.getBoundingClientRect(), ar = (r.height || 500) / (r.width || 600);
    const from = {...this.vb}, to = {w, h: w * ar, x: x - w / 2, y: y - (w * ar) / 2};
    if (REDUCED) { this.vb = to; return this.applyVB(); }
    const t0 = performance.now(), D = 700;
    const step = now => { const t = Math.min(1, (now - t0) / D), e = 1 - (1 - t) ** 3;
      this.vb = {x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e};
      this.applyVB(); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },
  toSvg(cx, cy) { const pt = this.svg.createSVGPoint(); pt.x = cx; pt.y = cy; const m = this.svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : {x:0, y:0}; },
  inside([x, y]) { let c = false; const p = this.poly; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; },
  bind() {
    const el = this.el, ptrs = new Map(); let moved = 0, start = null, pinch = null;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); moved = 0; start = {x:e.clientX, y:e.clientY, vb:{...this.vb}}; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), vb:{...this.vb}}; } });
    el.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), c = this.toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.vb = {...pinch.vb}; this.zoomAt(pinch.d / Math.max(d, 1), c.x, c.y); moved = 99; return;
      }
      const s = this.scale(), dx = e.clientX - start.x, dy = e.clientY - start.y;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 4) { el.classList.add('dragging'); this.vb = {...start.vb, x: start.vb.x - dx * s, y: start.vb.y - dy * s}; this.applyVB(); }
    });
    const up = e => {
      ptrs.delete(e.pointerId); el.classList.remove('dragging');
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0 && moved <= 4 && e.type === 'pointerup') this.tap(e);
      if (ptrs.size === 1) { const [p] = [...ptrs.values()]; start = {x:p.x, y:p.y, vb:{...this.vb}}; }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); const c = this.toSvg(e.clientX, e.clientY); this.zoomAt(e.deltaY > 0 ? 1.18 : 1 / 1.18, c.x, c.y); }, {passive:false});
    el.addEventListener('keydown', e => { const g = e.target.closest('.pin[data-id]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); MapUI.pick({...PLACE_BY_ID[g.dataset.id], source:'preset'}, true); } });
    $('#map-tools').addEventListener('click', e => { const z = e.target.closest('[data-zoom]')?.dataset.zoom; if (!z || MapUI.impl !== this) return; if (z === 'in') this.zoomAt(1 / 1.6); else if (z === 'out') this.zoomAt(1.6); else { this.vb = {...this.full}; this.applyVB(); } });
    new ResizeObserver(() => this.drawPins()).observe(el);
  },
  tap(e) {
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.pin[data-id]');
    if (hit) return MapUI.pick({...PLACE_BY_ID[hit.dataset.id], source:'preset'}, true);
    const p = this.toSvg(e.clientX, e.clientY);
    if (!this.inside([p.x, p.y])) { MapUI.notice('กรุณาเลือกจุดภายในประเทศไทย'); return; }
    const ll = this.unproj(p.x, p.y), near = PLACES.slice().sort((a, b) => km(ll, a) - km(ll, b))[0];
    MapUI.pick({id:'custom-' + ll.lat.toFixed(4) + '_' + ll.lng.toFixed(4), name:'จุดที่ปักหมุดบนแผนที่', province: near.province + ' (โดยประมาณ)', detail:`ใกล้ ${near.name} ประมาณ ${fmtKm(km(ll, near))}`, lat:ll.lat, lng:ll.lng, source:'pin'}, false);
  },
  select(p, fly) { this.drawPins(); if (fly) this.flyTo(p.lng, p.lat, p.province.startsWith('กรุงเทพ') ? 14 : 60); },
  async nearby(p) { return PLACES.filter(x => x.id !== p.id).sort((a, b) => km(p, a) - km(p, b)).slice(0, 6).map(x => ({...x, source:'preset'})); },
  refresh() { this.drawPins(); }
};

/* --------------------------------------------------------------- google map */
const GMap = {
  map:null, markers:[], sel:null, near:[], lib:{},
  load() {
    return new Promise((res, rej) => {
      if (window.google?.maps?.importLibrary) return res();
      window.__lkGmapsReady = () => res();
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({key:CFG.GOOGLE_MAPS_API_KEY, v:'weekly', libraries:'places,marker', language:'th', region:'TH', loading:'async', callback:'__lkGmapsReady'});
      s.async = true; s.onerror = () => rej(new Error('script load failed'));
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('timeout')), 15000);
    });
  },
  async init(el) {
    await this.load();
    const [{Map}, places, marker] = await Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('places'), google.maps.importLibrary('marker').catch(() => ({}))]);
    this.lib = {places, marker};
    this.map = new Map(el, {center:{lat:13.6, lng:100.9}, zoom:5.7, mapId: CFG.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID', disableDefaultUI:true, zoomControl:false, gestureHandling:'greedy', clickableIcons:true,
      restriction:{latLngBounds:{north:21.5, south:4.8, west:96.5, east:106.5}, strictBounds:false}});
    PLACES.forEach(p => this.markers.push(this.addMarker(p, false, () => MapUI.pick({...p, source:'preset'}, true))));
    this.map.addListener('click', async ev => {
      if (ev.placeId) { ev.stop && ev.stop(); const pl = new places.Place({id: ev.placeId}); MapUI.pick(await this.fromPlace(pl), true); return; }
      const ll = ev.latLng.toJSON();
      MapUI.pick({id:'pin-' + ll.lat.toFixed(5) + '_' + ll.lng.toFixed(5), name:'จุดที่ปักหมุดบนแผนที่', province: await this.reverseProvince(ll), lat:ll.lat, lng:ll.lng, source:'pin'}, false);
    });
    $('#map-tools').addEventListener('click', e => { const z = e.target.closest('[data-zoom]')?.dataset.zoom; if (!z || MapUI.impl !== this) return;
      if (z === 'in') this.map.setZoom(this.map.getZoom() + 1); else if (z === 'out') this.map.setZoom(this.map.getZoom() - 1); else { this.map.setCenter({lat:13.6, lng:100.9}); this.map.setZoom(5.7); } });
    // New Places Autocomplete widget; the demo input is hidden.
    if (places.PlaceAutocompleteElement) {
      const ac = new places.PlaceAutocompleteElement({includedRegionCodes:['th']});
      ac.setAttribute('placeholder', 'ค้นหาสถานที่ในประเทศไทย');
      const slot = $('#gmp-ac-slot'); slot.appendChild(ac); slot.hidden = false; $('#place-q').hidden = true;
      const handle = async place => { if (place) MapUI.pick(await this.fromPlace(place), true); };
      ac.addEventListener('gmp-select', ({placePrediction}) => handle(placePrediction?.toPlace()));
      ac.addEventListener('gmp-placeselect', ({place}) => handle(place));
    }
    MapUI.notice('');
  },
  addMarker(p, selected, onClick) {
    const pos = {lat:p.lat, lng:p.lng};
    const {AdvancedMarkerElement, PinElement} = this.lib.marker || {};
    let m;
    if (AdvancedMarkerElement && PinElement) {
      const pin = new PinElement({background: selected ? '#f2d074' : '#f4a9cb', borderColor:'#ffffff', glyphColor: selected ? '#2a1b52' : '#5b3d93', scale: selected ? 1.25 : .9});
      m = new AdvancedMarkerElement({map:this.map, position:pos, title:p.name, content:pin.element, gmpClickable:true});
      onClick && m.addListener('click', onClick);
    } else {
      m = new google.maps.Marker({map:this.map, position:pos, title:p.name});
      onClick && m.addListener('click', onClick);
    }
    return m;
  },
  clear(m) { if (!m) return; if ('map' in m) m.map = null; if (m.setMap) m.setMap(null); },
  province(comps) { const c = (comps || []).find(c => (c.types || []).includes('administrative_area_level_1')); return c ? (c.longText || c.long_name || '') : ''; },
  async fromPlace(place) {
    await place.fetchFields({fields:['id','displayName','formattedAddress','location','addressComponents','editorialSummary']});
    const loc = place.location.toJSON ? place.location.toJSON() : {lat:place.location.lat(), lng:place.location.lng()};
    return {id:'g-' + place.id, placeId:place.id, name:place.displayName || 'สถานที่', province:this.province(place.addressComponents), address:place.formattedAddress || '', detail:place.editorialSummary || place.formattedAddress || '', lat:loc.lat, lng:loc.lng, source:'google'};
  },
  async resolvePreset(p) {
    const {Place} = this.lib.places; if (!Place?.searchByText) return null;
    const {places} = await Place.searchByText({textQuery:`${p.name} ${p.province}`, fields:['id','displayName','formattedAddress','location','addressComponents','editorialSummary'], locationBias:{lat:p.lat, lng:p.lng}, maxResultCount:1, language:'th', region:'th'});
    if (!places?.length) return null;
    const r = await this.fromPlace(places[0]);
    return {...r, name: p.name, detail: p.detail || r.detail, province: r.province || p.province, id:p.id};
  },
  async reverseProvince(ll) {
    try { const {results} = await new google.maps.Geocoder().geocode({location:ll, language:'th'}); for (const r of results) { const v = this.province(r.address_components); if (v) return v; } } catch {}
    return '';
  },
  select(p, fly) {
    this.clear(this.sel);
    this.sel = this.addMarker(p, true);
    if (fly) { this.map.panTo({lat:p.lat, lng:p.lng}); this.map.setZoom(Math.max(this.map.getZoom(), 14)); }
  },
  async nearby(p) {
    const {Place} = this.lib.places;
    const {places} = await Place.searchNearby({fields:['id','displayName','formattedAddress','location','addressComponents'], locationRestriction:{center:{lat:p.lat, lng:p.lng}, radius:8000}, includedTypes:['tourist_attraction','park'], maxResultCount:8, language:'th', region:'th'});
    return (places || []).filter(x => x.id !== p.placeId).map(x => { const l = x.location.toJSON(); return {id:'g-' + x.id, placeId:x.id, name:x.displayName, province:this.province(x.addressComponents), address:x.formattedAddress, detail:x.formattedAddress, lat:l.lat, lng:l.lng, source:'google'}; });
  },
  showNearby(list) { this.near.forEach(m => this.clear(m)); this.near = list.map(p => this.addMarker(p, false, () => MapUI.pick(p, true))); },
  refresh() {}
};

$('#step-3 [data-action=next]').addEventListener('click', e => { e.stopPropagation(); if (!S.place) { $('#e-place').textContent = 'กรุณาเลือกสถานที่ลอยกระทงก่อน'; return; } goStep(4); }, true);
$('#step-2 [data-action=next]').addEventListener('click', e => { e.stopPropagation(); if (!S.krathong) { $('#e-kt').textContent = 'กรุณาเลือกกระทง 1 แบบ'; return; } goStep(3); }, true);

/* ================================================================ CONFIRM */
const Confirm = {
  render() {
    const k = KT[S.krathong], f = S.form;
    $('#cf-img').src = k.img; $('#cf-img').alt = k.name;
    const row = (l, v, step, cls = '') => `<dt>${l}</dt><dd class="${cls}">${v}<button type="button" class="edit" data-edit="${step}" aria-label="แก้ไข${l}">แก้ไข</button></dd>`;
    $('#summary').innerHTML =
      row('ชื่อจริง', esc(clean(f.realName)) || '<span class="muted">ไม่ระบุ</span>', 1) +
      row('ชื่อเล่น', esc(clean(f.nickname)), 1) +
      row('คำอธิษฐาน', esc(clean(f.wish)), 1, 'wish') +
      row('กระทง', esc(k.name), 2) +
      row('สถานที่', `${esc(S.place.name)}<br><small class="muted">${esc(S.place.province || '')} · ${S.place.lat.toFixed(4)}, ${S.place.lng.toFixed(4)}</small>`, 3) +
      row('การเผยแพร่', f.isPublic ? 'แสดงในหน้ากระทงบนสายน้ำ (ชื่อเล่น)' : 'ส่วนตัว', 1);
    $('#e-submit').textContent = '';
  }
};
$('#summary').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) goStep(+b.dataset.edit); });

/* ================================================================ RELEASE */
const Release = {
  busy:false, last:null,
  async go() {
    if (this.busy) return;
    const btn = $('#btn-release'), err = $('#e-submit');
    if (!validateForm(false) || !S.krathong || !S.place) { err.textContent = 'ข้อมูลยังไม่ครบ กรุณาตรวจสอบอีกครั้ง'; return; }
    const lastAt = store_.get('lk.lastRelease') || 0, wait = COOLDOWN_MS - (Date.now() - lastAt);
    if (wait > 0) { err.textContent = `กรุณารอ ${Math.ceil(wait / 1000)} วินาที ก่อนปล่อยกระทงใบถัดไป`; return; }
    const f = S.form, wish = clean(f.wish), nick = clean(f.nickname);
    const wishHash = hash(nick.toLowerCase() + '|' + wish.toLowerCase());
    const recent = store_.get('lk.recentHashes') || [];
    if (recent.some(r => r.h === wishHash && Date.now() - r.t < 864e5)) { err.textContent = 'คุณเพิ่งปล่อยกระทงพร้อมคำอธิษฐานนี้ไปแล้ววันนี้ ลองเขียนคำอธิษฐานใหม่'; return; }
    this.busy = true; btn.disabled = true; btn.classList.add('loading'); err.textContent = '';
    await storeReady;
    const rec = {
      id: uuid(), clientId: S.clientId, realName: clean(f.realName), nickname: nick, wish, krathong: S.krathong,
      placeName: S.place.name, placeId: S.place.placeId, province: S.place.province, address: S.place.address || '', lat: S.place.lat, lng: S.place.lng,
      isPublic: !!f.isPublic, status: 'released', createdAt: new Date().toISOString(), wishHash, fingerprint: deviceId()
    };
    this.last = rec;
    show('float');
    const saving = this.save(rec);
    await Anim.play(KT[rec.krathong], rec);
    const ok = await saving;
    this.finish(rec, ok);
    btn.disabled = false; btn.classList.remove('loading');
  },
  async save(rec) {
    $('#float-status').textContent = 'กำลังปล่อยกระทง…';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await Store.save(rec);
        store_.set('lk.lastRelease', Date.now());
        const recent = (store_.get('lk.recentHashes') || []).filter(x => Date.now() - x.t < 864e5); recent.push({h: rec.wishHash, t: Date.now()}); store_.set('lk.recentHashes', recent.slice(-30));
        Gallery.dirty = true;
        return {ok:true, status:r.status || 'released'};
      } catch (e) {
        const code = e?.code;
        if (code === 'P0001') return {ok:false, msg: e.message || 'ระบบป้องกันสแปมปฏิเสธรายการนี้', fatal:true};
        if (code === 'quota_exceeded') return {ok:false, msg:'พื้นที่จัดเก็บเต็ม กรุณาแจ้งผู้ดูแลระบบ', fatal:true};
        if (code === 'invalid_argument') return {ok:false, msg:'บัญชีของคุณไม่มีสิทธิ์บันทึกข้อมูลในหน้านี้', fatal:true};
        if (attempt === 0) { await sleep(600 + Math.random() * 600); continue; }
      }
    }
    return {ok:false, msg:'บันทึกข้อมูลไม่สำเร็จ'};
  },
  finish(rec, res) {
    const box = $('#float-result');
    $('#fr-place').textContent = `ณ ${rec.placeName}${rec.province ? ' · ' + rec.province : ''}`;
    $('#fr-wish').textContent = `“${rec.wish}”`;
    const note = $('#fr-note'); note.className = 'fr-note'; note.innerHTML = '';
    if (res.ok) {
      note.textContent = res.status === 'pending_review' ? 'คำอธิษฐานของคุณอยู่ระหว่างตรวจสอบก่อนแสดงต่อสาธารณะ'
        : rec.isPublic ? 'บันทึกแล้ว · คำอธิษฐานของคุณแสดงอยู่ในหน้ากระทงบนสายน้ำ' : 'บันทึกแล้ว · คำอธิษฐานนี้เป็นส่วนตัว';
      const keep = {realName:S.form.realName, nickname:S.form.nickname, isPublic:S.form.isPublic};
      S = blank(); S.form = {...S.form, ...keep}; persist(); fillForm(); KtPicker.rendered && KtPicker.sync();
      $('#place-card').innerHTML = '<p class="muted">ยังไม่ได้เลือกสถานที่</p>'; $('#place-preview').hidden = true; $('#nearby-list').innerHTML = ''; $('#btn-nearby').disabled = true;
      $$('#preset-chips .chip').forEach(c => c.setAttribute('aria-pressed','false'));
      MapUI.impl?.refresh?.();
    } else {
      note.classList.add('bad');
      note.textContent = `${res.msg} — กระทงลอยแล้ว แต่ยังไม่ถูกบันทึก `;
      if (!res.fatal) { const b = document.createElement('button'); b.type = 'button'; b.className = 'link-btn'; b.textContent = 'ลองบันทึกอีกครั้ง'; b.onclick = async () => { b.disabled = true; b.textContent = 'กำลังบันทึก…'; this.finish(rec, await this.save(rec)); }; note.appendChild(b); }
    }
    box.hidden = false; $('#skip-anim').hidden = true; $('#float-status').textContent = '';
    $('#float-title').focus({preventScroll:true});
    this.busy = false;
  }
};
function deviceId() { let d = store_.get('lk.device'); if (!d) { d = uuid(); store_.set('lk.device', d); } return d; }
$('#btn-release').addEventListener('click', () => Release.go());

/* ============================================================= ANIMATION */
const Anim = {
  cv:$('#river'), ctx:null, raf:0, running:false, imgs:{}, resolve:null, t0:0, skip:false, bg:[],
  async img(src) { if (this.imgs[src]) return this.imgs[src]; const im = new Image(); im.src = src; try { await im.decode(); } catch {} this.imgs[src] = im; return im; },
  size() { const d = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight; this.cv.width = w * d; this.cv.height = h * d; this.ctx.setTransform(d, 0, 0, d, 0, 0); this.W = w; this.H = h; this.makeStatic(); },
  makeStatic() {
    const W = this.W, H = this.H, hz = this.hz = H * 0.44;
    this.moon = {x: W * (W > H ? .62 : .5), y: H * .17, r: Math.min(W, H) * (W > H ? .09 : .13)};
    const rnd = mulberry(7);
    this.stars = Array.from({length: Math.round(W * H / 9000)}, () => ({x: rnd() * W, y: rnd() * hz * .92, r: rnd() * 1.2 + .2, p: rnd() * 6}));
    this.ripples = Array.from({length: 70}, () => ({y: rnd(), x: rnd(), w: rnd() * .25 + .05, p: rnd() * 6}));
  },
  async play(k, rec) {
    this.ctx = this.cv.getContext('2d');
    this.k = k; this.kimg = await this.img(k.img); this.skip = false; this.parts = []; this.rings = [];
    const others = (await Gallery.items().catch(() => [])).slice(0, 7);
    this.bg = await Promise.all(Array.from({length: 7}, async (_, i) => ({img: await this.img(KT[others[i]?.krathong]?.img || KRATHONGS[i % 5].img), d: .25 + i * .1 + Math.random() * .05, x: Math.random(), sp: .004 + Math.random() * .006, ph: Math.random() * 6})));
    this.size(); this._r = () => this.size(); addEventListener('resize', this._r);
    $('#float-result').hidden = true; $('#skip-anim').hidden = false;
    this.D = REDUCED ? 0 : 9000; this.t0 = performance.now(); this.running = true;
    return new Promise(res => {
      this.resolve = res;
      if (REDUCED) { this.frame(this.t0 + 6000, true); setTimeout(() => this.done(), 700); return; }
      const loop = now => { if (!this.running) return; this.frame(now); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    });
  },
  done() { if (this.resolve) { const r = this.resolve; this.resolve = null; r(); } },
  stop() { this.running = false; cancelAnimationFrame(this.raf); removeEventListener('resize', this._r); this.done(); },
  frame(now, still) {
    const c = this.ctx, W = this.W, H = this.H, hz = this.hz, t = (now - this.t0) / 1000;
    let p = this.skip ? 1 : Math.min(1, (now - this.t0) / 9000);
    if (still) p = .45;
    if (p >= .8 && this.resolve && !still) this.done();
    // sky
    let g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#07082a'); g.addColorStop(.55, '#1d1652'); g.addColorStop(1, '#4b3a80');
    c.fillStyle = g; c.fillRect(0, 0, W, hz + 1);
    for (const s of this.stars) { c.globalAlpha = .35 + .65 * Math.abs(Math.sin(t * .8 + s.p)); c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    const m = this.moon;
    g = c.createRadialGradient(m.x, m.y, m.r * .6, m.x, m.y, m.r * 4.2); g.addColorStop(0, 'rgba(255,240,170,.55)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, hz);
    g = c.createRadialGradient(m.x - m.r * .3, m.y - m.r * .3, m.r * .1, m.x, m.y, m.r); g.addColorStop(0, '#fffbe0'); g.addColorStop(1, '#f6e48d');
    c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, m.r, 0, 7); c.fill();
    this.skyline(c, W, hz);
    // water
    g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#2a2466'); g.addColorStop(.25, '#151646'); g.addColorStop(1, '#060821');
    c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
    // moon reflection column
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let y = hz + 2; y < H; y += 5) {
      const d = (y - hz) / (H - hz), wv = Math.sin(y * .09 + t * 2.2) * 6 + Math.sin(y * .031 - t * 1.3) * 10;
      const half = m.r * (.55 + d * 1.6) * (.6 + .4 * Math.abs(Math.sin(y * .05 + t)));
      c.fillStyle = `rgba(255,236,160,${.30 * (1 - d * .75)})`;
      c.fillRect(m.x - half + wv, y, half * 2, 1.6 + d * 2);
    }
    c.restore();
    // ripples
    c.strokeStyle = 'rgba(191,230,247,.10)'; c.lineWidth = 1;
    for (const r of this.ripples) { const y = hz + (r.y ** 1.7) * (H - hz), x = ((r.x + t * .01 * (1 + r.y)) % 1.2 - .1) * W, w = r.w * W * (.3 + r.y); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y + Math.sin(t + r.p) * 1.5, x + w, y); c.stroke(); }
    // distant krathongs
    for (const b of this.bg) {
      const d = b.d, y = hz + (H - hz) * (.05 + d * .42), s = (14 + d * 60) * (H / 800), x = ((b.x + t * b.sp) % 1.1 - .05) * W;
      this.drawKrathong(c, b.img, x, y + Math.sin(t * 1.4 + b.ph) * 1.5, s, .55 + d * .3, t + b.ph, null);
    }
    // main krathong path (perspective drift toward the moon's column)
    const e = easeInOut(p), start = {x: W * .5, y: H * .9}, end = {x: m.x + W * .03, y: hz + (H - hz) * .06};
    const x = start.x + (end.x - start.x) * e + Math.sin(e * 3.2) * W * .05, y = start.y + (end.y - start.y) * e;
    const scale = 1 - e * .9, base = Math.min(W * .42, H * .34, 330), s = base * scale;
    const enter = Math.min(1, t / 1.1), bob = Math.sin(t * 1.7) * 3.2 * scale, rot = Math.sin(t * 1.1) * .045;
    if (!still && t < 1.4 && this.rings.length < 4 && Math.random() < .2) this.rings.push({x, y, r: s * .4, a: .55});
    if (!still && Math.random() < .05) this.rings.push({x, y, r: s * .35, a: .3});
    c.save(); c.globalCompositeOperation = 'lighter';
    this.rings = this.rings.filter(r => (r.r += 1.2 + s * .004, r.a -= .006) > 0);
    for (const r of this.rings) { c.strokeStyle = `rgba(242,208,116,${r.a})`; c.lineWidth = 1.4; c.beginPath(); c.ellipse(r.x, r.y, r.r, r.r * .22, 0, 0, 7); c.stroke(); }
    c.restore();
    c.globalAlpha = enter;
    this.drawKrathong(c, this.kimg, x, y + bob - (1 - enter) * 30, s, 1, t, rot, this.k);
    c.globalAlpha = 1;
    // sparkles
    if (!still) for (let i = 0; i < 2; i++) this.parts.push({x: x + (Math.random() - .5) * s * 1.2, y: y - Math.random() * s * .6, vx: (Math.random() - .5) * .3, vy: -.25 - Math.random() * .5, l: 1, r: Math.random() * 2 + .6});
    else for (let i = 0; i < 40; i++) this.parts.push({x: x + (Math.random() - .5) * s * 1.6, y: y - Math.random() * s, vx: 0, vy: 0, l: Math.random(), r: Math.random() * 2 + .6});
    c.save(); c.globalCompositeOperation = 'lighter';
    this.parts = this.parts.filter(q => (q.x += q.vx, q.y += q.vy, q.l -= .008) > 0);
    for (const q of this.parts) { c.fillStyle = `rgba(255,226,140,${q.l * .9})`; c.beginPath(); c.arc(q.x, q.y, q.r * q.l + .3, 0, 7); c.fill(); }
    c.restore();
    // vignette
    g = c.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .3, W / 2, H * .55, Math.max(W, H) * .8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(3,2,16,.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (p >= 1 && !this.resolve) { /* keep idling with the scene */ }
  },
  drawKrathong(c, im, x, y, w, alpha, t, rot, k) {
    if (!im || !im.naturalWidth) return;
    const h = w * im.naturalHeight / im.naturalWidth, a0 = c.globalAlpha;
    // reflection, drawn in strips with a wave offset
    c.save(); c.globalAlpha = a0 * alpha * .28; c.translate(x, y); c.scale(1, -.55);
    const strips = 10, sh = im.naturalHeight / strips;
    for (let i = 0; i < strips; i++) { const off = Math.sin(t * 3 + i * .7) * w * .015 * (strips - i) / strips; c.drawImage(im, 0, im.naturalHeight - (i + 1) * sh, im.naturalWidth, sh, -w / 2 + off, i * h / strips, w, h / strips + 1); }
    c.restore();
    // body
    c.save(); c.globalAlpha = a0 * alpha; c.translate(x, y); if (rot) c.rotate(rot);
    c.drawImage(im, -w / 2, -h * .96, w, h);
    const fl = k?.flame || [.5, .1], fx = -w / 2 + w * fl[0], fy = -h * .96 + h * fl[1];
    if (k?.drawCandle) { c.fillStyle = '#fff3d6'; c.fillRect(fx - w * .018, fy, w * .036, h * .2); }
    // candle glow + flicker
    const fk = .85 + .15 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1), R = Math.max(10, w * .22) * fk;
    c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(fx, fy, 0, fx, fy, R); g.addColorStop(0, `rgba(255,220,130,${.75 * alpha})`); g.addColorStop(.35, `rgba(255,170,60,${.25 * alpha})`); g.addColorStop(1, 'rgba(255,150,40,0)');
    c.fillStyle = g; c.beginPath(); c.arc(fx, fy, R, 0, 7); c.fill();
    if (k?.drawCandle) { c.fillStyle = `rgba(255,214,110,${alpha})`; c.beginPath(); c.ellipse(fx, fy - w * .02, w * .014 * fk, w * .035 * fk, 0, 0, 7); c.fill(); }
    c.restore();
    // glow reflection on water
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(x, y + h * .12, 0, x, y + h * .12, w * .5); gr.addColorStop(0, `rgba(255,200,100,${.22 * alpha})`); gr.addColorStop(1, 'rgba(255,200,100,0)');
    c.fillStyle = gr; c.beginPath(); c.ellipse(x, y + h * .14, w * .5, h * .22, 0, 0, 7); c.fill(); c.restore();
  },
  skyline(c, W, hz) {
    c.fillStyle = '#120d33';
    c.beginPath(); c.moveTo(0, hz);
    const u = W / 100, bump = (x0, w, hgt) => { c.lineTo(x0, hz); c.quadraticCurveTo(x0 + w / 2, hz - hgt * 2, x0 + w, hz); };
    bump(0, 14 * u, 2.6 * u); bump(14 * u, 10 * u, 1.8 * u);
    // bell-shaped chedi
    const chedi = (cx, s) => { c.lineTo(cx - 5 * s, hz); c.lineTo(cx - 5 * s, hz - 2 * s); c.quadraticCurveTo(cx - 5 * s, hz - 8 * s, cx - 1 * s, hz - 9 * s); c.lineTo(cx - .4 * s, hz - 16 * s); c.lineTo(cx, hz - 20 * s); c.lineTo(cx + .4 * s, hz - 16 * s); c.lineTo(cx + 1 * s, hz - 9 * s); c.quadraticCurveTo(cx + 5 * s, hz - 8 * s, cx + 5 * s, hz - 2 * s); c.lineTo(cx + 5 * s, hz); };
    const prang = (cx, s) => { c.lineTo(cx - 3 * s, hz); c.lineTo(cx - 3 * s, hz - 4 * s); c.quadraticCurveTo(cx - 2.6 * s, hz - 14 * s, cx - .3 * s, hz - 18 * s); c.lineTo(cx, hz - 22 * s); c.lineTo(cx + .3 * s, hz - 18 * s); c.quadraticCurveTo(cx + 2.6 * s, hz - 14 * s, cx + 3 * s, hz - 4 * s); c.lineTo(cx + 3 * s, hz); };
    chedi(30 * u, .9 * u); bump(36 * u, 8 * u, 1.5 * u); prang(48 * u, .7 * u); chedi(82 * u, .75 * u); bump(88 * u, 12 * u, 2.2 * u);
    c.lineTo(W, hz); c.lineTo(W, hz + 1); c.lineTo(0, hz + 1); c.closePath(); c.fill();
    // small lights along the bank
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) { const lx = (i * 37 % 100) / 100 * W, a = .35 + .3 * Math.sin(performance.now() / 600 + i); c.fillStyle = `rgba(255,200,120,${a})`; c.fillRect(lx, hz - 2, 2, 2); }
    c.restore();
  }
};
function easeInOut(x) { return x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
$('#skip-anim').addEventListener('click', () => { Anim.skip = true; Anim.done(); });

/* ================================================================= GALLERY */
const Gallery = {
  all:[], shown:0, PAGE:24, dirty:true, unsub:null, serverOffset:0, total:null, loading:false,
  async items() { await storeReady; if (Store.name === 'supabase') { const r = await Store.list({limit:12}); return r.items; } return Store.list(); },
  async open() {
    $('#gal-title').focus({preventScroll:true});
    await storeReady;
    if (Store.name === 'claude') { if (Store.loaded || Store.lastErr) this.fromCache(); else this.skeleton(); return; }
    if (this.dirty) this.reload();
  },
  skeleton() { $('#gal-grid').innerHTML = Array.from({length:6}, () => '<div class="skel"></div>').join(''); $('#gal-state').textContent = ''; $('#gal-more').hidden = true; },
  async fromCache() {
    if (Store.lastErr && !Store.loaded) { $('#gal-grid').innerHTML = ''; $('#gal-state').innerHTML = Store.lastErr === 'timeout' ? 'ยังเชื่อมต่อฐานข้อมูลไม่ได้ กำลังลองใหม่…' : 'โหลดข้อมูลไม่สำเร็จ'; return; }
    this.all = await Store.list(); this.dirty = false; this.provinces(); this.paint(true); updateCounts();
  },
  async reload() {
    if (this.loading) return; this.loading = true; this.skeleton();
    try {
      if (Store.name === 'supabase') {
        const r = await Store.list({q:$('#gal-q').value.trim(), province:$('#gal-prov').value, offset:0, limit:this.PAGE});
        this.all = r.items; this.total = r.total; this.serverOffset = r.items.length;
        if (!this.provLoaded) { this.provLoaded = true; Store.provinces().then(ps => this.fillProv(ps)); }
      } else { this.all = await Store.list(); this.provinces(); }
      this.dirty = false; this.paint(true); updateCounts();
    } catch (e) { $('#gal-grid').innerHTML = ''; $('#gal-state').innerHTML = 'โหลดข้อมูลไม่สำเร็จ <button type="button" class="link-btn" id="gal-retry">ลองอีกครั้ง</button>'; }
    this.loading = false;
  },
  provinces() { this.fillProv([...new Set(this.all.map(r => r.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))); },
  fillProv(list) { const sel = $('#gal-prov'), v = sel.value; sel.innerHTML = '<option value="">ทุกจังหวัด</option>' + list.map(p => `<option>${esc(p)}</option>`).join(''); sel.value = list.includes(v) ? v : ''; },
  filtered() {
    if (Store.name === 'supabase') return this.all;
    const q = $('#gal-q').value.trim().toLowerCase(), pv = $('#gal-prov').value;
    return this.all.filter(r => (!pv || r.province === pv) && (!q || [r.nickname, r.wish, r.placeName].some(s => String(s || '').toLowerCase().includes(q))));
  },
  paint(reset) {
    const list = this.filtered();
    if (reset) this.shown = 0;
    const n = Store.name === 'supabase' ? list.length : Math.min(list.length, this.shown + this.PAGE);
    this.shown = n;
    $('#gal-grid').innerHTML = list.slice(0, n).map((r, i) => {
      const k = KT[r.krathong] || KRATHONGS[0];
      return `<button type="button" class="gcard" data-i="${i}">
        <span class="gk"><img src="${k.img}" alt="${esc(k.name)}" loading="lazy"></span>
        <span class="gn">${esc(r.nickname)}${r.sample ? '<span class="sample">ตัวอย่าง</span>' : ''}</span>
        <span class="gw">${esc(r.wish)}</span>
        <span class="gm"><span>${esc(r.placeName)}</span><span>${esc(r.province || '')}</span><span>${esc(fmtDate(r.createdAt))}</span></span>
      </button>`;
    }).join('');
    $('#gal-state').textContent = list.length ? '' : (this.all.length ? 'ไม่พบกระทงที่ตรงกับการค้นหา' : 'ยังไม่มีกระทงบนสายน้ำ — มาเป็นคนแรกที่ลอยกระทงกัน');
    const more = Store.name === 'supabase' ? (this.total != null && this.all.length < this.total) : n < list.length;
    $('#gal-more').hidden = !more;
    const total = Store.name === 'supabase' ? this.total : list.length;
    $('#gal-stat').textContent = total ? `${total.toLocaleString('th-TH')} คำอธิษฐานที่เผยแพร่` : '';
  },
  async more() {
    if (Store.name !== 'supabase') return this.paint(false);
    const btn = $('#gal-more'); btn.classList.add('loading'); btn.disabled = true;
    try { const r = await Store.list({q:$('#gal-q').value.trim(), province:$('#gal-prov').value, offset:this.serverOffset, limit:this.PAGE}); this.all = this.all.concat(r.items); this.serverOffset += r.items.length; this.total = r.total; this.paint(false); } catch {}
    btn.classList.remove('loading'); btn.disabled = false;
  },
  detail(i) {
    const r = this.filtered()[i]; if (!r) return; const k = KT[r.krathong] || KRATHONGS[0];
    openDialog(`<img src="${k.img}" alt="${esc(k.name)}"><h3>${esc(r.nickname)}${r.sample ? ' <small class="muted">(ตัวอย่าง)</small>' : ''}</h3>
      <p class="dw">${esc(r.wish)}</p>
      <p><b>${esc(r.placeName)}</b>${r.province ? ' · ' + esc(r.province) : ''}<br><small>${esc(k.name)} · ${esc(fmtDate(r.createdAt))}</small></p>`);
  }
};
let qTimer;
$('#gal-q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => Store.name === 'supabase' ? Gallery.reload() : Gallery.paint(true), 300); });
$('#gal-prov').addEventListener('change', () => Store.name === 'supabase' ? Gallery.reload() : Gallery.paint(true));
$('#gal-refresh').addEventListener('click', () => Store.name === 'claude' ? Gallery.fromCache() : Gallery.reload());
$('#gal-more').addEventListener('click', () => Gallery.more());
$('#gal-grid').addEventListener('click', e => { const c = e.target.closest('.gcard'); if (c) Gallery.detail(+c.dataset.i); });
$('#gal-state').addEventListener('click', e => { if (e.target.id === 'gal-retry') Gallery.reload(); });

/* ================================================================= DIALOG */
const dlg = $('#dlg');
function openDialog(html) { $('#dlg-body').innerHTML = html; try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } }
dlg.addEventListener('click', e => {
  if (e.target === dlg) dlg.close();
  const pick = e.target.closest('[data-pick]'); if (pick) { e.preventDefault(); KtPicker.select(pick.dataset.pick); dlg.close(); }
});

/* =================================================================== HOME */
const Home = {
  cv:$('#home-sparkles'), raf:0, on:false, pts:[],
  slide:0, timer:0,
  go(i) {
    const sl = $$('#hero-slides .slide'), dots = $$('#hero-dots button');
    this.slide = (i + sl.length) % sl.length;
    sl.forEach((s, k) => s.classList.toggle('on', k === this.slide));
    dots.forEach((d, k) => { d.classList.toggle('on', k === this.slide); d.setAttribute('aria-pressed', k === this.slide); });
  },
  autoplay(on) { clearInterval(this.timer); if (on && !REDUCED) this.timer = setInterval(() => this.go(this.slide + 1), 6500); },
  toggle(on) {
    if (on === this.on) return; this.on = on;
    this.autoplay(on);
    if (!on || REDUCED) { cancelAnimationFrame(this.raf); return; }
    const c = this.cv.getContext('2d');
    const fit = () => { const r = this.cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); this.cv.width = r.width * d; this.cv.height = r.height * d; c.setTransform(d, 0, 0, d, 0, 0); this.w = r.width; this.h = r.height; };
    fit(); if (!this._fit) { this._fit = fit; addEventListener('resize', fit); }
    this.pts = Array.from({length: 34}, () => this.spawn(true));
    const loop = () => {
      if (!this.on) return;
      c.clearRect(0, 0, this.w, this.h); c.globalCompositeOperation = 'lighter';
      for (const p of this.pts) {
        p.y -= p.v; p.x += Math.sin(p.y * .02 + p.ph) * .25; p.l -= .0025;
        if (p.l <= 0 || p.y < -10) Object.assign(p, this.spawn());
        const a = Math.sin(Math.PI * p.l) * .8, g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255,230,150,${a})`); g.addColorStop(1, 'rgba(255,230,150,0)');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * 4, 0, 7); c.fill();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  spawn(init) { return {x: Math.random() * this.w, y: init ? Math.random() * this.h : this.h * (.6 + Math.random() * .45), v: .15 + Math.random() * .45, r: .8 + Math.random() * 1.8, l: init ? Math.random() : 1, ph: Math.random() * 6}; }
};
$('#hero-dots').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Home.go($$('#hero-dots button').indexOf(b)); Home.autoplay(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { Home.toggle(false); } else if (current === 'home') Home.toggle(true); });

/* ============================================================ GLOBAL CLICKS */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]'); if (!a) return;
  const act = a.dataset.action;
  if (act === 'start') { S.step = S.step || 1; nav('create'); }
  else if (act === 'home') { if (current === 'float') Anim.stop(); nav('home'); }
  else if (act === 'back') goStep(Math.max(1, S.step - 1));
  else if (act === 'next') { if (S.step === 1) $('#step-1').requestSubmit(); }
  else if (act === 'again') { Anim.stop(); S.step = 1; persist(); nav('create'); setTimeout(() => F.wish.focus(), 50); }
});

async function updateCounts() {
  await storeReady;
  let n = null;
  try {
    if (Store.name === 'claude') n = Store.loaded ? Store.count() : null;
    else if (Store.name === 'supabase') n = Gallery.total;
    else n = (await Store.list()).length;
  } catch {}
  const chip = $('#home-count'); if (n) { chip.hidden = false; chip.textContent = n.toLocaleString('th-TH'); } else chip.hidden = true;
}
function updateModeBadge() {
  const map = MapUI.impl === GMap ? 'Google Maps' : (USE_GOOGLE ? 'แผนที่สาธิต' : 'แผนที่สาธิต');
  const live = Store.name !== 'local';
  $('#mode-badge').textContent = `${live ? 'Live' : 'Demo Mode'} · ${map} · ${Store.label}`;
}

/* ==================================================================== BOOT */
fillForm();
storeReady.then(() => { updateModeBadge(); updateCounts(); if (Store.name === 'claude') Store.subscribe(() => { updateCounts(); if (current === 'gallery') Gallery.fromCache(); }); });
updateModeBadge();
route();
}
