// C:\Users\yujin\Videos\gf\frontend\public\core\api.js

// 로컬/배포 전환 편하게: localStorage.RSK_API_BASE 로 덮어쓸 수 있게 함
const DEFAULT_API_BASE = 'https://raid-api.leeeeeeeeujin.workers.dev'; // ← Workers 배포 주소로 바꿔넣기
const API_BASE = localStorage.getItem('RSK_API_BASE') || DEFAULT_API_BASE;

export const API = {
  listRooms: () => fetch(`${API_BASE}/api/rooms`).then(r => r.json()),
  getRoom:   (id) => fetch(`${API_BASE}/api/rooms/${id}`).then(r => r.json()),
  create:    (body) => fetch(`${API_BASE}/api/rooms`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(r=>r.json()),
  delete:    (id) => fetch(`${API_BASE}/api/rooms/${id}/delete`, { method:'POST' }).then(r=>r.json()),

  claim:     (id, body) => fetch(`${API_BASE}/api/rooms/${id}/claim`,   {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  release:   (id, body) => fetch(`${API_BASE}/api/rooms/${id}/release`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  ready:     (id, body) => fetch(`${API_BASE}/api/rooms/${id}/ready`,   {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  kick:      (id, body) => fetch(`${API_BASE}/api/rooms/${id}/kick`,    {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  speaker:   (id, body) => fetch(`${API_BASE}/api/rooms/${id}/speaker`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  start:     (id, body) => fetch(`${API_BASE}/api/rooms/${id}/start`,   {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),

  runPrompt: (id, body) => fetch(`${API_BASE}/api/rooms/${id}/runPrompt`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  chat:      (id, body) => fetch(`${API_BASE}/api/rooms/${id}/chat`,    {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
};
