// api.js — REPLACE or MERGE (하단 Prompts 추가)
const DEFAULT_API_BASE = 'https://raid-api.leeeeeeeeujin.workers.dev';
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

// 🔹 프롬프트 전용 래퍼
export const Prompts = {
  list(roomId) {
    return fetch(`${API_BASE}/api/rooms/${roomId}/prompts`).then(r=>r.json());
  },
  upsert(roomId, body) { // {id?, title, template, vars?, allowedSlots?, clientId?}
    return fetch(`${API_BASE}/api/rooms/${roomId}/prompts`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    }).then(r=>r.json());
  },
  remove(roomId, pid, clientId) {
    return fetch(`${API_BASE}/api/rooms/${roomId}/prompts/${pid}`, {
      method:'DELETE', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ clientId })
    }).then(r=>r.json());
  },
  allow(roomId, payload) { // { add?:number[], remove?:number[], clientId }
    return fetch(`${API_BASE}/api/rooms/${roomId}/prompt-allow`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(r=>r.json());
  },
  ask(roomId, payload) { // { clientId, slotNo, promptId? | template?, vars? }
    return fetch(`${API_BASE}/api/rooms/${roomId}/ask`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(r=>r.json());
  }
};
