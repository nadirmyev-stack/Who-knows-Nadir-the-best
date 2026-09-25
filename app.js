let ws = null;
let me = null;
let state = null;
let answered = false;
let tick = null;

const $ = id => document.getElementById(id);

function show(id) {
  document.querySelectorAll('.screen').forEach(x => {
    x.classList.remove('active');
  });

  const el = $(id);
  if (el) el.classList.add('active');
}

function connectAndJoin(name) {
  console.log('Connecting...');

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = protocol + '//' + location.host;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('WebSocket connected');

    ws.send(JSON.stringify({
      type: 'join',
      name: name
    }));
  };

  ws.onmessage = e => {
    console.log('SERVER:', e.data);

    let m;

    try {
      m = JSON.parse(e.data);
    } catch (err) {
      console.error('Invalid server message:', err);
      return;
    }

    if (m.type === 'joined') {
      me = m.id;
      state = m.state;
      localStorage.setItem('nadirQuizName', name);

      console.log('JOINED:', me);

      showState();
      return;
    }

    if (m.type === 'state') {
      state = m.state;
      showState();
      return;
    }

    if (m.type === 'answerAccepted') {
      answered = true;
      renderAnswer(m.choice, m.correct);
      return;
    }

    if (m.type === 'leaderboard') {
      if (state) {
        state.leaderboard = m.leaderboard;
      }
    }
  };

  ws.onerror = error => {
    console.error('WebSocket ERROR:', error);
    alert('Serverə qoşulmaq mümkün olmadı. Bir neçə saniyə sonra yenidən yoxla.');
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
  };
}

function showState() {
  if (!state) return;

  console.log('STATE:', state.phase);

  if (state.phase === 'lobby') {
    show('quiz');

    $('progress').textContent = '';
    $('qnum').textContent = 'HAZIRSAN?';
    $('question').textContent =
      'Aparıcının oyunu başlatması gözlənilir...';

    $('options').innerHTML = '';
    $('feedback').textContent = '';
    $('timer').textContent = '15';

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

      [...$('options').children].forEach(x => {
        x.disabled = true;
      });

      b.classList.add('selected');

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'answer',
          choice: i
        }));
      }
    };

    $('options').appendChild(b);
  });

  clearInterval(tick);

  if (state.phase === 'question' && state.questionStartedAt) {
    const start = state.questionStartedAt;

    function timer() {
      const left = Math.max(
        0,
        15 - (Date.now() - start) / 1000
      );

      $('timer').textContent = Math.ceil(left);

      if (left <= 0) {
        clearInterval(tick);
      }
    }

    timer();
    tick = setInterval(timer, 100);
  } else {
    $('timer').textContent = '0';
  }

  if (state.phase === 'reveal') {
    [...$('options').children].forEach((b, i) => {
      if (i === state.revealCorrect) {
        b.classList.add('correct');
      }
    });

    $('feedback').textContent =
      'Düzgün cavab yuxarıda göstərilib.';

    $('feedback').className =
      'feedback correct';
  }
}

function renderAnswer(choice, correct) {
  [...$('options').children].forEach((b, i) => {
    b.disabled = true;

    if (i === choice && !correct) {
      b.classList.add('wrong');
    }

    if (
      state &&
      state.revealCorrect !== null &&
      i === state.revealCorrect
    ) {
      b.classList.add('correct');
    }
  });

  $('feedback').textContent =
    correct ? 'Düzgün cavab!' : 'Səhv cavab.';

  $('feedback').className =
    'feedback ' + (correct ? 'correct' : 'wrong');
}

function renderFinal() {
  const rows = state.leaderboard || [];
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

  $('board').innerHTML = rows.map((p, i) => `
    <div class="row">
      <div class="rank">#${i + 1}</div>
      <div>${esc(p.name)}</div>
      <div class="score">${p.score}/${state.total}</div>
      <div class="time">${p.totalTime}s</div>
    </div>
  `).join('');
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

/* JOIN */
document.getElementById('joinForm').addEventListener(
  'submit',
  function(e) {
    e.preventDefault();

    const name = $('name').value.trim();

    if (!name) {
      alert('Adını yaz');
      return;
    }

    const button = this.querySelector('button');

    button.disabled = true;
    button.textContent = 'QOŞULUR...';

    connectAndJoin(name);
  }
);

/* əvvəlki adı göstər */
$('name').value='';

/* yeni oyun */
$('again').onclick = () => {
  location.reload();
};
