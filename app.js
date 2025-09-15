/* app.js - enhanced mockup for leave system per request
   - Departments: วิชาการ, อำนวยการ, ท้องฟ้าจำลอง, ส่งเสริมและบริการ, อาคารและสถานที่
   - Positions: นศ.ฝึกงาน, ข้าราชการ, พนักงานราชการ, ลูกจ้างเหมาบริการ
   - Roles: employee, mentor, supervisor, hr (หัวหน้างานบุคลากร)
   - Attachment: stored as Data URL (small files OK)
*/

// Keys and constants
const KEY_USERS = 'ls_users_multi_v2';
const KEY_LEAVES = 'ls_leaves_multi_v2';
const DEPARTMENTS = ['วิชาการ','อำนวยการ','ท้องฟ้าจำลอง','ส่งเสริมและบริการ','อาคารและสถานที่'];

// Seed sample users (run once)
function seedData(){
  if(!localStorage.getItem(KEY_USERS)){
    const users = [
      {username:'alice', password:'pass', roles:['employee'], position:'พนักงานราชการ', dept:'ท้องฟ้าจำลอง'},
      {username:'bob', password:'pass', roles:['employee','intern'], position:'นศ.ฝึกงาน', dept:'วิชาการ', mentor:'mentor_lee', supervisor:'sup_acad'},
      {username:'mentor_lee', password:'pass', roles:['mentor','employee'], position:'พนักงานราชการ', dept:'วิชาการ'},
      {username:'sup_acad', password:'pass', roles:['supervisor','employee'], position:'ข้าราชการ', dept:'วิชาการ'},
      {username:'sup_tk', password:'pass', roles:['supervisor','employee'], position:'ข้าราชการ', dept:'ท้องฟ้าจำลอง'},
      {username:'hr_officer', password:'pass', roles:['hr'], position:'ข้าราชการ', dept:'อำนวยการ'},
      {username:'admin', password:'pass', roles:['hr','admin'], position:'ข้าราชการ', dept:'อำนวยการ'}
    ];
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }
  if(!localStorage.getItem(KEY_LEAVES)) localStorage.setItem(KEY_LEAVES, JSON.stringify([]));
}
document.addEventListener('DOMContentLoaded', seedData);

// Session helpers
function setCurrentUser(u){ sessionStorage.setItem('ls_user', JSON.stringify(u)); }
function getCurrentUser(){ return JSON.parse(sessionStorage.getItem('ls_user') || 'null'); }
function logout(){ sessionStorage.removeItem('ls_user'); location.href='index.html'; }

// Escape for safe HTML
function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// USERS: register
function registerSubmit(evt){
  evt && evt.preventDefault();
  const u = document.getElementById('reg_username').value.trim();
  const p = document.getElementById('reg_password').value.trim();
  const roles = Array.from(document.getElementById('reg_roles').selectedOptions).map(o=>o.value);
  const dept = document.getElementById('reg_dept').value || '';
  const position = document.getElementById('reg_position').value || '';
  if(!u||!p||roles.length===0||!dept||!position){ alert('กรอกข้อมูลให้ครบ'); return; }
  const users = JSON.parse(localStorage.getItem(KEY_USERS)||'[]');
  if(users.find(x=>x.username===u)){ alert('มีผู้ใช้นี้แล้ว'); return; }
  users.push({username:u, password:p, roles, position, dept});
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
  document.getElementById('reg_msg').style.display='block';
  document.getElementById('reg_msg').innerText = 'สมัครเรียบร้อย ล็อกอินได้เลย';
  setTimeout(()=>location.href='index.html',1200);
}

// LOGIN
function loginSubmit(evt){
  evt && evt.preventDefault();
  const u = document.getElementById('login_username').value.trim();
  const p = document.getElementById('login_password').value.trim();
  const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  const found = users.find(x=>x.username===u && x.password===p);
  const errEl = document.getElementById('login_error');
  if(!found){
    if(errEl){ errEl.style.display='block'; errEl.innerText = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'; }
    return;
  }
  // login
  setCurrentUser(found);
  // redirect by role priority: hr > supervisor > mentor > employee
  if(found.roles.includes('hr')) location.href='admin-dashboard.html';
  else if(found.roles.includes('supervisor')) location.href='supervisor-dashboard.html';
  else if(found.roles.includes('mentor')) location.href='mentor-dashboard.html';
  else location.href='user-dashboard.html';
}

// ---------- Header render ----------
function renderHeader(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  const u = getCurrentUser();
  if(!u) { el.innerHTML = `<a href="index.html">ล็อกอิน</a>`; return; }
  el.innerHTML = `<div><span class="badge">${escapeHtml(u.username)} (${escapeHtml(u.position || '')})</span> <a href="#" onclick="logout()">ออกจากระบบ</a></div>`;
}

// ---------- LEAVE SUBMISSION ----------
function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const reader = new FileReader();
    reader.onload = ()=>res(reader.result);
    reader.onerror = ()=>rej('error');
    reader.readAsDataURL(file);
  });
}

async function leaveSubmit(evt){
  evt && evt.preventDefault();
  const user = getCurrentUser(); if(!user){ alert('กรุณาล็อกอิน'); location.href='index.html'; return; }
  const category = document.getElementById('leave_category').value;
  const dept = document.getElementById('leave_dept').value;
  const start = document.getElementById('start_date').value;
  const end = document.getElementById('end_date').value;
  const reason = document.getElementById('reason').value.trim();
  const position = user.position || '';
  if(!start||!end){ alert('เลือกวันที่ให้ถูกต้อง'); return; }
  const days = Math.floor((new Date(end) - new Date(start))/(1000*60*60*24)) + 1;
  // attachment
  const fileInput = document.getElementById('attachment');
  let attachmentName = null, attachmentData = null;
  if(fileInput && fileInput.files && fileInput.files[0]){
    attachmentName = fileInput.files[0].name;
    try{ attachmentData = await readFileAsDataURL(fileInput.files[0]); } catch(e){ console.warn('file read error'); }
  }

  // determine approval steps:
  // ถ้าเป็น นศ.ฝึกงาน -> พี่เลี้ยง -> หัวหน้าส่วน -> หัวหน้างานบุคลากร
  // ถ้าไม่ใช่นศ. -> หัวหน้าส่วน -> หัวหน้างานบุคลากร
  const users = JSON.parse(localStorage.getItem(KEY_USERS)||'[]');
  const mentor = users.find(x=> x.roles && x.roles.includes('mentor') && x.dept === dept);
  const supervisor = users.find(x=> x.roles && x.roles.includes('supervisor') && x.dept === dept);
  const hr = users.find(x=> x.roles && x.roles.includes('hr'));
  const steps = [];

  if(position === 'นศ.ฝึกงาน' || (user.roles && user.roles.includes('intern'))){
    steps.push({roleLabel:'พี่เลี้ยง', roleKey:'mentor', username: mentor? mentor.username : null, status:'รออนุมัติ'});
  }
  steps.push({roleLabel:'หัวหน้าส่วน', roleKey:'supervisor', username: supervisor? supervisor.username : null, status: supervisor? 'รออนุมัติ' : 'ไม่มีหัวหน้า'});
  steps.push({roleLabel:'หัวหน้างานบุคลากร', roleKey:'hr', username: hr? hr.username : null, status:'รออนุมัติ'});

  const leaves = JSON.parse(localStorage.getItem(KEY_LEAVES)||'[]');
  const rec = {
    id: Date.now(),
    requester: user.username,
    position,
    dept,
    category,
    start, end, days,
    reason,
    attachmentName, attachmentData, // may be null
    steps,
    created_at: new Date().toISOString()
  };
  leaves.push(rec);
  localStorage.setItem(KEY_LEAVES, JSON.stringify(leaves));
  alert('ส่งคำขอเรียบร้อย ระบบจะส่งแจ้งเตือนไปยังผู้อนุมัติของแผนกนั้น ๆ');
  location.href = 'my-leaves.html';
}

// ---------- MY LEAVES ----------
function getLeaves(){ return JSON.parse(localStorage.getItem(KEY_LEAVES) || '[]'); }
function saveLeaves(arr){ localStorage.setItem(KEY_LEAVES, JSON.stringify(arr)); }

function computeStatus(rec){
  // If any step === 'ไม่อนุมัติ' -> ไม่อนุมัติ
  if(rec.steps.some(s=> s.status === 'ไม่อนุมัติ')) return 'ไม่อนุมัติ';
  // If all required steps are 'อนุมัติแล้ว' or 'ไม่ต้องอนุมัติ'/'ไม่มีหัวหน้า' -> อนุมัติแล้ว
  const allOk = rec.steps.every(s => s.status === 'อนุมัติแล้ว' || s.status === 'ไม่ต้องอนุมัติ' || s.status === 'ไม่มีหัวหน้า');
  if(allOk) return 'อนุมัติแล้ว';
  return 'รออนุมัติ';
}
function statusClassText(rec){
  const st = computeStatus(rec);
  if(st==='อนุมัติแล้ว') return 'status-approved';
  if(st==='ไม่อนุมัติ') return 'status-rejected';
  return 'status-pending';
}

function renderMyLeaves(){
  renderHeader('hdr_user');
  const u = getCurrentUser(); if(!u) return;
  document.getElementById('my_user').textContent = `${u.username} (${u.position || ''})`;
  const rowsEl = document.getElementById('my_table');
  const leaves = getLeaves().filter(l=> l.requester === u.username).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  rowsEl.innerHTML = '';
  if(leaves.length === 0){ rowsEl.innerHTML = '<tr><td colspan="9">ยังไม่มีรายการ</td></tr>'; document.getElementById('summary_count').textContent=0; document.getElementById('summary_days').textContent=0; return; }
  leaves.forEach((l,idx)=>{
    const st = computeStatus(l);
    const attachHtml = l.attachmentData ? `<a href="${l.attachmentData}" download="${escapeHtml(l.attachmentName)}">ดาวน์โหลด</a>` : '-';
    const detail = l.steps.map(s => `${s.roleLabel}: ${s.status}`).join('<br>');
    rowsEl.insertAdjacentHTML('beforeend', `<tr>
      <td>${idx+1}</td><td>${escapeHtml(l.start)}</td><td>${escapeHtml(l.end)}</td><td>${l.days}</td><td>${escapeHtml(l.category)}</td><td>${escapeHtml(l.reason)}</td><td>${attachHtml}</td><td class="${statusClassText(l)}">${st}</td><td>${detail}</td>
    </tr>`);
  });
  document.getElementById('summary_count').textContent = leaves.length;
  const approvedLeaves = leaves.filter(l=> computeStatus(l) === 'อนุมัติแล้ว');
  document.getElementById('summary_days').textContent = approvedLeaves.reduce((a,b)=>a+(b.days||0),0);
}

// ---------- MENTOR ----------
function renderMentor(){
  renderHeader('hdr_user');
  const u = getCurrentUser(); if(!u || !u.roles.includes('mentor')){ alert('ต้องล็อกอินด้วยพี่เลี้ยง'); location.href='index.html'; return; }
  // pick interns in same dept or assigned mentor
  const users = JSON.parse(localStorage.getItem(KEY_USERS)||'[]');
  const interns = users.filter(x=> x.position==='นศ.ฝึกงาน' && (x.mentor===u.username || x.dept===u.dept)).map(x=>x.username);
  const leaves = getLeaves().filter(l=> interns.includes(l.requester)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const tbody = document.getElementById('mentor_table'); tbody.innerHTML = '';
  if(leaves.length===0) tbody.innerHTML = '<tr><td colspan="8">ไม่มีคำขอสำหรับคุณ</td></tr>';
  leaves.forEach(l=>{
    const st = computeStatus(l);
    const attachHtml = l.attachmentData ? `<a href="${l.attachmentData}" download="${escapeHtml(l.attachmentName)}">ดาวน์โหลด</a>` : '-';
    const row = `<tr>
      <td>${escapeHtml(l.requester)}</td>
      <td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td>
      <td>${l.days}</td>
      <td>${escapeHtml(l.category)}</td>
      <td>${escapeHtml(l.reason)}</td>
      <td>${attachHtml}</td>
      <td class="${statusClassText(l)}">${st}</td>
      <td>
        <button onclick="openApprove(${l.id})">รายละเอียด</button>
        <button onclick="actApprove(${l.id}, 'mentor')">อนุมัติ</button>
        <button onclick="actReject(${l.id}, 'mentor')">ไม่อนุมัติ</button>
      </td>
    </tr>`;
    tbody.insertAdjacentHTML('beforeend', row);
  });
  const pending = leaves.filter(l=> l.steps.some(s=> s.roleKey==='mentor' && s.status==='รออนุมัติ')).length;
  const notifEl = document.getElementById('mentor_notif'); if(notifEl) notifEl.textContent = `แจ้งเตือนใหม่: ${pending}`;
}

// mentor actions
function actApprove(id, roleKey){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].steps = leaves[idx].steps.map(s=> s.roleKey===roleKey ? {...s, status:'อนุมัติแล้ว'} : s);
  saveLeaves(leaves); alert('อนุมัติโดย ' + (roleKey==='mentor' ? 'พี่เลี้ยง' : roleKey));
  renderMentor(); renderSupervisor(); renderAdmin();
}
function actReject(id, roleKey){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].steps = leaves[idx].steps.map(s=> s.roleKey===roleKey ? {...s, status:'ไม่อนุมัติ'} : s);
  saveLeaves(leaves); alert('ปฏิเสธโดย ' + (roleKey==='mentor' ? 'พี่เลี้ยง' : roleKey));
  renderMentor(); renderSupervisor(); renderAdmin();
}

// ---------- SUPERVISOR ----------
function renderSupervisor(){
  renderHeader('hdr_user');
  const u = getCurrentUser(); if(!u || !u.roles.includes('supervisor')){ alert('ต้องล็อกอินด้วยหัวหน้าส่วน'); location.href='index.html'; return; }
  const leaves = getLeaves().filter(l=> l.dept === u.dept).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const tbody = document.getElementById('sup_table'); tbody.innerHTML = '';
  if(leaves.length===0) tbody.innerHTML = '<tr><td colspan="9">ไม่มีคำขอจากหน่วยงานนี้</td></tr>';
  leaves.forEach(l=>{
    const st = computeStatus(l);
    const attachHtml = l.attachmentData ? `<a href="${l.attachmentData}" download="${escapeHtml(l.attachmentName)}">ดาวน์โหลด</a>` : '-';
    const row = `<tr>
      <td>${escapeHtml(l.requester)}</td>
      <td>${escapeHtml(l.position)}</td>
      <td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td>
      <td>${l.days}</td>
      <td>${escapeHtml(l.category)}</td>
      <td>${escapeHtml(l.reason)}</td>
      <td>${attachHtml}</td>
      <td class="${statusClassText(l)}">${st}</td>
      <td>
        <button onclick="openApprove(${l.id})">รายละเอียด</button>
        <button onclick="actApprove(${l.id}, 'supervisor')">อนุมัติ</button>
        <button onclick="actReject(${l.id}, 'supervisor')">ไม่อนุมัติ</button>
      </td>
    </tr>`;
    tbody.insertAdjacentHTML('beforeend', row);
  });
  const pendingCount = leaves.filter(l => l.steps.some(s=> s.roleKey==='supervisor' && s.status==='รออนุมัติ')).length;
  const notifEl = document.getElementById('sup_notif'); if(notifEl) notifEl.textContent = `แจ้งเตือนใหม่: ${pendingCount}`;
}

// ---------- ADMIN / HR ----------
function renderAdmin(){
  renderHeader('hdr_user');
  const leaves = getLeaves().sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const tbody = document.getElementById('admin_table'); if(!tbody) return;
  tbody.innerHTML = '';
  if(leaves.length===0){ tbody.innerHTML = '<tr><td colspan="10">ยังไม่มีคำขอ</td></tr>'; return; }
  leaves.forEach(l=>{
    const st = computeStatus(l);
    const attachHtml = l.attachmentData ? `<a href="${l.attachmentData}" download="${escapeHtml(l.attachmentName)}">ดาวน์โหลด</a>` : '-';
    const statusDetail = l.steps.map(s=> `${s.roleLabel}: ${s.status}`).join('; ');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td>${escapeHtml(l.requester)}</td>
      <td>${escapeHtml(l.dept)}</td>
      <td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td>
      <td>${l.days}</td>
      <td>${escapeHtml(l.category)}</td>
      <td>${escapeHtml(l.reason)}</td>
      <td>${attachHtml}</td>
      <td class="${statusClassText(l)}">${st}</td>
      <td>${statusDetail}</td>
      <td><button onclick="openApprove(${l.id})">รายละเอียด/แก้สถานะ</button></td>
    </tr>`);
  });
  renderAdminStats();
}

function renderAdminStats(){
  const leaves = getLeaves();
  document.getElementById('stat_total').textContent = leaves.length;
  const byRole = leaves.reduce((acc,l)=>{ acc[l.category]=(acc[l.category]||0)+1; return acc; },{});
  document.getElementById('stat_by_role').innerText = JSON.stringify(byRole);
  const totals = {};
  leaves.forEach(l=>{
    if(computeStatus(l) === 'อนุมัติแล้ว'){ totals[l.requester] = (totals[l.requester]||0) + (l.days||0); }
  });
  const el = document.getElementById('top_days'); el.innerHTML = '';
  if(Object.keys(totals).length===0) el.innerHTML = '<div class="small">ยังไม่มีการลาอนุมัติ</div>';
  else Object.entries(totals).sort((a,b)=>b[1]-a[1]).forEach(([u,d])=> el.innerHTML += `<div>${escapeHtml(u)}: ${d} วัน</div>`);
}

// ---------- APPROVE PAGE ----------
function openApprove(id){ location.href = `approve.html?id=${id}`; }

function renderApprovePage(){
  renderHeader('hdr_user');
  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  const container = document.getElementById('approve_body');
  const actions = document.getElementById('approve_actions');
  if(!id){ container.innerHTML = '<div>ไม่พบคำขอ</div>'; return; }
  const leaves = getLeaves();
  const rec = leaves.find(x=> x.id === id);
  if(!rec){ container.innerHTML = '<div>ไม่พบคำขอ</div>'; return; }
  let html = `<h3>คำขอโดย: ${escapeHtml(rec.requester)} (${escapeHtml(rec.position)})</h3>
    <div>แผนก: ${escapeHtml(rec.dept)}</div>
    <div>วันที่: ${escapeHtml(rec.start)} ถึง ${escapeHtml(rec.end)} (${rec.days} วัน)</div>
    <div>ประเภท: ${escapeHtml(rec.category)}</div>
    <div>เหตุผล: ${escapeHtml(rec.reason)}</div>
    <div>ไฟล์แนบ: ${rec.attachmentData ? `<a href="${rec.attachmentData}" download="${escapeHtml(rec.attachmentName)}">ดาวน์โหลด</a>` : '-'}</div>
    <h4>สถานะการอนุมัติ</h4><ul>`;
  rec.steps.forEach((s,i)=> html += `<li>${s.roleLabel}: <strong>${s.status}</strong> ${s.username?`(ผู้ตรวจ: ${escapeHtml(s.username)})` : ''} ${renderApproveButtonsInline(rec.id,s.roleKey,s.status,i)}</li>`);
  html += '</ul>';
  container.innerHTML = html;

  // actions for current user (HR can manual toggle)
  const cur = getCurrentUser();
  let actionHtml = '';
  if(cur){
    // HR can toggle any step
    if(cur.roles.includes('hr')) actionHtml += `<div class="controls"><button onclick="manualToggle(${rec.id},-1)">แก้สถานะขั้นตอนทั้งหมด (สลับ)</button></div>`;
  }
  actions.innerHTML = actionHtml;
}

function renderApproveButtonsInline(recId, roleKey, status, stepIndex){
  const cur = getCurrentUser();
  if(!cur) return '';
  // If current user matches assigned username for that step and step is 'รออนุมัติ' -> show approve/reject
  const leaves = getLeaves();
  const rec = leaves.find(x=> x.id === recId);
  const step = rec.steps[stepIndex];
  let s = '';
  if(step && step.username && step.username === cur.username && step.status === 'รออนุมัติ'){
    s += ` <button onclick="actApprove(${recId},'${roleKey}')">อนุมัติ</button> <button onclick="actReject(${recId},'${roleKey}')">ไม่อนุมัติ</button>`;
  }
  // HR always see manual toggle
  if(cur.roles.includes('hr')) s += ` <button onclick="manualToggleStep(${recId},${stepIndex})">แก้สถานะ</button>`;
  return s;
}

// manual toggle by HR (rotate statuses)
function manualToggleStep(recId, stepIndex){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=> x.id===recId); if(idx<0) return;
  const states = ['รออนุมัติ','อนุมัติแล้ว','ไม่อนุมัติ','ไม่ต้องอนุมัติ','ไม่มีหัวหน้า'];
  const cur = leaves[idx].steps[stepIndex].status;
  let next = states[(states.indexOf(cur)+1) % states.length];
  if(states.indexOf(cur)===-1) next = 'อนุมัติแล้ว';
  leaves[idx].steps[stepIndex].status = next;
  saveLeaves(leaves);
  alert('เปลี่ยนสถานะเป็น: ' + next);
  renderApprovePage();
}

// admin manual toggle all steps (example)
function manualToggle(recId, all){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=> x.id===recId); if(idx<0) return;
  leaves[idx].steps = leaves[idx].steps.map(s=> ({...s, status: s.status === 'อนุมัติแล้ว' ? 'รออนุมัติ' : 'อนุมัติแล้ว'}));
  saveLeaves(leaves);
  alert('สลับสถานะขั้นตอนทั้งหมดแล้ว');
  renderApprovePage();
}

// ---------- ACTION helpers used by mentor/supervisor (actApprove/actReject already defined above) ----------
function actApprove(id, roleKey){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].steps = leaves[idx].steps.map(s=> s.roleKey === roleKey ? {...s, status:'อนุมัติแล้ว'} : s);
  saveLeaves(leaves);
  alert('อนุมัติเรียบร้อย');
  renderMentor(); renderSupervisor(); renderAdmin(); renderMyLeaves();
}
function actReject(id, roleKey){
  const leaves = getLeaves(); const idx = leaves.findIndex(x=>x.id===id); if(idx<0) return;
  leaves[idx].steps = leaves[idx].steps.map(s=> s.roleKey === roleKey ? {...s, status:'ไม่อนุมัติ'} : s);
  saveLeaves(leaves);
  alert('ปฏิเสธเรียบร้อย');
  renderMentor(); renderSupervisor(); renderAdmin(); renderMyLeaves();
}

// ---------- ADMIN Search ----------
function adminSearch(evt){
  evt && evt.preventDefault();
  const kw = document.getElementById('admin_search').value.trim().toLowerCase();
  const leaves = getLeaves().filter(l=> l.requester.toLowerCase().includes(kw) || (l.dept && l.dept.toLowerCase().includes(kw)));
  const tbody = document.getElementById('admin_table'); tbody.innerHTML = '';
  if(leaves.length===0){ tbody.innerHTML = '<tr><td colspan="10">ไม่พบผล</td></tr>'; return; }
  leaves.forEach(l=>{
    const st = computeStatus(l);
    const attachHtml = l.attachmentData ? `<a href="${l.attachmentData}" download="${escapeHtml(l.attachmentName)}">ดาวน์โหลด</a>` : '-';
    const statusDetail = l.steps.map(s=> `${s.roleLabel}: ${s.status}`).join('; ');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td>${escapeHtml(l.requester)}</td>
      <td>${escapeHtml(l.dept)}</td>
      <td>${escapeHtml(l.start)} ถึง ${escapeHtml(l.end)}</td>
      <td>${l.days}</td>
      <td>${escapeHtml(l.category)}</td>
      <td>${escapeHtml(l.reason)}</td>
      <td>${attachHtml}</td>
      <td class="${statusClassText(l)}">${st}</td>
      <td>${statusDetail}</td>
      <td><button onclick="openApprove(${l.id})">รายละเอียด/แก้สถานะ</button></td>
    </tr>`);
  });
}

// ฟังก์ชันแสดงผู้ใช้ (เฉพาะ HR เท่านั้น)
function renderUserManagement() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.roles.includes("hr")) {
    alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    location.href = "index.html";
    return;
  }

  const users = JSON.parse(localStorage.getItem("users")) || [];
  const tbody = document.querySelector("#usersTable tbody");
  tbody.innerHTML = "";

  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.username}</td>
      <td>${u.dept || "-"}</td>
      <td>${u.position || "-"}</td>
      <td>${u.roles.join(", ")}</td>
      <td>
        <button onclick="editRoles('${u.username}')">แก้ไขบทบาท</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}



// Initialize header render for pages that include header on load
// (some pages call renderHeader explicitly)
function renderUserDashboard(){ renderHeader('hdr_user'); }
function renderHeaderIfExists(){ renderHeader('hdr_user'); }

// export functions to global scope (so HTML onclick can call them)
window.registerSubmit = registerSubmit;
window.loginSubmit = loginSubmit;
window.leaveSubmit = leaveSubmit;
window.logout = logout;
window.renderUserDashboard = renderUserDashboard;
window.renderHeader = renderHeader;
window.renderMyLeaves = renderMyLeaves;
window.renderMentor = renderMentor;
window.renderSupervisor = renderSupervisor;
window.renderAdmin = renderAdmin;
window.openApprove = openApprove;
window.renderApprovePage = renderApprovePage;
window.adminSearch = adminSearch;
