
let ws, me=null, state=null, answered=false, tick=null;
const $=id=>document.getElementById(id);
function connect(){
  ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
  ws.onopen=()=>{};
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.type==='joined'){me=m.id;state=m.state;showState();localStorage.setItem('nadirQuizName',$('name').value.trim());}
    if(m.type==='state'){state=m.state;showState();}
    if(m.type==='answerAccepted'){answered=true;renderAnswer(m.choice,m.correct);}
    if(m.type==='leaderboard'){if(state)state.leaderboard=m.leaderboard;}
  };
}
function send(o){if(ws?.readyState===1)ws.send(JSON.stringify(o))}
function show(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));$(id).classList.add('active')}
function showState(){
  if(!state)return;

  if(state.phase==='lobby'){
    if(me){
      show('quiz');
      $('progress').textContent='';
      $('qnum').textContent='GÖZLƏYİN';
      $('question').textContent='Aparıcının oyunu başlatması gözlənilir...';
      $('options').innerHTML='';
      $('feedback').textContent='';
      $('timer').textContent='15';
    } else {
      show('join');
    }
    return;
  }
  function renderQuestion(){
  $('progress').textContent=`${state.qIndex+1} / ${state.total}`;
  $('qnum').textContent=`SUAL ${String(state.qIndex+1).padStart(2,'0')}`;
  $('question').textContent=state.question.text;
  $('feedback').textContent='';
  $('feedback').className='feedback';
  $('options').innerHTML='';
  answered = state.phase !== 'question';
  state.question.options.forEach((opt,i)=>{
    const b=document.createElement('button');b.className='option';b.textContent=opt;
    b.disabled = state.phase !== 'question';
    b.onclick=()=>{if(answered)return; answered=true; [...$('options').children].forEach(x=>x.disabled=true);b.classList.add('selected');send({type:'answer',choice:i});};
    $('options').appendChild(b);
  });
  if(state.phase === 'reveal'){
    [...$('options').children].forEach((b,i)=>{ if(i===state.revealCorrect)b.classList.add('correct'); });
    $('feedback').textContent='Düzgün cavab yuxarıda göstərilib.';
    $('feedback').className='feedback correct';
  }
  clearInterval(tick);
  const start=state.questionStartedAt;
  function timer(){const left=Math.max(0,15-(Date.now()-start)/1000);$('timer').textContent=Math.ceil(left);if(left<=0)clearInterval(tick);}
  if(state.phase==='question'){ timer(); tick=setInterval(timer,100); } else $('timer').textContent='0';
}
function renderAnswer(choice,correct){
  [...$('options').children].forEach((b,i)=>{b.disabled=true;if(i===state.revealCorrect)b.classList.add('correct');if(i===choice&&!correct)b.classList.add('wrong');});
  $('feedback').textContent=correct?'Düzgün cavab!':'Səhv cavab.';
  $('feedback').className='feedback '+(correct?'correct':'wrong');
}
function renderFinal(){
  const rows=[...(state.leaderboard||[])];
  const top=rows[0];
  $('winner').innerHTML=top?`<div class="winner-name">🏆 ${esc(top.name)}</div><div class="winner-score">${top.score}/${state.total} düzgün cavab · ${top.totalTime}s cavab vaxtı</div>`:'';
  $('board').innerHTML=rows.map((p,i)=>`<div class="row"><div class="rank">#${i+1}</div><div>${esc(p.name)}</div><div class="score">${p.score}/${state.total}</div><div class="time">${p.totalTime}s</div></div>`).join('');
}
function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('joinForm').onsubmit = e => {
  e.preventDefault();

  const n = $('name').value.trim();
  if (!n) return;

  ws = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );

  ws.onopen = () => {
    console.log('WEBSOCKET: CONNECTED');
    ws.send(JSON.stringify({
      type: 'join',
      name: n
    }));
  };

  ws.onerror = err => {
    console.error('WEBSOCKET ERROR:', err);
    alert('Serverə qoşulmaq mümkün olmadı.');
  };

  ws.onclose = () => {
    console.log('WEBSOCKET: CLOSED');
  };

  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    console.log('SERVER:', m);

    if (m.type === 'joined') {
      me = m.id;
      state = m.state;

      localStorage.setItem('nadirQuizName', n);

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
      if (state) state.leaderboard = m.leaderboard;
    }
  };
};

$('name').value = localStorage.getItem('nadirQuizName') || '';

$('again').onclick = () => location.reload();
