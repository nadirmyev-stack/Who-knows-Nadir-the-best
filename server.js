
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));

const clients = new Map();
const players = new Map();
let phase = 'lobby'; // lobby | question | reveal | final
let qIndex = -1;
let questionStartedAt = null;
let revealTimer = null;
let nextTimer = null;

function publicState() {
  return {
    phase, qIndex,
    total: questions.length,
    question: qIndex >= 0 ? {
      text: questions[qIndex].q,
      options: questions[qIndex].options
    } : null,
    questionStartedAt,
    revealCorrect: phase === 'reveal' || phase === 'final'
      ? (qIndex >= 0 ? questions[qIndex].correct : null) : null,
    leaderboard: leaderboard()
  };
}

function leaderboard() {
  return [...players.values()]
    .map(p => ({
      id: p.id, name: p.name, score: p.score,
      totalTime: Math.round(p.totalTime * 10) / 10,
      answers: p.answers
    }))
    .sort((a,b) => b.score - a.score || a.totalTime - b.totalTime || a.name.localeCompare(b.name));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients.keys()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function resetGame() {
  phase = 'lobby'; qIndex = -1; questionStartedAt = null;
  if (revealTimer) clearTimeout(revealTimer);
  if (nextTimer) clearTimeout(nextTimer);
  revealTimer = nextTimer = null;
  for (const p of players.values()) {
    p.score = 0; p.totalTime = 0; p.answers = [];
  }
  broadcast({type:'state', state: publicState()});
}

function startQuestion(index) {
  if (index >= questions.length) {
    phase = 'final';
    questionStartedAt = null;
    broadcast({type:'state', state: publicState()});
    return;
  }
  qIndex = index;
  phase = 'question';
  questionStartedAt = Date.now();
  for (const p of players.values()) p.answeredThis = false;
  broadcast({type:'state', state: publicState()});

  revealTimer = setTimeout(() => {
    phase = 'reveal';
    broadcast({type:'state', state: publicState()});
    nextTimer = setTimeout(() => startQuestion(qIndex + 1), 3000);
  }, 15000);
}

function startGame() {
  if (players.size === 0) return;
  startQuestion(0);
}

function handleAnswer(ws, idx) {
  const p = players.get(ws.playerId);
  if (!p || phase !== 'question' || p.answeredThis) return;
  if (!Number.isInteger(idx) || idx < 0 || idx >= questions[qIndex].options.length) return;
  const elapsed = Math.min(15, Math.max(0, (Date.now() - questionStartedAt) / 1000));
  const correct = idx === questions[qIndex].correct;
  p.answeredThis = true;
  p.totalTime += elapsed;
  if (correct) p.score++;
  p.answers[qIndex] = {choice: idx, correct, time: elapsed};
  send(ws, {type:'answerAccepted', qIndex, choice:idx, correct});
  broadcast({type:'leaderboard', leaderboard: leaderboard()});
}

const server = http.createServer(async (req,res) => {
  let url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/config') {
    const base = PUBLIC_URL || `${url.protocol}//${url.host}`;
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({joinUrl: base + '/'}));
  }
  if (url.pathname === '/qr') {
    const base = PUBLIC_URL || `${url.protocol}//${url.host}`;
    try {
      const png = await QRCode.toBuffer(base + '/', {width: 500, margin: 2});
      res.writeHead(200, {'Content-Type':'image/png'});
      return res.end(png);
    } catch(e) {
      res.writeHead(500); return res.end('QR error');
    }
  }
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const safe = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
  const fp = path.join(__dirname, safe);
  fs.readFile(fp, (err,data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fp);
    const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
    res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
    res.end(data);
  });
});

const wss = new WebSocket.Server({server});
wss.on('connection', ws => {
  clients.set(ws, true);
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.type === 'join') {
      const id = crypto.randomUUID();
      ws.playerId = id;
      players.set(id, {id, name:String(m.name || 'Anonim').trim().slice(0,40), score:0,totalTime:0,answers:[],answeredThis:false});
      send(ws, {type:'joined', id, state:publicState()});
      broadcast({type:'state', state:publicState()});
    } else if (m.type === 'answer') {
      handleAnswer(ws, Number(m.choice));
    } else if (m.type === 'hostStart') {
      startGame();
    } else if (m.type === 'hostReset') {
      resetGame();
    } else if (m.type === 'getState') {
      send(ws, {type:'state', state:publicState()});
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
    // Keep player record for the whole game if they temporarily reconnect.
  });
});

server.listen(PORT, () => console.log(`Quiz server running on http://localhost:${PORT}`));
