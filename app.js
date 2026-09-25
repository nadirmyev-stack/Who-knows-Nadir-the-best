let ws = null;
let me = null;
let state = null;
let answered = false;
let tick = null;

const $ = id => document.getElementById(id);


/* =========================
   WEBSOCKET
========================= */

function connect() {
  ws = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') +
    location.host
  );

  ws.onopen = () => {
    console.log('Connected');
  };

  ws.onmessage = e => {
    const m = JSON.parse(e.data);

    /* JOIN */
    if (m.type === 'joined') {
      me = m.id;
      state = m.state;

      // Adı yadda saxlamırıq.
      // Köhnə "Sabina" və s. avtomatik gəlməyəcək.

      showState();
      return;
    }

    /* STATE */
    if (m.type === 'state') {
      state = m.state;
      showState();
      return;
    }

    /* ANSWER ACCEPTED */
    if (m.type === 'answerAccepted') {
      answered = true;

      // Cavab qəbul edildi.
      // Düzgün/səhv olduğunu HƏLƏ göstərmirik.
      [...$('options').children].forEach((b, i) => {
        b.disabled = true;

        if (i === m.choice) {
          b.classList.add('selected');
        }
      });

      return;
    }

    /* LEADERBOARD */
    if (m.type === 'leaderboard') {
      if (state) {
        state.leaderboard = m.leaderboard;
      }
    }
  };

  ws.onclose = () => {
    console.log('Disconnected');
  };
}


/* =========================
   SEND
========================= */

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}


/* =========================
   SCREEN
========================= */

function show(id) {
  document
    .querySelectorAll('.screen')
    .forEach(x => x.classList.remove('active'));

  const screen = $(id);

  if (screen) {
    screen.classList.add('active');
  }
}


/* =========================
   STATE
========================= */

function showState() {
  if (!state) return;

  /*
    LOBBY:
    İştirakçı artıq qoşulubsa,
    onu WAITING səhifəsində saxlayırıq.
  */

  if (state.phase === 'lobby') {

    if (me) {
      show('waiting');
    } else {
      show('join');
    }

    return;
  }


  /*
    FINAL
  */

  if (state.phase === 'final') {
    show('final');
    renderFinal();
    return;
  }


  /*
    QUESTION / REVEAL
  */

  show('quiz');
  renderQuestion();
}


/* =========================
   QUESTION
========================= */

function renderQuestion() {

  if (!state.question) return;

  $('progress').textContent =
    `${state.qIndex + 1} / ${state.total}`;

  $('qnum').textContent =
    `SUAL ${String(state.qIndex + 1).padStart(2, '0')}`;

  $('question').textContent =
    state.question.text;

  $('feedback').textContent = '';
  $('feedback').className = 'feedback';

  $('options').innerHTML = '';

  /*
    Əgər artıq cavab verilibsə və ya reveal mərhələsidirsə,
    düymələr deaktivdir.
  */

  answered = state.phase !== 'question';


  state.question.options.forEach((opt, i) => {

    const b = document.createElement('button');

    b.className = 'option';
    b.textContent = opt;

    b.disabled = state.phase !== 'question';


    b.onclick = () => {

      if (answered) return;

      answered = true;

      /*
        Cavab seçildikdən sonra bütün cavablar kilidlənir.
      */

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


  /*
    Yalnız 15 saniyə bitdikdən sonra
    düzgün cavabı göstəririk.
  */

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


  /* TIMER */

  clearInterval(tick);

  const start = state.questionStartedAt;


  function timer() {

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


/* =========================
   FINAL
========================= */

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
        ${top.score}/${state.total} düzgün cavab
        · ${top.totalTime}s cavab vaxtı
      </div>
    `
    : '';


  $('board').innerHTML = rows
    .map((p, i) => `
      <div class="row">

        <div class="rank">
          #${i + 1}
        </div>

        <div>
          ${esc(p.name)}
        </div>

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


/* =========================
   HTML ESCAPE
========================= */

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


/* =========================
   JOIN
========================= */

$('joinForm').onsubmit = e => {

  e.preventDefault();

  const name = $('name').value.trim();

  if (!name) return;


  /*
    İştirakçi serverə qoşulur.
    ADMIN SƏHİFƏSİNƏ YÖNLƏNDİRMƏ YOXDUR.
  */

  connect();


  const wait = setInterval(() => {

    if (ws && ws.readyState === WebSocket.OPEN) {

      clearInterval(wait);

      send({
        type: 'join',
        name: name
      });
    }

  }, 100);
};


/*
  Köhnə adı avtomatik gətirmirik.
  Məsələn, "Sabina" artıq avtomatik yazılmayacaq.
*/

$('name').value = '';


/* =========================
   AGAIN
========================= */

if ($('again')) {

  $('again').onclick = () => {
    location.reload();
  };

}
