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

// رابط الطالب المباشر (يدخل فوراً لشاشة إدخال الاسم)
app.get('/', (req, res) => {
  res.send(getHTMLContent(req.headers.host, 'player'));
});

// رابط البروجيكتر المخصص للشاشة الرئيسية
app.get('/projector', (req, res) => {
  res.send(getHTMLContent(req.headers.host, 'projector'));
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

  // 2. بدء الجولة ودوران العجلة
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
      
