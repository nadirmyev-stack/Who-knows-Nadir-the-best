let ws, me = null, state = null;
let answered = false;
let myChoice = null;
let tick = null;

const $ = id => document.getElementById(id);


/* =========================================================
   WEBSOCKET
   ========================================================= */

function connect(){
  ws = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );

  ws.onopen = () => {};

  ws.onmessage = e => {
    const m = JSON.parse(e.data);

    /* Player joined */
    if(m.type === 'joined'){
      me = m.id;
      state = m.state;

      answered = false;
      myChoice = null;

      showState();

      localStorage.setItem(
        'nadirQuizName',
        $('name').value.trim()
      );
    }

    /* State changed */
    if(m.type === 'state'){
      state = m.state;

      /*
       * New question:
       * clear previous answer
       */
      if(state.phase === 'question'){
        answered = false;
        myChoice = null;
      }

      showState();
    }

    /*
     * IMPORTANT:
     *
     * Do NOT show correct/wrong answer here.
     *
     * Server sends answerAccepted immediately after
     * the user selects an answer, but we intentionally
     * wait until the timer finishes.
     */
    if(m.type === 'answerAccepted'){
      answered = true;
      myChoice = m.choice;

      /*
       * Do not call renderAnswer() here.
       *
       * The result will only be displayed when
       * the server changes phase to "reveal".
       */
    }

    if(m.type === 'leaderboard'){
      if(state){
        state.leaderboard = m.leaderboard;
      }
    }
  };

  ws.onclose = () => {
    /*
     * Nothing special here.
     * The page can reconnect when necessary.
     */
  };
}


/* =========================================================
   SEND
   ========================================================= */

function send(o){
  if(ws?.readyState === 1){
    ws.send(JSON.stringify(o));
  }
}


/* =========================================================
   SCREEN
   ========================================================= */

function show(id){
  document
    .querySelectorAll('.screen')
    .forEach(x => x.classList.remove('active'));

  $(id).classList.add('active');
}


/* =========================================================
   STATE
   ========================================================= */

function showState(){

  if(!state) return;

  if(state.phase === 'lobby'){
    show('join');
    return;
  }

  if(state.phase === 'final'){
    show('final');
    renderFinal();
    return;
  }

  show('quiz');
  renderQuestion();
}


/* =========================================================
   QUESTION
   ========================================================= */

function renderQuestion(){

  $('progress').textContent =
    `${state.qIndex + 1} / ${state.total}`;

  $('qnum').textContent =
    `SUAL ${String(state.qIndex + 1).padStart(2,'0')}`;

  $('question').textContent =
    state.question.text;

  $('feedback').textContent = '';
  $('feedback').className = 'feedback';

  $('options').innerHTML = '';


  /*
   * If we are already in reveal/final phase,
   * answers cannot be changed.
   */
  const isQuestion = state.phase === 'question';

  if(!isQuestion){
    answered = true;
  }


  /* =======================================================
     CREATE ANSWER BUTTONS
     ======================================================= */

  state.question.options.forEach((opt, i) => {

    const b = document.createElement('button');

    b.className = 'option';

    b.textContent = opt;

    b.disabled = !isQuestion || answered;


    b.onclick = () => {

      if(answered) return;

      answered = true;
      myChoice = i;

      /*
       * Disable all answers immediately.
       *
       * BUT:
       * do not use red/green here.
       */
      [...$('options').children].forEach(x => {
        x.disabled = true;
      });


      /*
       * Neutral selection.
       *
       * This only shows that the user selected
       * something. It does NOT indicate correct/wrong.
       */
      b.classList.add('selected');

      send({
        type:'answer',
        choice:i
      });
    };


    $('options').appendChild(b);
  });


  /* =======================================================
     REVEAL
     ======================================================= */

  if(state.phase === 'reveal'){

    const correctIndex = state.revealCorrect;

    [...$('options').children].forEach((b,i) => {

      /*
       * Correct answer becomes green.
       */
      if(i === correctIndex){
        b.classList.add('correct');
      }

      /*
       * If the player selected a wrong answer,
       * show that answer in red ONLY NOW.
       */
      if(
        myChoice !== null &&
        i === myChoice &&
        i !== correctIndex
      ){
        b.classList.remove('selected');
        b.classList.add('wrong');
      }

    });


    /*
     * Result message appears ONLY after timer ends.
     */
    if(
      myChoice !== null &&
      myChoice === correctIndex
    ){
      $('feedback').textContent = 'Düzgün cavab!';
      $('feedback').className = 'feedback correct';

    } else if(myChoice !== null){

      $('feedback').textContent = 'Səhv cavab.';
      $('feedback').className = 'feedback wrong';

    } else {

      $('feedback').textContent = 'Vaxt bitdi.';
      $('feedback').className = 'feedback';
    }
  }


  /* =======================================================
     TIMER
     ======================================================= */

  clearInterval(tick);

  const start = state.questionStartedAt;


  function timer(){

    const left = Math.max(
      0,
      15 - (Date.now() - start) / 1000
    );

    $('timer').textContent = Math.ceil(left);

    if(left <= 0){
      clearInterval(tick);
    }
  }


  if(state.phase === 'question'){

    timer();

    tick = setInterval(timer, 100);

  } else {

    $('timer').textContent = '0';
  }
}


/* =========================================================
   FINAL
   ========================================================= */

function renderFinal(){

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
        ${top.score}/${state.total}
        düzgün cavab ·
        ${top.totalTime}s cavab vaxtı
      </div>
    `
    : '';


  $('board').innerHTML =
    rows.map((p,i) => `
      <div class="row">
        <div class="rank">#${i+1}</div>
        <div>${esc(p.name)}</div>
        <div class="score">
          ${p.score}/${state.total}
        </div>
        <div class="time">
          ${p.totalTime}s
        </div>
      </div>
    `).join('');
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function esc(s){
  return s.replace(
    /[&<>"']/g,
    c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c])
  );
}


/* =========================================================
   JOIN
   ========================================================= */

$('joinForm').onsubmit = e => {

  e.preventDefault();

  const n = $('name').value.trim();

  if(!n) return;

  connect();

  const wait = setInterval(() => {

    if(ws?.readyState === 1){

      clearInterval(wait);

      send({
        type:'join',
        name:n
      });
    }

  },100);
};


/* =========================================================
   SAVED NAME
   ========================================================= */

$('name').value =
  localStorage.getItem('nadirQuizName') || '';


/* =========================================================
   AGAIN
   ========================================================= */

$('again').onclick = () => {
  location.reload();
};
