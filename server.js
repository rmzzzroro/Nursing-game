const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// بنك الأسئلة (قواعد Who / Which / That في سياق التمريض)
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

// حالة اللعبة الحالية
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

app.get('/', (req, res) => {
  res.send(getHTMLContent());
});

io.on('connection', (socket) => {

  // 1. تسجيل انضمام طالب جديد
  socket.on('join_game', (playerName) => {
    const team = gameState.teamA.length <= gameState.teamB.length ? 'A' : 'B';
    const newPlayer = { id: socket.id, name: playerName, team };
    
    gameState.players.push(newPlayer);
    if (team === 'A') gameState.teamA.push(newPlayer);
    else gameState.teamB.push(newPlayer);

    socket.emit('joined_successfully', { team, name: playerName });
    io.emit('update_players', gameState.players);
  });

  // 2. بدء الجولة ودوران العجلة للاختيار العشوائي
  socket.on('start_round', () => {
    if (gameState.teamA.length === 0 || gameState.teamB.length === 0) {
      socket.emit('error_message', 'يجب انضمام طالب واحد على الأقل في كل فريق للبدء!');
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

  // 3. استقبال إجابة الطالب المختار
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

function getHTMLContent() {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>لعبة التمريض والتحدي اللغوي</title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .slot-container {
      height: 90px;
      overflow: hidden;
      position: relative;
      border-radius: 1rem;
      background: #0f172a;
    }
    .slot-reel {
      transition: transform 0.1s linear;
    }
    .slot-item {
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 800;
    }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-4 font-sans flex flex-col items-center justify-center">

  <!-- واجهة الهاتف للطالب -->
  <div id="playerView" class="w-full max-w-md bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 hidden">
    <div id="loginForm" class="space-y-4">
      <div class="text-center">
        <span class="text-5xl">🩺</span>
        <h2 class="text-2xl font-bold mt-2 text-blue-400">انضمام لسباق التمريض</h2>
        <p class="text-xs text-slate-400 mt-1">تحدي قواعد Who, Which, That</p>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">اسم الطالب / الطالبة:</label>
        <input id="nameInput" type="text" placeholder="أدخل اسمك..." class="w-full p-3.5 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-blue-500">
      </div>
      <button onclick="joinGame()" class="w-full bg-blue-600 hover:bg-blue-500 py-3.5 rounded-xl font-bold text-lg shadow-lg">
        🚀 دخول اللعبة
      </button>
    </div>

    <div id="waitScreen" class="hidden text-center py-6 space-y-4">
      <div class="text-2xl font-bold">مرحباً <span id="pName" class="text-blue-400"></span></div>
      <div id="pTeamBadge" class="inline-block px-4 py-1.5 rounded-full text-sm font-bold"></div>
      <div class="p-6 bg-slate-700/40 rounded-2xl border border-slate-600 animate-pulse space-y-2">
        <div class="text-3xl">⏳</div>
        <p class="text-slate-300 font-medium">الرجاء النظر للشاشة الرئيسية...</p>
        <p class="text-xs text-slate-400">جاري اختيار الممثل عشوائياً!</p>
      </div>
    </div>

    <div id="gamePlayArea" class="hidden text-center space-y-4">
      <div id="turnBadge" class="p-4 rounded-2xl font-bold text-base shadow-md"></div>
      <div id="questionBox" class="bg-slate-700/70 p-5 rounded-2xl border border-slate-600 font-bold text-lg text-amber-300"></div>
      <div id="optionsContainer" class="space-y-3"></div>
    </div>
  </div>

  <!-- واجهة الشاشة الرئيسية (البروجكتور) -->
  <div id="displayView" class="w-full max-w-4xl bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
    <div class="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
      <div class="flex items-center gap-3">
        <span class="text-4xl">💉</span>
        <div>
          <h1 class="text-2xl font-black text-blue-400">تحدي قواعد التمريض واللغة الإنجليزية</h1>
          <p class="text-xs text-slate-400">قواعد الضمائر الموصولة: Who / Which / That</p>
        </div>
      </div>
      <button onclick="switchRole()" class="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl border border-slate-600">
        🔄 تبديل الواجهة (هاتف / شاشة)
      </button>
    </div>

    <div class="grid grid-cols-2 gap-6 mb-6">
      <div class="bg-red-950/30 border-2 border-red-500/40 p-5 rounded-2xl">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-xl font-black text-red-400">🔴 الفريق الأحمر</h3>
          <span id="scoreA" class="text-3xl font-black text-red-400">0 نقطة</span>
        </div>
        <div class="slot-container border border-red-500/50 mb-3">
          <div id="reelA" class="slot-reel">
            <div class="slot-item text-red-400">في انتظار الانضمام... 🎲</div>
          </div>
        </div>
        <div id="playersA" class="text-xs text-slate-300 flex flex-wrap gap-1"></div>
      </div>

      <div class="bg-blue-950/30 border-2 border-blue-500/40 p-5 rounded-2xl">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-xl font-black text-blue-400">🔵 الفريق الأزرق</h3>
          <span id="scoreB" class="text-3xl font-black text-blue-400">0 نقطة</span>
        </div>
        <div class="slot-container border border-blue-500/50 mb-3">
          <div id="reelB" class="slot-reel">
            <div class="slot-item text-blue-400">في انتظار الانضمام... 🎲</div>
          </div>
        </div>
        <div id="playersB" class="text-xs text-slate-300 flex flex-wrap gap-1"></div>
      </div>
    </div>

    <div class="bg-slate-900 p-6 rounded-2xl border border-slate-700 text-center mb-6">
      <h2 id="projQuestion" class="text-2xl font-bold text-amber-300">
        انضموا للعبة عبر الرابط، ثم اضغطوا "بدء الجولة"! 🎲
      </h2>
    </div>

    <div class="flex justify-center">
      <button onclick="startRound()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black text-xl shadow-lg transition active:scale-95">
        🎰 بدء الجولة واختيار الأسماء عشوائياً
      </button>
    </div>
  </div>

  <script>
    const socket = io();
    let isPlayerMode = false;

    function switchRole() {
      isPlayerMode = !isPlayerMode;
      document.getElementById('playerView').classList.toggle('hidden', !isPlayerMode);
      document.getElementById('displayView').classList.toggle('hidden', isPlayerMode);
    }

    function joinGame() {
      const name = document.getElementById('nameInput').value.trim();
      if (!name) return alert('يرجى إدخال اسمك أولاً!');
      socket.emit('join_game', name);
    }

    socket.on('joined_successfully', (data) => {
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('waitScreen').classList.remove('hidden');
      document.getElementById('pName').innerText = data.name;
      const badge = document.getElementById('pTeamBadge');
      if (data.team === 'A') {
        badge.className = "inline-block px-4 py-1.5 rounded-full text-sm font-bold bg-red-500/20 text-red-400 border border-red-500";
        badge.innerText = "🔴 الفريق الأحمر";
      } else {
        badge.className = "inline-block px-4 py-1.5 rounded-full text-sm font-bold bg-blue-500/20 text-blue-400 border border-blue-500";
        badge.innerText = "🔵 الفريق الأزرق";
      }
    });

    socket.on('update_players', (players) => {
      const teamA = players.filter(p => p.team === 'A');
      const teamB = players.filter(p => p.team === 'B');

      document.getElementById('playersA').innerHTML = teamA.map(p => 
        \`<span class="bg-red-900/40 border border-red-700/50 px-2 py-1 rounded-lg">\${p.name}</span>\`
      ).join('');

      document.getElementById('playersB').innerHTML = teamB.map(p => 
        \`<span class="bg-blue-900/40 border border-blue-700/50 px-2 py-1 rounded-lg">\${p.name}</span>\`
      ).join('');
    });

    function startRound() {
      socket.emit('start_round');
    }

    socket.on('round_started', (data) => {
      document.getElementById('projQuestion').innerText = \`سؤال (\${data.questionNum}): \${data.question}\`;

      runSlotMachine('reelA', data.teamAPlayers, data.activeA.name, 'text-red-400');
      runSlotMachine('reelB', data.teamBPlayers, data.activeB.name, 'text-blue-400');

      const myId = socket.id;
      const isMyTurn = (data.activeA.id === myId) || (data.activeB.id === myId);

      document.getElementById('waitScreen').classList.add('hidden');
      document.getElementById('gamePlayArea').classList.remove('hidden');

      const turnBadge = document.getElementById('turnBadge');
      const optionsContainer = document.getElementById('optionsContainer');
      optionsContainer.innerHTML = '';

      if (isMyTurn) {
        turnBadge.className = "p-4 rounded-2xl font-bold text-base bg-emerald-500/20 text-emerald-300 border border-emerald-500 animate-bounce";
        turnBadge.innerText = "🔥 وقع الاختيار عليك! المسئولية عليك الآن لحماية فريقك!";
        document.getElementById('questionBox').innerText = data.question;

        data.options.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.className = "w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white p-4 rounded-2xl font-black text-lg transition shadow-md";
          btn.innerText = opt;
          btn.onclick = () => {
            socket.emit('submit_answer', idx);
            optionsContainer.innerHTML = '<div class="p-4 bg-emerald-500/20 text-emerald-300 border border-emerald-500 rounded-2xl font-bold">✅ تم إرسال إجابتك!</div>';
          };
          optionsContainer.appendChild(btn);
        });
      } else {
        turnBadge.className = "p-4 rounded-2xl font-bold text-sm bg-slate-700/60 text-slate-300 border border-slate-600";
        turnBadge.innerText = \`🎯 الممثلون المختارون:\\n🔴 الفريق الأحمر: \${data.activeA.name}\\n🔵 الفريق الأزرق: \${data.activeB.name}\`;
        optionsContainer.innerHTML = '<div class="p-4 bg-slate-800 text-slate-400 rounded-2xl animate-pulse">⏳ شجع ممثل فريقك الآن!</div>';
      }
    });

    function runSlotMachine(reelId, playersList, finalWinner, textColorClass) {
      const reel = document.getElementById(reelId);
      let names = [...playersList.map(p => p.name)];
      
      let repeatedNames = [];
      for (let i = 0; i < 12; i++) {
        repeatedNames = repeatedNames.concat(names);
      }
      repeatedNames.push(finalWinner);

      reel.innerHTML = repeatedNames.map(name => \`<div class="slot-item \${textColorClass}">\${name}</div>\`).join('');

      let currentIndex = 0;
      let speed = 35;

      function spin() {
        currentIndex++;
        reel.style.transform = \`translateY(-\${currentIndex * 90}px)\`;

        if (currentIndex < repeatedNames.length - 1) {
          if (currentIndex > repeatedNames.length - 6) speed += 50;
          setTimeout(spin, speed);
        }
      }
      spin();
    }

    socket.on('answer_received', (data) => {
      document.getElementById('scoreA').innerText = data.scores.A + ' نقطة';
      document.getElementById('scoreB').innerText = data.scores.B + ' نقطة';
    });

    socket.on('round_ended', () => {
      setTimeout(() => {
        alert('🎉 انتهت الجولة! اضغط "بدء الجولة" للسؤال التالي.');
      }, 600);
    });

    socket.on('error_message', (msg) => alert(msg));
  </script>
</body>
</html>
  `;
}
