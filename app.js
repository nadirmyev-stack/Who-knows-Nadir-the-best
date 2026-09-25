let ws = null;
let me = null;
let state = null;
let answered = false;
let tick = null;

const $ = id => document.getElementById(id);

function connect() {
  ws = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = e => {
    const m = JSON.parse(e.data);

    if (m.type === 'joined') {
      me = m.id;
      state = m.state;
      showState();
    }

    if (m.type === 'state') {
      state = m.state;
      showState();
    }

    if (m.type === 'answerAccepted') {
      answered = true;
      renderAnswer(m.choice, m.correct);
    }

    if (m.type === 'leaderboard') {
      if (state) {
        state.leaderboard = m.leaderboard;
      }
    }
  };

  ws.onerror = error => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
}

function send(o) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(o));
  }
}

function show(id) {
  document
    .querySelectorAll('.screen')
    .forEach(x => x.classList.remove('active'));

  const element = $(id);

  if (element) {
    element.classList.add('active');
  }
}

function showState() {
  if (!state) return;

  if (state.phase === 'lobby') {
    show('join');
    return;
  }

  if (state.phase === 'final') {
    show('final');
    renderFinal();
    return;
  }

  show('quiz');
  renderQuestion();
}

function renderQuestion() {
  if (!state || !state.question) return;

  $('progress').textContent =
    `${state.qIndex + 1} / ${state.total}`;

  $('qnum').textContent =
    `SUAL ${String(state.qIndex + 1).padStart(2, '0')}`;

  $('question').textContent =
    state.question.text;

  $('feedback').textContent = '';
  $('feedback').className = 'feedback';

  $('options').innerHTML = '';

  answered = state.phase !== 'question';

  state.question.options.forEach((opt, i) => {
    const b = document.createElement('button');

    b.className = 'option';
    b.textContent = opt;

    b.disabled = state.phase !== 'question';

    b.onclick = () => {
      if (answered) return;

      answered = true;

      [
        ...$('options').children
      ].forEach(x => {
        x.disabled = true;
      });

      b.classList.add('selected');

      send({
        type: 'answer',
        choice: i
      });
    };

    $('options').appendChild(b);
  });

  /*
    Düzgün cavab yalnız reveal mərhələsində,
    yəni 15 saniyə bitdikdən sonra göstərilir.
  */
  if (state.phase === 'reveal') {
    [
      ...$('options').children
    ].forEach((b, i) => {
      if (i === state.revealCorrect) {
        b.classList.add('correct');
      }
    });

    $('feedback').textContent =
      'Düzgün cavab göstərilir.';

    $('feedback').className =
      'feedback correct';
  }

  clearInterval(tick);

  const start = state.questionStartedAt;

  function timer() {
    if (!start) return;

    const left = Math.max(
      0,
      15 - (Date.now() - start) / 1000
    );

    $('timer').textContent =
      Math.ceil(left);

    if (left <= 0) {
      clearInterval(tick);
    }
  }

  if (state.phase === 'question') {
    timer();
    tick = setInterval(timer, 100);
  } else {
    $('timer').textContent = '0';
  }
}

function renderAnswer(choice, correct) {
  /*
    Burada cavabın düzgün/səhv olması
    istifadəçiyə dərhal göstərilmir.

    Server cavabı qəbul edir, amma nəticə yalnız
    timer bitib phase === 'reveal' olduqda
    renderQuestion() tərəfindən göstərilir.
  */

  [
    ...$('options').children
  ].forEach(b => {
    b.disabled = true;

    /*
      Seçilmiş cavabın qırmızı və ya yaşıl
      rəngə çevrilməsi burada edilmir.
    */
    if (i !== undefined) {
      // heç nə
    }
  });

  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
}

function renderFinal() {
  const rows = [
    ...(state.leaderboard || [])
  ];

  const top = rows[0];

  $('winner').innerHTML = top
    ? `
      <div class="winner-name">
        🏆 ${esc(top.name)}
      </div>
      <div class="winner-score">
        ${top.score}/${state.total} düzgün cavab ·
        ${top.totalTime}s cavab vaxtı
      </div>
    `
    : '';

  $('board').innerHTML = rows
    .map((p, i) => `
      <div class="row">
        <div class="rank">#${i + 1}</div>
        <div>${esc(p.name)}</div>
        <div class="score">
          ${p.score}/${state.total}
        </div>
        <div class="time">
          ${p.totalTime}s
        </div>
      </div>
    `)
    .join('');
}

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}


/* ================================
   OYUNA DAXİL OLMA
   ================================ */

$('joinForm').onsubmit = e => {
  e.preventDefault();

  const n = $('name').value.trim();

  if (!n) {
    $('name').focus();
    return;
  }

  /*
    Əgər əvvəlki WebSocket bağlantısı varsa,
    yeni bağlantı yaratmadan istifadə edirik.
  */
  if (
    ws &&
    (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    )
  ) {
    const wait = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        clearInterval(wait);

        send({
          type: 'join',
          name: n
        });
      }
    }, 100);

    return;
  }

  connect();

  const wait = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      clearInterval(wait);

      send({
        type: 'join',
        name: n
      });
    }
  }, 100);
};


/* ================================
   AD XANASI
   ================================ */

/*
  Burada artıq localStorage YOXDUR.

  Buna görə sayt açıldıqda input həmişə boş olacaq.
*/

$('name').value = '';


/* ================================
   YENİ OYUN
   ================================ */

$('again').onclick = () => {
  location.reload();
};
