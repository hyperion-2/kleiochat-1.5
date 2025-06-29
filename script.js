// ── 1) FIREBASE CONFIG ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAKxyTliZpkjfiMwM1Og4F_BT9SGvfFcBs",
  authDomain: "kleiochat-15.firebaseapp.com",
  databaseURL: "https://kleiochat-15-default-rtdb.firebaseio.com",
  projectId: "kleiochat-15",
  storageBucket: "kleiochat-15.appspot.com",
  messagingSenderId: "666389347160",
  appId: "1:666389347160:web:3bd3fe925df8bb6488c32d"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database().ref('messages');

// ── 2) ELEMENTS & STATE ─────────────────────────────────────────────
const nameInput    = document.getElementById('name');
const textInput    = document.getElementById('text');
const sendBtn      = document.getElementById('send-text');
const messagesDiv  = document.getElementById('messages');
const typingInd    = document.getElementById('typing-indicator');

const NAME_KEY     = 'kleiochat15_name';
const COLOR_KEY    = 'kleiochat15_color';
const MAX_NAME_LEN = 12;
const MAX_MSG_LEN  = 200;

// ── 3) USERNAME LOCK-IN + UNIQUE SUFFIX ────────────────────────────
async function pickUniqueName(base) {
  // truncate
  let name = base.slice(0, MAX_NAME_LEN);
  // fetch all existing names
  const snap = await db.once('value');
  const used = new Set();
  snap.forEach(c => used.add(c.val().name));
  if (!used.has(name)) return name;
  // try suffixes
  for (let i=1; i<=999; i++) {
    const candidate = `${name.slice(0, MAX_NAME_LEN - (`_${i}`).length)}_${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}

(async()=>{
  const saved = localStorage.getItem(NAME_KEY);
  if (saved) {
    nameInput.value = saved;
    nameInput.disabled = true;
    nameInput.style.opacity = 0.6;
  }
})();

// ── 4) COLOR PALETTE ─────────────────────────────────────────────────
const OCEAN = [
  "#A7E7E5","#8CE7E6","#6FD8D6","#4CCCCC","#00CED1",
  "#48D1CC","#20B2AA","#5F9EA0","#70DBDB","#ACE5EE",
  "#AFEEEE","#B0E0E6","#87CEEB","#87CEFA","#BFEFFF",
  "#E0FFFF","#D1EEEE","#A0E7E5","#E6E6FA","#D8BFD8","#DDA0DD"
];
let userColor = localStorage.getItem(COLOR_KEY);
if (!userColor || !OCEAN.includes(userColor)) {
  userColor = OCEAN[Math.floor(Math.random()*OCEAN.length)];
  localStorage.setItem(COLOR_KEY, userColor);
}

// ── 5) RATE LIMIT ─────────────────────────────────────────────────────
let times = [];
function canSend() {
  const now = Date.now();
  times = times.filter(t=> now - t < 10000);
  return times.length < 3;
}
function recordSend() { times.push(Date.now()); }

// ── 6) TYPING INDICATOR ──────────────────────────────────────────────
let localTO;
function showTyping(on, who="") {
  typingInd.style.display = on ? 'block' : 'none';
  typingInd.textContent = on
    ? (who ? `${who} is typing…` : `typing…`)
    : '';
}
textInput.addEventListener('input', () => {
  showTyping(true);
  clearTimeout(localTO);
  localTO = setTimeout(()=> showTyping(false), 1500);
});

// ── 7) WRAP TEXT HELPER ─────────────────────────────────────────────
function wrapText(str, n=80) {
  return str.match(new RegExp('.{1,'+n+'}', 'g')).join('\n');
}

// ── 8) SEND MESSAGE HANDLER ─────────────────────────────────────────
sendBtn.onclick = async () => {
  let name = nameInput.value.trim();
  let text = textInput.value.trim();

  if (!name) { alert("Enter your name"); return; }
  if (text.toLowerCase()==="undefined") return;
  if (text.length > MAX_MSG_LEN) { alert("Message too long"); return; }
  if (!canSend()) { alert("Rate limit: 3 msgs/10s"); return; }

  // pick unique if first time
  if (!localStorage.getItem(NAME_KEY)) {
    const unique = await pickUniqueName(name);
    if (!unique) { alert("Name taken 999 times"); return; }
    name = unique;
    localStorage.setItem(NAME_KEY, name);
    nameInput.value = name;
    nameInput.disabled = true;
    nameInput.style.opacity = 0.6;
  }

  recordSend();
  db.push({
    type: 'text',
    name,
    text: wrapText(text, n=80),
    color: userColor,
    time: Date.now()
  });
  textInput.value = '';
  showTyping(false);
};

// ── 9) DISPLAY MESSAGES ──────────────────────────────────────────────
db.on('child_added', snap => {
  showTyping(false);
  const { type, name, text, color, time } = snap.val();
  if (type !== 'text') return;
  const t = new Date(time).toLocaleTimeString();
  const el = document.createElement('div');
  el.style.color = color;
  el.style.whiteSpace = 'pre-wrap';
  el.style.wordBreak = 'break-word';
  el.innerText = `[${t}] ${name}: ${text}`;
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// ── 10) HANA AI ───────────────────────────────────────────────────────
const HANA_NAME   = "Hana";
const HANA_COLOR  = "#ff69b4";
const OPENAI_KEY  = "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";
const HANA_CD     = 8000;

let lastHana = 0;
let lastConvUser = "";
let lastConvTime = 0;
const responded = new Set();

// Listen to latest messages
db.limitToLast(5).on('child_added', async snap => {
  const key = snap.key;
  const m = snap.val();
  const now = Date.now();

  if (m.name === HANA_NAME || m.type !== 'text') return;

  const mentioned = m.text.toLowerCase().includes('hana');
  const isFollowUp = m.name === lastConvUser && (now - lastConvTime < 2 * 60 * 1000); // 2 min window
  const shouldRespond = mentioned || isFollowUp;

  if (!shouldRespond) return;
  if (responded.has(key)) return;
  if (now - m.time > 10000 || now - lastHana < HANA_CD) return;

  responded.add(key);
  lastHana = now;
  lastConvUser = m.name;
  lastConvTime = now;

  showTyping(true, HANA_NAME);

  const hr = new Date().getHours();
  const isDay = hr >= 6 && hr < 18;
  const mood = isDay
    ? "You're Hana, a warm, upbeat chatterbot. You're friendly, energetic, and love socializing. never speak in long sentences. you can be taunting and mischievous sometimes."
    : "You're Hana, calm and dreamy. You're thoughtful and poetic, with a chill and surreal tone. never speak in long sentences. use only one or two sentences at a time.";

  const historySnap = await db.limitToLast(10).once('value');
  const messages = Object.values(historySnap.val() || {}).filter(x => x.type === 'text');
  const history = messages.map(x => `${x.name}: ${x.text}`).join("\n");

  const prompt = `
${mood}
You are talking in a nostalgic internet chatroom. You're helpful, human-like, and talk casually. Reply naturally to what the user says. Never mention your AI nature. Only reply once. Keep it short and sweet. 
Conversation:
${history}
Reply to: ${m.name}
Message: "${m.text}"
`.trim();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "HTTP-Referer": location.origin,
        "X-Title": "KleioChat AI"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0.8
      })
    });

    const j = await res.json();
    const rep = j.choices?.[0]?.message?.content?.trim();
    if (!rep) return showTyping(false);

    setTimeout(() => {
      showTyping(false);
      db.push({
        type: 'text',
        name: HANA_NAME,
        text: `[replying to ${m.name}] ${rep}`,
        color: HANA_COLOR,
        time: Date.now()
      });
    }, 1500 + Math.random() * 1500);
  } catch (e) {
    console.error("Hana error:", e);
    showTyping(false);
  }
});

document.getElementById('forum-btn').onclick = () => {
  window.location.href = 'forum.html'; // Adjust if path differs
};