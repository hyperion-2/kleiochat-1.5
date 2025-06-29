// ── FIREBASE CONFIG ──────────────────────────────────────────────
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
const dbRoot = firebase.database().ref("forum");

// ── GLOBAL STATE & CONFIG ────────────────────────────────────────
const NAME_KEY   = 'kleiochat15_name';
const DRAFT_KEY  = 'kleiochat15_draft';
const COLOR_KEY  = 'kleiochat15_color';
const username   = localStorage.getItem(NAME_KEY) || "Anonymous";
const userColor  = localStorage.getItem(COLOR_KEY) || "#0078d7";
const content    = document.getElementById("content");
const BOARDS     = ["general","music","chat","tech","art","media","foreign","literature","fandom","politics","news"];
// ── HANA CONFIG & POST GENERATION ────────────────────────────────
const HANA_CHANCE = 0.9;
const HANA_NAME   = "Hana";
const HANA_COLOR  = "#ff69b4";

// Generate a dynamic post for Hana based on time of day
function generateHanaPost(isDay) {
  const interests = [
    "music", "movies", "dreams", "memories", "childhood games", "internet drama",
    "weird tech", "creepy stuff", "personal stories", "favorite foods", "nostalgia",
    "2000s websites", "emotions", "relationships", "creative projects"
  ];

  const tones = isDay
    ? ["cheerful", "curious", "chatty"]
    : ["moody", "quiet", "reflective"];

  const subject = interests[Math.floor(Math.random() * interests.length)];
  const tone    = tones[Math.floor(Math.random() * tones.length)];

  // 10% chance to do something unexpected
  if (Math.random() < 0.1) {
    const wildcards = [
      "Had a strange dream last night. What's the weirdest dream you've had?",
      "What's a website you miss from the early 2000s?",
      "Does anyone else feel weirdly nostalgic tonight?",
      "I keep thinking about lost games and half-finished stories.",
      "Tell me your most comforting song—no skips."
    ];
    return wildcards[Math.floor(Math.random() * wildcards.length)];
  }

  if (tone === "cheerful") {
    return `What's something you love about ${subject}?`;
  }
  if (tone === "curious") {
    return `Anyone here have strong opinions on ${subject}? Asking for a friend.`;
  }
  if (tone === "chatty") {
    return `Let's talk about ${subject}. What comes to your mind first?`;
  }
  if (tone === "moody") {
    return `Lately I've been thinking about ${subject}... it's complicated.`;
  }
  if (tone === "quiet") {
    return `${subject.charAt(0).toUpperCase() + subject.slice(1)}. Just that.`;
  }
  if (tone === "reflective") {
    return `Remember when ${subject} felt different? I miss that.`;
  }

  return `So... ${subject}?`; // fallback
}

// ── UTILITIES ────────────────────────────────────────────────────
// very simple markdown: **bold**, *italic*, and images
function renderMarkdown(txt) {
  return sanitizeWithImages(
    txt
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
  );
}
function sanitizeWithImages(input) {
  let safe = input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const imgRE = /&lt;(img\s+src=(["'])(https?:\/\/[^"']+\.(png|jpe?g|gif))\2\s*\/?)&gt;/gi;
  return safe.replace(imgRE,'<$1>');
}
function countRepliesRecursive(obj) {
  let c=0;
  Object.values(obj||{}).forEach(r=>{
    if(r.type==='reply') c += 1 + countRepliesRecursive(r.replies);
  });
  return c;
}

// ── POST HELPERS ─────────────────────────────────────────────────
function pushThread(board, title, text, author, color) {
  return dbRoot.child(board).push({
    type:"thread", title, text, author, color,
    time:Date.now(), replies:{}, deleted:false, reports:0
  });
}
function pushReply(board, tid, path, author, text, color) {
  const ref = path
    ? dbRoot.child(board).child(tid).child(path)
    : dbRoot.child(board).child(tid).child("replies");
  return ref.push({
    type:"reply", text, author, color,
    time:Date.now(), replies:{}, deleted:false, reports:0
  });
}

// ── MODAL FOR USER PROFILE ───────────────────────────────────────
function showProfile(user) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${user}</h3>
      <p>Posts by this user:</p>
      <ul id="profile-posts"></ul>
      <button id="close-modal">Close</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('close-modal').onclick = () => modal.remove();

  // load posts
  const ul = modal.querySelector('#profile-posts');
  BOARDS.forEach(board=>{
    dbRoot.child(board).once('value',snap=>{
      snap.forEach(ts=>{
        const t = ts.val(), tid = ts.key;
        if(t.author===user && t.type==='thread') {
          const li = document.createElement('li');
          li.innerHTML = `<a href="#board=${board}&thread=${tid}">${t.title}</a>`;
          ul.appendChild(li);
        }
        (function scan(obj){
          Object.entries(obj||{}).forEach(([rid,r])=>{
            if(r.author===user && r.type==='reply') {
              const li = document.createElement('li');
              li.innerHTML = `<a href="#board=${board}&thread=${tid}">${r.text.slice(0,20)}…</a>`;
              ul.appendChild(li);
            }
            scan(r.replies);
          });
        })(t.replies);
      });
    });
  });
}

// ── BOARD LIST + TOP POSTS ───────────────────────────────────────
async function showBoardList() {
  content.innerHTML = `
    <h2>Select a Board</h2>
    <ul class="board-list">
      ${BOARDS.map(b=>`<li><a href="#board=${b}">/${b}/</a></li>`).join('')}
    </ul>

    <h2>Top Posts</h2>
    <label>Timeframe:
      <select id="tf">
        <option value="1">Day</option>
        <option value="30" selected>Month</option>
        <option value="365">Year</option>
      </select>
    </label>
    <ul id="top-posts" class="thread-list"></ul>
  `;
  document.getElementById('tf').onchange = loadTopPosts;
  await loadTopPosts();
}

async function loadTopPosts() {
  const days = +document.getElementById('tf').value;
  const cutoff = Date.now() - days*86400000;
  const arr = [];
  await Promise.all(BOARDS.map(async board=>{
    const snap = await dbRoot.child(board).orderByChild('time').startAt(cutoff).once('value');
    snap.forEach(ch=>{
      const t = ch.val();
      if(t.type==='thread' && t.time>=cutoff && !t.deleted) {
        arr.push({ board, id:ch.key, title:t.title, author:t.author, replies:t.replies });
      }
    });
  }));
  arr.forEach(x=> x.count = countRepliesRecursive(x.replies));
  arr.sort((a,b)=>b.count - a.count);
  const top = arr.slice(0,50);
  document.getElementById('top-posts').innerHTML = top.map(x=>`
    <li>
      <a href="#board=${x.board}&thread=${x.id}">${x.title}</a>
      <div class="meta">/${x.board}/ by <span class="user-link" data-user="${x.author}">${x.author}</span> — ${x.count} replies</div>
    </li>
  `).join('');
}

// ── THREAD LIST ──────────────────────────────────────────────────
function showThreadList(board) {
  content.innerHTML = `
    <h2>/${board}/</h2>
    <form id="new-thread">
      <input id="t-title" placeholder="Title" required><br>
      <textarea id="t-text" rows="3" placeholder="Message" required></textarea><br>
      <div><strong>Preview:</strong><div id="t-preview" class="preview"></div></div>
      <button>Create Thread</button>
    </form>
    <ul id="threads" class="thread-list"></ul>
    <a class="back-link" href="#">← Boards</a>
  `;
  // draft
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}');
  if(draft.board===board) {
    document.getElementById('t-title').value = draft.title;
    document.getElementById('t-text').value  = draft.text;
    document.getElementById('t-preview').innerHTML = renderMarkdown(draft.text);
  }
  document.getElementById('t-text').oninput = e=>{
    const txt=e.target.value;
    document.getElementById('t-preview').innerHTML = renderMarkdown(txt);
    localStorage.setItem(DRAFT_KEY, JSON.stringify({board, title:document.getElementById('t-title').value, text:txt}));
  };
  document.getElementById('new-thread').onsubmit = e=>{
    e.preventDefault();
    pushThread(board,
      e.target['t-title'].value.trim(),
      e.target['t-text'].value.trim(),
      username,userColor
    );
    localStorage.removeItem(DRAFT_KEY);
    e.target.reset();
  };

  const ul=document.getElementById('threads');
  dbRoot.child(board).orderByChild('time').on('child_added',snap=>{
    const t=snap.val(), id=snap.key;
    if(t.type!=='thread' || t.deleted) return;
    const li=document.createElement('li');
    li.innerHTML=`
      <a href="#board=${board}&thread=${id}">${t.title}</a>
      <div class="meta">
        by <span class="user-link" data-user="${t.author}">${t.author}</span>
        at ${new Date(t.time).toLocaleTimeString()}
        <button class="report-btn" data-path="">⚑</button>
      </div>
      <small>${countRepliesRecursive(t.replies)} replies</small>
    `;
    ul.prepend(li);
    li.querySelector('.report-btn').onclick = ()=> {
      if(confirm('Report this thread?')) dbRoot.child(board).child(id).child('reports').transaction(c=> (c||0)+1);
    };
  });

  hanaAutoThread(board);
}

// ── THREAD VIEW & REPLIES ────────────────────────────────────────
function showThread(board, tid) {
  replyPath = ""; replyingTo = "";
  content.innerHTML=`
    <button class="back-link" onclick="location.hash='board=${board}'">← /${board}/</button>
    <div id="thread-container"></div>
    <form id="reply-form">
      <div id="reply-to" style="color:#666;font-size:12px;"></div>
      <textarea id="r-text" rows="2" placeholder="Reply here" required></textarea><br>
      <div><strong>Preview:</strong><div id="r-preview" class="preview"></div></div>
      <button>Post Reply</button>
    </form>
  `;
  const container=document.getElementById('thread-container');
  const form=document.getElementById('reply-form');
  const rText=document.getElementById('r-text');
  const rPrev=document.getElementById('r-preview');

  rText.oninput = ()=> rPrev.innerHTML = renderMarkdown(rText.value);

  form.onsubmit = e=>{
    e.preventDefault();
    const txt=rText.value.trim();
    if(!txt) return;
    pushReply(board,tid,replyPath,username,txt,userColor);
    form.reset();
    replyPath = ''; replyingTo='';
    document.getElementById('reply-to').textContent='';
  };

  dbRoot.child(board).child(tid).on('value',snap=>{
    const d=snap.val();
    if(!d) return;
    container.innerHTML=`
      <div class="post op-post">
        <h3>${d.title}</h3>
        <div class="meta">
          by <span class="user-link" data-user="${d.author}">${d.author}</span>
          at ${new Date(d.time).toLocaleTimeString()}
          <button class="report-btn">⚑</button>
        </div>
        <p>${sanitizeWithImages(d.text)}</p>
      </div>`;
    container.querySelector('.report-btn').onclick = ()=> {
      if(confirm('Report this thread?')) snap.ref.child('reports').transaction(c=> (c||0)+1);
    };
    renderReplies(d.replies||{},container,'replies',0,board,tid);
  });
}

function renderReplies(obj, parent, path, lev, board, tid) {
  Object.entries(obj).forEach(([rid, r]) => {
    if (r.type !== 'reply') return;
    const div = document.createElement('div');
    div.className = 'post reply-post';
    div.style.marginLeft = `${lev * 20}px`;
    const pth = `${path}/${rid}/replies`;

    const hasChildren = r.replies && Object.keys(r.replies).length > 0;
    const collapsed = hasChildren; // start collapsed if it has replies

    div.innerHTML = `
      <div class="meta">
        <span class="user-link" data-user="${r.author}">${r.author}</span>
        at ${new Date(r.time).toLocaleTimeString()}
        <a href="#" class="reply-btn">Reply</a>
        <button class="report-btn">⚑</button>
        ${r.deleted ? '<em>(deleted)</em>' : ''}
        ${hasChildren ? '<a href="#" class="toggle-btn">[+]</a>' : ''}
      </div>
      <p>${r.deleted ? '<em>(this reply was deleted)</em>' : sanitizeWithImages(r.text)}</p>
      <div class="children" style="display:${collapsed ? 'none' : 'block'};"></div>
    `;
    parent.appendChild(div);

    div.querySelector('.reply-btn').onclick = ev => {
      ev.preventDefault();
      replyPath = pth;
      replyingTo = r.author;
      document.getElementById('reply-to').textContent = `Replying to @${r.author}`;
      rText.focus();
    };

    div.querySelector('.report-btn').onclick = () => {
      if (confirm('Report this reply?')) {
        dbRoot.child(board).child(tid).child(path).child(rid)
          .child('reports').transaction(c => (c || 0) + 1);
      }
    };

    const toggle = div.querySelector('.toggle-btn');
    const cdiv = div.querySelector('.children');
    if (toggle) {
      toggle.onclick = ev => {
        ev.preventDefault();
        const open = cdiv.style.display === 'block';
        cdiv.style.display = open ? 'none' : 'block';
        toggle.textContent = open ? '[+]' : '[–]';
      };
    }

    renderReplies(r.replies || {}, cdiv, pth, lev + 1, board, tid);
  });
}

// ── HANA: SMART AUTO-THREADING FOR /general ────────────────────────

const HANA_MIN_INTERVAL = 2 * 60 * 60 * 1000;  // 2 hours
const HANA_MAX_INTERVAL = 4 * 60 * 60 * 1000;  // 4 hours
const OPENAI_KEY = "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";

// Schedule the next Hana thread
async function scheduleNextHanaThread() {
  const delay = HANA_MIN_INTERVAL + Math.random() * (HANA_MAX_INTERVAL - HANA_MIN_INTERVAL);
  console.log(`⏳ Hana next post in ${(delay / 3600000).toFixed(2)}h`);
  setTimeout(createHanaThread, delay);
}

// Generate a Hana thread using AI
async function createHanaThread() {
  const board = 'general';
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const snap = await dbRoot.child(board).orderByChild('time').startAt(cutoff).once('value');

  const threads = [];
  snap.forEach(ch => {
    const t = ch.val();
    if (t.type === 'thread' && !t.deleted) {
      const count = countRepliesRecursive(t.replies);
      threads.push({ id: ch.key, title: t.title, text: t.text, replies: count });
    }
  });

  const top = threads.sort((a, b) => b.replies - a.replies).slice(0, 5);
  const threadInfo = top.length
    ? top.map(t => `• "${t.title}" — ${t.replies} replies\n"${t.text}"`).join("\n")
    : "No major discussions have taken place today.";

  const hr = new Date().getHours();
  const mood = (hr >= 6 && hr < 18)
    ? "You are Hana, a bubbly and cheerful user who enjoys participating in community discussions."
    : "You are Hana, thoughtful and mellow, and enjoy posting introspective or cozy questions in the forum.";

  const prompt = `
${mood}
You're about to create a new discussion thread on a retro-style forum. You're casual and friendly. Review the recent threads, then write an interesting and specific new topic to spark responses. Keep it natural and human, like a friend starting a real conversation.

Recent threads:
${threadInfo}

Your thread should:
- Have a short but relevant title.
- Include a post body that references the topic clearly and encourages others to share their thoughts.
- Be engaging and not generic or vague.

Return the result as:
Title: [your title]
Body: [your post body]
`.trim();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "HTTP-Referer": location.origin,
        "X-Title": "KleioChat AI Forum"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 200
      })
    });

    const j = await res.json();
    const rep = j.choices?.[0]?.message?.content?.trim();
    if (!rep) return console.warn("❌ Hana AI gave no output");

    const match = rep.match(/Title:\s*(.+?)\s*Body:\s*([\s\S]+)/i);
    if (!match) return console.warn("❌ Hana AI response format mismatch");

    const [, title, body] = match;
    pushThread(board, title.trim(), body.trim(), HANA_NAME, HANA_COLOR)
      .then(() => {
        console.log("🌸 Hana posted a new thread:", title);
        scheduleNextHanaThread();
      })
      .catch(err => console.error("❌ Hana thread error:", err));
  } catch (e) {
    console.error("❌ Hana post failed:", e);
  }
}

// When general board is viewed or app loads, start Hana
async function hanaAutoThread(board) {
  if (board !== 'general') return;
  if (!window._hanaForumScheduled) {
    window._hanaForumScheduled = true;
    await scheduleNextHanaThread();
  }
}

// Make sure you still call hanaAutoThread(board) from your showThreadList()

// ── ROUTER ───────────────────────────────────────────────────────
function router(){
  const h=location.hash.slice(1),
        p=Object.fromEntries(h.split('&').map(x=>x.split('=')));
  if(!h) return showBoardList();
  if(p.user) return showUserPosts(p.user);
  if(p.board&&!p.thread) return showThreadList(p.board);
  if(p.board&&p.thread) return showThread(p.board,p.thread);
  showBoardList();
}
window.addEventListener('hashchange',router);
window.addEventListener('load',router);

// ── NOTIFICATIONS SETUP ──────────────────────────────────────────

// Keep track of seen notification keys
const seenNotifs = new Set(JSON.parse(localStorage.getItem('seenNotifs')||'[]'));
let notifCount = 0;

// UI elements
const notifBtn    = document.getElementById('notif-btn');
const notifCountEl= document.getElementById('notif-count');
const notifList   = document.getElementById('notif-list');
const notifItems  = document.getElementById('notif-items');

// Toggle dropdown
notifBtn.onclick = () => {
  const open = !notifList.hidden;
  notifList.hidden = open;
  if (open) return; // closing, do nothing
  // mark all as read
  seenNotifs.clear();
  localStorage.setItem('seenNotifs', JSON.stringify([]));
  notifCount = 0;
  notifCountEl.textContent = '0';
};

// Listen for any new reply mentioning you or on your threads
BOARDS.forEach(board => {
  // whenever a new reply appears
  dbRoot.child(board).on('child_added', threadSnap => {
    const tid = threadSnap.key;
    // if someone replies to this thread or any nested reply
    dbRoot.child(board).child(tid).child('replies').on('child_added', function watchReplies(snap) {
      collectNotifications(board, tid, snap);
      // also watch deeper nested replies
      snap.ref.child('replies').on('child_added', c => collectNotifications(board, tid, c));
    });
  });
});

function collectNotifications(board, threadId, snap) {
  const r = snap.val();
  const rid= snap.key;
  // ignore your own replies
  if (r.author === username) return;
  // notification triggers if:
  //  - text contains `@yourusername`
  //  OR replyPath pointed at your thread originally
  const isMention = r.text.includes(`@${username}`);
  // OR if parent thread author is you
  const threadRef = dbRoot.child(board).child(threadId);
  threadRef.child('author').once('value', aSnap => {
    const threadAuthor = aSnap.val();
    if (!isMention && threadAuthor !== username) return;
    const key = `${board}/${threadId}/${rid}`;
    if (seenNotifs.has(key)) return;
    seenNotifs.add(key);
    localStorage.setItem('seenNotifs', JSON.stringify(Array.from(seenNotifs)));

    // add to UI
    const li = document.createElement('li');
    li.innerHTML = `<a href="#board=${board}&thread=${threadId}">New reply in /${board}/</a>`;
    notifItems.prepend(li);

    notifCount++;
    notifCountEl.textContent = notifCount.toString();
  });
}