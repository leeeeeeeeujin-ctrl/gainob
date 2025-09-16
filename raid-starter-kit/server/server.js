import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/styles', express.static(path.join(__dirname, '..', 'public', 'styles')));
app.use('/core', express.static(path.join(__dirname, '..', 'public', 'core')));
app.use('/components', express.static(path.join(__dirname, '..', 'public', 'components')));
app.use('/pages', express.static(path.join(__dirname, '..', 'public', 'pages')));

// 메모리 상태 (개발용)
const rooms = new Map();
const lobbyChat = [];
let chatSeq = 0;

// 방 생성 함수
function newRoom(params) {
  const id = Math.random().toString(36).slice(2, 10);
  const max = Math.min(12, params.maxPlayers || 4);
  const open = Array.isArray(params.openSlots) ? params.openSlots : Array.from({ length: max }, (_, i) => i + 1);
  const spectatorsMax = Math.max(0, params.spectatorsMax ?? 0);
  const aiMode = params.aiMode === 'free' ? 'free' : 'queue';
  
  const room = {
    id,
    title: params.title || 'Untitled',
    desc: params.desc || '',
    maxPlayers: max,
    openSlots: new Set(open),
    spectatorsMax,
    hostId: params.hostId || '',
    status: 'lobby',
    aiMode,
    speakerSlot: 1,
    boss: params.boss || null,
    slots: Array.from({ length: 12 }, (_, i) => ({ slotNo: i + 1 })),
    spectators: [],
    chat: [],
  };
  
  rooms.set(id, room);
  return room;
}

// 방 조회 (안전)
function getRoomSafe(id) {
  const room = rooms.get(id);
  if (!room) throw new Error('Room not found');
  return room;
}

// 방 공개 뷰
function roomPublicView(room) {
  return {
    id: room.id,
    title: room.title,
    desc: room.desc,
    maxPlayers: room.maxPlayers,
    openSlots: [...room.openSlots],
    spectatorsMax: room.spectatorsMax,
    status: room.status,
    aiMode: room.aiMode,
    hostId: room.hostId,
    speakerSlot: room.speakerSlot,
    boss: room.boss,
    slots: room.slots.map(slot => ({
      slotNo: slot.slotNo,
      playerId: slot.playerId,
      playerName: slot.playerName,
      ready: !!slot.ready,
      char: slot.char ? {
        name: slot.char.name,
        title: slot.char.title,
        desc: slot.char.desc,
        image: slot.char.image,
        abilities: (slot.char.abilities || []).slice(0, 4)
      } : undefined
    })),
    spectators: room.spectators.map(x => ({ id: x.id, name: x.name })),
  };
}

// 파일 업로드 설정
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});

const upload = multer({ storage });

// 파일 업로드 API
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// 방 관리 API
app.get('/api/rooms', (req, res) => {
  const list = [...rooms.values()].map(room => ({
    id: room.id,
    title: room.title,
    players: room.slots.filter(slot => slot.playerId).length,
    max: room.maxPlayers,
    boss: !!room.boss,
    status: room.status
  }));
  res.json({ rooms: list });
});

app.post('/api/rooms', (req, res) => {
  const { clientId, title, desc, maxPlayers, openSlots, aiMode, spectatorsMax } = req.body || {};
  const room = newRoom({ title, desc, maxPlayers, openSlots, aiMode, spectatorsMax, hostId: clientId });
  res.json({ room });
});

app.get('/api/rooms/:id', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    res.json({ room: roomPublicView(room) });
  } catch {
    res.sendStatus(404);
  }
});

// 슬롯 관리 API
app.post('/api/rooms/:id/claim', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId, name, slotNo, char } = req.body || {};
    if (room.status === 'raid' || room.status === 'countdown') {
      return res.status(409).json({ error: 'raid in progress' });
    }
    
    if (!room.openSlots.has(slotNo)) {
      return res.status(400).json({ error: 'Slot is closed' });
    }
    
    const slot = room.slots[slotNo - 1];
    if (!slot || slot.playerId) {
      return res.status(409).json({ error: 'Slot is occupied' });
    }
    
    slot.playerId = clientId;
    slot.playerName = name || 'Player';
    slot.ready = false;
    slot.char = char || null;
    
    // 호스트는 방 생성 시 확정되므로 여기서 지정하지 않음
    
    pushState(room.id);
    res.json({ room: roomPublicView(room) });
  } catch {
    res.sendStatus(404);
  }
});

app.post('/api/rooms/:id/release', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId } = req.body || {};
    if (room.status === 'raid' || room.status === 'countdown') {
      return res.status(409).json({ error: 'raid in progress' });
    }
    const slot = room.slots.find(s => s.playerId === clientId);
    
    if (slot) {
      Object.assign(slot, {
        playerId: undefined,
        playerName: undefined,
        ready: false,
        char: undefined
      });
    }
    
    pushState(room.id);
    res.json({ room: roomPublicView(room) });
  } catch {
    res.sendStatus(404);
  }
});

app.post('/api/rooms/:id/ready', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId, value } = req.body || {};
    if (room.status === 'raid' || room.status === 'countdown') {
      return res.status(409).json({ error: 'raid in progress' });
    }
    const slot = room.slots.find(s => s.playerId === clientId);
    
    if (slot) {
      slot.ready = value === undefined ? !slot.ready : !!value;
    }
    
    pushState(room.id);
    res.json({ room: roomPublicView(room) });
  } catch {
    res.sendStatus(404);
  }
});

// 누락된 API 엔드포인트들 추가
app.post('/api/rooms/:id/kick', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId, targetSlot } = req.body || {};
    
    if (room.hostId !== clientId) {
      return res.status(403).json({ error: 'Host only' });
    }
    
    const slot = room.slots[targetSlot - 1];
    if (slot) {
      Object.assign(slot, {
        playerId: undefined,
        playerName: undefined,
        ready: false,
        char: undefined
      });
    }
    
    pushState(room.id);
    res.json({ room: roomPublicView(room) });
  } catch {
    res.sendStatus(404);
  }
});

app.post('/api/rooms/:id/mode', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId, mode } = req.body || {};
    
    if (room.hostId !== clientId) {
      return res.status(403).json({ error: 'Host only' });
    }
    
    room.aiMode = mode === 'free' ? 'free' : 'queue';
    pushState(room.id);
    res.json({ room: roomPublicView(room) });
  } catch {
    res.sendStatus(404);
  }
});

app.post('/api/rooms/:id/speaker', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId, slotNo } = req.body || {};
    
    if (room.hostId !== clientId) {
      return res.status(403).json({ error: 'Host only' });
    }
    
    room.speakerSlot = slotNo;
    pushState(room.id);
    res.json({ room: roomPublicView(room) });
  } catch {
    res.sendStatus(404);
  }
});

app.post('/api/rooms/:id/start', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId } = req.body || {};
    
    if (room.hostId !== clientId) {
      return res.status(403).json({ error: 'Host only' });
    }
    
    const readyOK = room.slots.filter(s => s.playerId && s.playerId !== room.hostId)
      .every(s => !!s.ready);
    
    if (!readyOK) {
      return res.status(400).json({ error: 'Not all ready' });
    }
    
    room.status = 'countdown';
    pushState(room.id);
    
    let n = 5;
    const interval = setInterval(() => {
      if (n > 0) {
        broadcast(room.id, { type: 'COUNTDOWN_TICK', n });
        n--;
      } else {
        clearInterval(interval);
        room.status = 'raid';
        const startAt = Date.now() + 500;
        broadcast(room.id, { type: 'COUNTDOWN_DONE', startAt });
        pushState(room.id);
      }
    }, 1000);
    
    res.json({ ok: true });
  } catch {
    res.sendStatus(404);
  }
});

app.post('/api/rooms/:id/delete', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId } = req.body || {};
    
    if (room.hostId !== clientId) {
      return res.status(403).json({ error: 'Host only' });
    }
    
    // WebSocket 연결 정리
    const roomSockets = sockets.get(room.id);
    if (roomSockets) {
      roomSockets.forEach(ws => {
        try {
          ws.close();
        } catch {}
      });
      sockets.delete(room.id);
    }
    
    rooms.delete(room.id);
    broadcast(room.id, { type: 'ROOM_DELETED' });
    res.json({ ok: true });
  } catch {
    res.sendStatus(404);
  }
});

// WebSocket 설정
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const wss = new WebSocketServer({ server });
const sockets = new Map(); // roomId -> Set(ws)

function pushState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  broadcast(roomId, { type: 'ROOM_STATE', room: roomPublicView(room) });
}

function broadcast(roomId, obj) {
  const data = JSON.stringify(obj);
  const set = sockets.get(roomId) || new Set();
  set.forEach(ws => {
    try {
      if (ws.readyState === 1) ws.send(data);
    } catch {}
  });
}

wss.on('connection', (ws, req) => {
  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    
    if (message.type === 'JOIN') {
      ws.roomId = message.roomId || 'lobby';
      ws.clientId = message.clientId;
      const set = sockets.get(ws.roomId) || new Set();
      set.add(ws);
      sockets.set(ws.roomId, set);
      
      if (ws.roomId === 'lobby') {
        ws.send(JSON.stringify({ type: 'LOBBY_STATE', chat: lobbyChat.slice(-100) }));
      } else {
        const room = rooms.get(ws.roomId);
        if (room) {
          // 게임이 진행 중이면 신규 참여자는 관전자로 처리
          if (room.status === 'raid' || room.status === 'countdown') {
            const name = message.name || 'Spectator';
            const exists = room.spectators.some(s => s.id === ws.clientId);
            if (!exists) room.spectators.push({ id: ws.clientId, name });
          }
        }
        pushState(ws.roomId);
      }
      return;
    }
    
    if (message.type === 'CHAT_SEND') {
      const chatMessage = {
        id: ++chatSeq,
        roomId: ws.roomId,
        kind: message.kind || 'general',
        senderId: message.clientId,
        name: message.name || 'Player',
        text: (message.text || '').slice(0, 2000),
        ts: Date.now()
      };
      // AI 발화권 서버 측 검증
      if (chatMessage.kind === 'ai' && ws.roomId !== 'lobby') {
        const room = rooms.get(ws.roomId);
        if (!room) return;
        const senderSlot = room.slots.find(s => s.playerId === chatMessage.senderId);
        const isHost = room.hostId === chatMessage.senderId;
        const canSpeak = isHost || room.aiMode === 'free' || (senderSlot && room.speakerSlot === senderSlot.slotNo);
        if (!canSpeak) {
          // 발화권 없으면 무시
          return;
        }
      }

      if (ws.roomId === 'lobby') {
        lobbyChat.push(chatMessage);
        const data = JSON.stringify({ type: 'CHAT_PUSH', message: chatMessage });
        (sockets.get('lobby') || new Set()).forEach(ws => {
          if (ws.readyState === 1) ws.send(data);
        });
      } else {
        const room = rooms.get(ws.roomId);
        if (!room) return;
        room.chat.push(chatMessage);
        broadcast(ws.roomId, { type: 'CHAT_PUSH', message: chatMessage });
      }
    }
  });
  
  ws.on('close', () => {
    const set = sockets.get(ws.roomId || '') || new Set();
    set.delete(ws);
  });
});

// 기본 라우트
app.get('/', (_, res) => res.redirect('/pages/lobby.html'));

// 프롬프트 실행 (서버 브로커: 지금은 단순 브로드캐스트용)
app.post('/api/rooms/:id/run-prompt', (req, res) => {
  try {
    const room = getRoomSafe(req.params.id);
    const { clientId, text } = req.body || {};
    if (room.hostId !== clientId) return res.status(403).json({ error:'Host only' });
    const msg = { id: ++chatSeq, roomId: room.id, kind: 'ai', senderId: clientId, name: 'SYSTEM', text: String(text||'').slice(0,2000), ts: Date.now() };
    room.chat.push(msg);
    broadcast(room.id, { type:'CHAT_PUSH', message: msg });
    res.json({ ok:true });
  } catch {
    res.sendStatus(404);
  }
});
