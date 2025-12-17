import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyClINZcNN-ULMNa0IXb1Oh8dRUyM6XLYwU",
  authDomain: "jml-hesap.firebaseapp.com",
  projectId: "jml-hesap",
  storageBucket: "jml-hesap.firebasestorage.app",
  messagingSenderId: "329153387130",
  appId: "1:329153387130:web:c3f9224cabb57488a9b9c3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM
const cName = document.getElementById("cName");
const cText = document.getElementById("cText");
const cSend = document.getElementById("cSend");
const cStatus = document.getElementById("cStatus");
const cList = document.getElementById("cList");

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function setStatus(msg){ if(cStatus) cStatus.textContent = msg; }

async function ensureAuth(){
  try{
    if(auth.currentUser) return auth.currentUser;
    setStatus("Bağlanıyor…");
    const res = await signInAnonymously(auth);
    setStatus("Bağlandı. Yorum yazabilirsin.");
    return res.user;
  }catch(err){
    console.error(err);
    setStatus("Bağlanamadı (Auth kapalı olabilir).");
    throw err;
  }
}

async function sendComment(){
  const name = (cName?.value || "").trim().slice(0, 40);
  const text = (cText?.value || "").trim().slice(0, 500);

  if(!text){
    setStatus("Yorum boş olamaz.");
    return;
  }

  try{
    await ensureAuth();
    await addDoc(collection(db, "comments"), {
      name: name || "Anonim",
      text,
      createdAt: serverTimestamp(),
      ua: navigator.userAgent || ""
    });
    if(cText) cText.value = "";
    setStatus("Gönderildi ✅");
    setTimeout(() => setStatus("Bağlandı. Yorum yazabilirsin."), 900);
  }catch(err){
    console.error(err);
    setStatus("Gönderilemedi (Rules/Auth).");
  }
}

cSend?.addEventListener("click", sendComment);
cText?.addEventListener("keydown", (e) => {
  if(e.key === "Enter") sendComment();
});

function renderList(docs){
  if(!cList) return;
  if(docs.length === 0){
    cList.innerHTML = "Henüz yorum yok.";
    return;
  }

  cList.innerHTML = docs.map(d => {
    const data = d.data();
    const n = esc(data.name || "Anonim");
    const t = esc(data.text || "");
    let time = "";
    try{
      const dt = data.createdAt?.toDate?.();
      if(dt) time = new Intl.DateTimeFormat("tr-TR", { dateStyle:"short", timeStyle:"short" }).format(dt);
    }catch{}
    return `
      <div class="listItem">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <b>${n}</b>
          <span style="color:rgba(255,255,255,.45);font-size:12px">${esc(time)}</span>
        </div>
        <div style="margin-top:6px;color:rgba(255,255,255,.88);line-height:1.5">${t}</div>
      </div>
    `;
  }).join("");
}

(async () => {
  try{
    await ensureAuth();
    const q = query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(q, (snap) => {
      renderList(snap.docs);
    }, (err) => {
      console.error(err);
      setStatus("Yorumlar alınamadı (Rules).");
      if(cList) cList.textContent = "Kur verisi yok.";
    });
  }catch{
    // status already set
  }
})();
