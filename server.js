const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Questions Bank (Who / Which / That in Nursing Context)
const questions = [
  {
    text: "The nurse _____ was assigned to the ICU checked the vital signs.",
    options: ["Who", "Which", "That"],
    correct: 0
  },
  {
    text: "The ECG machine _____ was bought last month needs calibration.",
    options: ["Who", "Which", "That"],
    correct: 1
  },
  {
    text: "Patients _____ suffer from hypertension should reduce salt intake.",
    options: ["Who", "Which", "That"],
    correct: 0
  },
  {
    text: "The stethoscope _____ I bought yesterday has great sound quality.",
    options: ["Who", "Which", "That"],
    correct: 2
  },
  {
    text: "The doctor _____ performed the surgery explained the risks.",
    options: ["Who", "Which", "That"],
    correct: 0
  }
];

let gameState = {
  players: [],
  teamA: [],
  teamB: [],
  currentQuestionIndex: 0,
  activePlayerA: null,
  activePlayerB: null,
  scores: { A: 0, B: 0 },
  answers: { A: null, B: null }
};

// 1. Student Direct Route (Name Entry Interface)
app.get('/', (req, res) => {
  res.send(getStudentHTML());
});

// 2. Projector Route (Main Display Interface)
app.get('/projector', (req, res) => {
  res.send(getProjectorHTML(req.headers.host));
});

io.on('connection', (socket) => {

  socket.on('join_game', (playerName) => {
    const team = gameState.teamA.length <= gameState.teamB.length ? 'A' : 'B';
    const newPlayer = { id: socket.id, name: playerName, team };
    
    gameState.players.push(newPlayer);
    if (team === 'A') gameState.teamA.push(newPlayer);
    else gameState.teamB.push(newPlayer);

    socket.emit('joined_successfully', { team, name: playerName });
    io.emit('update_players', gameState.players);
  });

  socket.on('start_round', () => {
    if (gameState.teamA.length === 0 || gameState.teamB.length === 0) {
      socket.emit('error_message', 'At least 1 student in each team is required to start!');
      return;
    }

    gameState.answers = { A: null, B: null };

    const randA = Math.floor(Math.random() * gameState.teamA.length);
    const randB = Math.floor(Math.random() * gameState.teamB.length);

    gameState.activePlayerA = gameState.teamA[randA];
    gameState.activePlayerB = gameState.teamB[randB];

    const currentQuestion = questions[gameState.currentQuestionIndex];

    io.emit('round_started', {
      question: currentQuestion.text,
      options: currentQuestion.options,
      teamAPlayers: gameState.teamA,
      teamBPlayers: gameState.teamB,
      activeA: gameState.activePlayerA,
      activeB: gameState.activePlayerB,
      questionNum: gameState.currentQuestionIndex + 1
    });
  });

  socket.on('submit_answer', (optionIndex) => {
    const isPlayerA = gameState.activePlayerA && gameState.activePlayerA.id === socket.id;
    const isPlayerB = gameState.activePlayerB && gameState.activePlayerB.id === socket.id;

    if (!isPlayerA && !isPlayerB) return;

    const currentQ = questions[gameState.currentQuestionIndex];
    const isCorrect = optionIndex === currentQ.correct;

    if (isPlayerA && gameState.answers.A === null) {
      gameState.answers.A = { optionIndex, isCorrect };
      if (isCorrect) gameState.scores.A += 10;
    } else if (isPlayerB && gameState.answers.B === null) {
      gameState.answers.B = { optionIndex, isCorrect };
      if (isCorrect) gameState.scores.B += 10;
    }

    io.emit('answer_received', {
      scores: gameState.scores,
      answers: gameState.answers
    });

    if (gameState.answers.A !== null && gameState.answers.B !== null) {
      gameState.currentQuestionIndex = (gameState.currentQuestionIndex + 1) % questions.length;
      io.emit('round_ended', { scores: gameState.scores });
    }
  });

  socket.on('disconnect', () => {
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    gameState.teamA = gameState.teamA.filter(p => p.id !== socket.id);
    gameState.teamB = gameState.teamB.filter(p => p.id !== socket.id);
    io.emit('update_players', gameState.players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ==================== Student Mobile Interface ====================
function getStudentHTML() {
  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nursing Staff Entry</title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background: linear-gradient(rgba(2, 6, 23, 0.88), rgba(2, 6, 23, 0.95)), url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1000&auto=format&fit=crop');
      background-size: cover;
      background-position: center;
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen p-4 font-sans flex flex-col items-center justify-center">

  <div id="playerView" class="w-full max-w-sm bg-slate-900/90 backdrop-blur-xl p-5 rounded-2xl shadow-xl border border-teal-500/30">
    <div id="loginForm" class="space-y-3">
      <div class="text-center">
        <div class="inline-block p-3 bg-teal-950/80 rounded-full border border-teal-400/40 shadow-md mb-1">
          <span class="text-3xl">🩺</span>
        </div>
        <h2 class="text-xl font-bold text-teal-400">Nursing Registration</h2>
        <p class="text-[11px] text-slate-400 mt-0.5">Medical English & Grammar Challenge</p>
      </div>
      <div>
        <label class="block text-xs font-semibold text-teal-200 mb-1">Student / Nurse Name:</label>
        <input id="nameInput" type="text" placeholder="Enter your full name..." class="w-full p-2.5 rounded-lg bg-slate-800/90 text-white border border-teal-500/40 focus:outline-none focus:border-teal-300 text-center font-medium text-sm shadow-inner">
      </div>
      <button onclick="joinGame()" class="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 py-2.5 rounded-lg font-bold text-sm shadow-md transition flex items-center justify-center gap-1.5">
        <span>🚀</span> Join Team
      </button>
    </div>

    <div id="waitScreen" class="hidden text-center py-4 space-y-3">
      <div class="text-lg font-bold">Welcome <span id="pName" class="text-teal-400"></span> 🩺</div>
      <div id="pTeamBadge" class="inline-block px-4 py-1.5 rounded-full text-xs font-bold shadow-md"></div>
      <div class="p-4 bg-slate-800/90 rounded-xl border border-teal-500/30 animate-pulse space-y-1.5">
        <div class="text-2xl">🫀</div>
        <p class="text-slate-200 text-xs font-semibold">Look at the Projector Screen...</p>
        <p class="text-[10px] text-teal-300">Selection in progress!</p>
      </div>
    </div>

    <div id="gamePlayArea" class="hidden text-center space-y-3">
      <div id="turnBadge" class="p-3 rounded-xl font-semibold text-xs shadow-md"></div>
      <div id="questionBox" class="bg-slate-800/90 p-4 rounded-xl border border-amber-500/40 font-bold text-sm text-amber-300 shadow-inner"></div>
      <div id="optionsContainer" class="space-y-2"></div>
    </div>
  </div>

  <script>
    const socket = io();

    function joinGame() {
      const name = document.getElementById('nameInput').value.trim();
      if (!name) return alert('Please enter your name first!');
      socket.emit('join_game', name);
    }

    socket.on('joined_successfully', (data) => {
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('waitScreen').classList.remove('hidden');
      document.getElementById('pName').innerText = data.name;
      const badge = document.getElementById('pTeamBadge');
      if (data.team === 'A') {
        badge.className = "inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-red-950/90 text-red-400 border border-red-500/60 shadow-md";
        badge.innerText = "🚨 Emergency Team";
      } else {
        badge.className = "inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-blue-950/90 text-blue-400 border border-blue-500/60 shadow-md";
        badge.innerText = "🩺 ICU Care Team";
      }
    });

    socket.on('round_started', (data) => {
      const myId = socket.id;
      const isMyTurn = (data.activeA.id === myId) || (data.activeB.id === myId);

      document.getElementById('waitScreen').classList.add('hidden');
      document.getElementById('gamePlayArea').classList.remove('hidden');

      const turnBadge = document.getElementById('turnBadge');
      const optionsContainer = document.getElementById('optionsContainer');
      optionsContainer.innerHTML = '';

      if (isMyTurn) {
        turnBadge.className = "p-3 rounded-xl font-bold text-xs bg-emerald-950/90 text-emerald-300 border border-emerald-500 animate-bounce";
        turnBadge.innerText = "⚡ YOUR TURN! Select the correct answer:";
        document.getElementById('questionBox').innerText = data.question;

        data.options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.className = "w-full bg-gradient-to-r from-teal-700 to-cyan-700 hover:from-teal-600 hover:to-cyan-600 active:scale-95 text-white p-3 rounded-xl font-bold text-sm transition shadow-sm flex items-center justify-between px-4 border border-teal-400/30";
          btn.innerHTML = \`<span>\${opt}</span> <span>💉</span>\`;
          btn.onclick = () => {
            socket.emit('submit_answer', idx);
            optionsContainer.innerHTML = '<div class="p-3 bg-emerald-950/90 text-emerald-300 border border-emerald-500 rounded-xl font-bold text-xs">✅ Answer submitted!</div>';
          };
          optionsContainer.appendChild(btn);
        });
      } else {
        turnBadge.className = "p-3 rounded-xl font-medium text-xs bg-slate-800/90 text-slate-300 border border-slate-700";
        turnBadge.innerText = \`🎯 Representatives:\\n🚨 Emergency: \${data.activeA.name}\\n🩺 ICU: \${data.activeB.name}\`;
        optionsContainer.innerHTML = '<div class="p-3 bg-slate-900/80 text-slate-400 rounded-xl text-xs animate-pulse">⏳ Watch the projector display!</div>';
      }
    });

    socket.on('error_message', (msg) => alert(msg));
  </script>
</body>
</html>
  `;
}

// ==================== Projector Display Interface ====================
function getProjectorHTML(host) {
  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nursing Monitor - Projector Screen</title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background: linear-gradient(rgba(2, 6, 23, 0.90), rgba(2, 6, 23, 0.96)), url('https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=1200&auto=format&fit=crop');
      background-size: cover;
      background-position: center;
      background-attachment: fixed;
    }
    .slot-container {
      height: 70px;
      overflow: hidden;
      position: relative;
      border-radius: 1rem;
      background: #020617;
      box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.9);
    }
    .slot-reel {
      transition: transform 0.1s linear;
    }
    .slot-item {
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      font-weight: 800;
    }
    .ecg-line {
      height: 3px;
      background: linear-gradient(90deg, #10b981 0%, #34d399 50%, transparent 100%);
      animation: pulse-line 2s infinite linear;
    }
    @keyframes pulse-line {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen p-5 font-sans flex flex-col items-center justify-center relative">

  <div id="displayView" class="w-full max-w-5xl bg-slate-900/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-teal-500/30 relative">
    
    <div class="w-full overflow-hidden rounded-t-lg mb-3 bg-slate-950/80 h-1.5 relative">
      <div class="ecg-line w-full"></div>
    </div>

    <div class="flex justify-between items-center mb-5 pb-3 border-b border-teal-500/20 px-1">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-teal-950/80 rounded-xl border border-teal-400/40 text-2xl shadow-inner text-teal-300">
          🩺
        </div>
        <div>
          <h1 class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-400 to-cyan-400">
            Nursing English & Grammar Challenge
          </h1>
          <p class="text-[11px] text-teal-300/70 mt-0.5 font-mono flex items-center gap-2">
            <span>🏥 NURSING DEPARTMENT</span> • <span>GRAMMAR: WHO / WHICH / THAT</span>
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-2.5 bg-slate-950/90 p-2 rounded-xl border border-teal-500/40 shadow-lg">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://${host}/" alt="QR Code" class="w-14 h-14 rounded-md border border-teal-400/30">
        <div class="text-left">
          <p class="text-[11px] font-bold text-emerald-400 flex items-center gap-1">📱 SCAN TO JOIN 💉</p>
          <p class="text-[9px] text-slate-400 mt-0.5 font-mono break-all max-w-[110px]">${host}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-6 mb-5">
      
      <!-- Emergency Team -->
      <div class="bg-red-950/30 border border-red-500/50 p-4 rounded-2xl relative shadow-lg backdrop-blur-md">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-base font-bold text-red-400 flex items-center gap-1.5">
            <span>🚨</span> Emergency Team
          </h3>
          <span id="scoreA" class="text-base font-bold text-red-400 bg-red-950/90 px-3 py-1 rounded-lg border border-red-700/70 font-mono shadow-inner">
            0 BPM
          </span>
        </div>
        <div class="slot-container border border-red-500/60 mb-3">
          <div id="reelA" class="slot-reel">
            <div class="slot-item text-red-400 font-mono text-sm">Waiting for staff... 🚑</div>
          </div>
        </div>
        <div class="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
          <span>👨‍⚕️</span> Members:
        </div>
        <div id="playersA" class="text-[11px] text-slate-200 flex flex-wrap gap-1 min-h-[24px]"></div>
      </div>

      <!-- ICU Team -->
      <div class="bg-blue-950/30 border border-blue-500/50 p-4 rounded-2xl relative shadow-lg backdrop-blur-md">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-base font-bold text-blue-400 flex items-center gap-1.5">
            <span>🩺</span> ICU Care Team
          </h3>
          <span id="scoreB" class="text-base font-bold text-blue-400 bg-blue-950/90 px-3 py-1 rounded-lg border border-blue-700/70 font-mono shadow-inner">
            0 BPM
          </span>
        </div>
        <div class="slot-container border border-blue-500/60 mb-3">
          <div id="reelB" class="slot-reel">
            <div class="slot-item text-blue-400 font-mono text-sm">Waiting for staff... 💉</div>
          </div>
        </div>
        <div class="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
          <span>👩‍⚕️</span> Members:
        </div>
        <div id="playersB" class="text-[11px] text-slate-200 flex flex-wrap gap-1 min-h-[24px]"></div>
      </div>
    </div>

    <div class="bg-slate-950/90 p-5 rounded-2xl border border-amber-500/40 text-center mb-5 shadow-xl relative">
      <div class="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-3 py-0.2 rounded-full text-[10px] font-bold tracking-wider">
        CLINICAL CASE QUESTION 🫀
      </div>
      <h2 id="projQuestion" class="text-xl font-bold text-amber-300 leading-snug mt-1">
        Scan the QR code to join, then click "Start Wheel"! 🎰
      </h2>
    </div>

    <div class="flex justify-between items-center">
      <div class="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-emerald-500/30">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span>SYSTEM ONLINE</span>
      </div>
      <button onclick="startRound()" class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white px-8 py-2.5 rounded-xl font-bold text-base shadow-lg shadow-emerald-950/50 transition flex items-center gap-2 border border-emerald-400/30">
        <span>🎰</span> Start Wheel
      </button>
    </div>
  </div>

  <script>
    const socket = io();

    socket.on('update_players', (players) => {
      const teamA = players.filter(p => p.team === 'A');
      const teamB = players.filter(p => p.team === 'B');

      document.getElementById('playersA').innerHTML = teamA.map(p => 
        \`<span class="bg-red-950/90 border border-red-700/70 text-red-200 px-2 py-0.5 rounded text-[11px] font-medium">🚑 \${p.name}</span>\`
      ).join('');

      document.getElementById('playersB').innerHTML = teamB.map(p => 
        \`<span class="bg-blue-950/90 border border-blue-700/70 text-blue-200 px-2 py-0.5 rounded text-[11px] font-medium">🩺 \${p.name}</span>\`
      ).join('');
    });

    function startRound() {
      socket.emit('start_round');
    }

    socket.on('round_started', (data) => {
      document.getElementById('projQuestion').innerText = \`Case (\${data.questionNum}): \${data.question}\`;
      runSlotMachine('reelA', data.teamAPlayers, data.activeA.name, 'text-red-400');
      runSlotMachine('reelB', data.teamBPlayers, data.activeB.name, 'text-blue-400');
    });

    function runSlotMachine(reelId, playersList, finalWinner, textColorClass) {
      const reel = document.getElementById(reelId);
      if (!reel) return;
      let names = [...playersList.map(p => p.name)];
      
      let repeatedNames = [];
      for (let i = 0; i < 12; i++) {
        repeatedNames = repeatedNames.concat(names);
      }
      repeatedNames.push(finalWinner);

      reel.innerHTML = repeatedNames.map(name => \`<div class="slot-item \${textColorClass}">🩺 \${name}</div>\`).join('');

      let currentIndex = 0;
      let speed = 35;

      function spin() {
        currentIndex++;
        reel.style.transform = \`translateY(-\${currentIndex * 70}px)\`;

        if (currentIndex < repeatedNames.length - 1) {
          if (currentIndex > repeatedNames.length - 6) speed += 50;
          setTimeout(spin, speed);
        }
      }
      spin();
    }

    socket.on('answer_received', (data) => {
      document.getElementById('scoreA').innerText = data.scores.A + ' BPM 🩸';
      document.getElementById('scoreB').innerText = data.scores.B + ' BPM 💊';
    });

    socket.on('round_ended', () => {
      setTimeout(() => {
        alert('🎉 Round completed! Click "Start Wheel" for the next case.');
      }, 600);
    });

    socket.on('error_message', (msg) => alert(msg));
  </script>
</body>
</html>
  `;
}
