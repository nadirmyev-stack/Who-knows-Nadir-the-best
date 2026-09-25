let ws, me = null, state = null, answered = false, tick = null;

const $ = id => document.getElementById(id);

function connect() {
  ws = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );

  ws.onopen = () => {};

  ws.onmessage = e => {
    const m = JSON.parse(e.data);

    if (m.type === 'joined') {
      me = m.id;
      state = m.state;

      localStorage.setItem(
        'nadirQuizName',
        $('name').value.trim()
      );

      // Daxil olduqdan sonra admin / host səhifəsinə keç
      window.location.href = '/host.html';
    }

    if (m.type === 'state') {
      state = m.state;
      showState();
    }

    if (m.type === 'answerAccepted') {
      answered = true;

      // Cavabın düzgün/səhv olması yalnız vaxt bitəndən sonra göstərilir
      [...$('options').children].forEach((b, i) => {
        b.disabled = true;

        if (i === m.choice) {
          b.classList.add('selected');
        }
      });
    }

    if (m.type === 'leaderboard') {
      if (state) {
        state.leaderboard = m.leaderboard;
      }
    }
  };
}

function send(o) {
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify(o));
  }
}

function show(id) {
  document
    .querySelectorAll('.screen')
    .forEach(x => x.classList.remove('active'));

  $(id).classList.add('active');
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

      send({
        type: 'answer',
        choice: i
      });
    };

    $('options').appendChild(b);
  });

  // Yalnız vaxt bitəndən sonra düzgün cavabı göstər
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

  clearInterval(tick);

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

  if (state.phase === 'question') {
    timer();
    tick = setInterval(timer, 100);
  } else {
    $('timer').textContent = '0';
  }
}

function renderFinal() {
  const rows = [...(state.leaderboard || [])];

  const top = rows[0];

  $('winner').innerHTML = top
    ? `
      <div class="winner-name">
        🏆 ${esc(top.name)}
      </div>
      <div class="winner-score">
        ${top.score}/${state.total} düzgün cavab
        · ${top.totalTime}s cavab vaxtı
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


// ADINI YAZIB "QUIZƏ DAXİL OL" BASANDA
// ƏVVƏLCƏ SERVERƏ JOIN GÖNDƏRİLİR,
// SONRA AVTOMATİK HOST/ADMIN SƏHİFƏSİNƏ KEÇİLİR.
$('joinForm').onsubmit = e => {
  e.preventDefault();

  const n = $('name').value.trim();

  if (!n) return;

  connect();

  const wait = setInterval(() => {
    if (ws?.readyState === 1) {
      clearInterval(wait);

      send({
        type: 'join',
        name: n
      });
    }
  }, 100);
};


// SABİNA VƏ YA BAŞQA AD AVTOMATİK YAZILMASIN
$('name').value = '';


// YENİ OYUN
$('again').onclick = () => {
  location.reload();
};
