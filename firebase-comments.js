import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ---- Firebase config ----
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

// ---- DOM ----
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
    .replaceAll("'","&#039;");
}

function showErr(prefix, err){
  console.error(prefix, err);
  const msg = (err && (err.message || err.code)) ? `${err.code ? err.code + " — " : ""}${err.message || ""}` : String(err);
  cStatus.textContent = `${prefix}: ${msg}`;
}

async function boot(){
  try{
    await signInAnonymously(auth);
    cStatus.textContent = "Bağlandı. Yorum yazabilirsin.";
  }catch(err){
    showErr("Auth hata", err);
    return;
  }

  const q = query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(50));

  onSnapshot(q, (snap) => {
    if (snap.empty){
      cList.textContent = "Henüz yorum yok.";
      return;
    }
    const items = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const name = (d.name && String(d.name).trim()) ? String(d.name).trim() : "Anonim";
      const text = String(d.text || "");
      items.push(`
        <div class="listItem">
          <b>${esc(name)}</b>
          <div style="margin-top:6px;opacity:.86;white-space:pre-wrap">${esc(text)}</div>
        </div>
      `);
    });
    cList.innerHTML = items.join("");
  }, (err) => {
    showErr("Okuma (Rules/Firestore) hata", err);
  });

  let lastSend = 0;
  cSend.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastSend < 2500){
      cStatus.textContent = "Biraz yavaş 🙂";
      return;
    }
    lastSend = now;

    const text = (cText.value || "").trim();
    const name = (cName.value || "").trim().slice(0, 40);

    if (!text) return (cStatus.textContent = "Yorum boş olamaz.");
    if (text.length > 500) return (cStatus.textContent = "Max 500 karakter.");

    try{
      await addDoc(collection(db, "comments"), {
        name,
        text,
        createdAt: serverTimestamp()
      });
      cText.value = "";
      cStatus.textContent = "Gönderildi ✅";
    }catch(err){
      showErr("Yazma (Rules) hata", err);
    }
  });
}

boot();
