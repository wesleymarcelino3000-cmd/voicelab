"use client";

import { useEffect, useState } from "react";
import { AudioLines, Upload, Sparkles, Download, Trash2, ShieldCheck } from "lucide-react";

const LS_KEY = "voicelab_authorized_voices_v2";
const DB_NAME = "voicelab-audio-db";
const STORE = "samples";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putSample(id, file) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getSample(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteSample(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export default function Home() {
  const [voices, setVoices] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    setVoices(saved);
    if (saved[0]) setSelectedVoiceId(saved[0].id);
  }, []);

  function saveVoices(next) {
    setVoices(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }

  async function addAuthorizedVoice() {
    if (!authorized) return setMessage("Confirme que a voz é sua ou que você possui autorização expressa para usá-la.");
    if (!name.trim() || !file) return setMessage("Informe um nome e selecione uma amostra de áudio.");

    setLoading(true);
    setMessage("");
    try {
      const id = crypto.randomUUID();
      await putSample(id, file);
      const voice = { id, name: name.trim(), fileName: file.name };
      const next = [voice, ...voices];
      saveVoices(next);
      setSelectedVoiceId(id);
      setName("");
      setFile(null);
      setAuthorized(false);
      setMessage("Voz salva neste dispositivo com sucesso.");
    } catch (e) {
      setMessage(e.message || "Não foi possível salvar a amostra.");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!selectedVoiceId || !text.trim()) return setMessage("Selecione uma voz e digite uma mensagem.");
    setLoading(true);
    setMessage("");
    try {
      const reference = await getSample(selectedVoiceId);
      if (!reference) throw new Error("A amostra dessa voz não foi encontrada neste dispositivo.");

      const form = new FormData();
      form.append("text", text.trim());
      form.append("reference", reference, reference.name || "reference.wav");

      const res = await fetch("/api/speech", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível gerar o áudio.");
      }

      const blob = await res.blob();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
      setMessage("Áudio gerado com sucesso.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeVoice(id) {
    await deleteSample(id).catch(() => {});
    const next = voices.filter(v => v.id !== id);
    saveVoices(next);
    if (selectedVoiceId === id) setSelectedVoiceId(next[0]?.id || "");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo"><AudioLines size={24}/></div><div><strong>VoiceLab</strong><span>Chatterbox Multilingual</span></div></div>
        <div className="safe"><ShieldCheck size={16}/> somente uso autorizado</div>
      </header>

      <section className="hero">
        <p className="eyebrow">Estúdio de voz por IA</p>
        <h1>Salve uma voz autorizada e transforme texto em áudio.</h1>
        <p>A amostra fica salva no seu próprio dispositivo e é enviada ao motor de áudio somente quando você gerar uma mensagem.</p>
      </section>

      <section className="panel">
        <h2>1. Salvar voz autorizada</h2>
        <div className="field"><label>Nome da voz</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Minha voz" /></div>
        <div className="field"><label>Amostra de áudio</label><label className="dropzone"><Upload size={24}/><strong>{file ? file.name : "Selecionar áudio"}</strong><span>Prefira de 10 a 30 segundos de fala limpa, sem música de fundo.</span><input type="file" accept="audio/*" onChange={e => setFile(e.target.files?.[0] || null)} /></label></div>
        <label className="consent"><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} /><span>Confirmo que esta voz é minha ou que tenho autorização expressa da pessoa para utilizá-la.</span></label>
        <button className="primary" onClick={addAuthorizedVoice} disabled={loading}>Salvar voz</button>
      </section>

      <section className="panel gapTop">
        <h2>2. Gerar áudio</h2>
        <div className="field"><label>Voz salva</label><select value={selectedVoiceId} onChange={e => setSelectedVoiceId(e.target.value)}><option value="">Selecione</option>{voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div className="field"><label>Mensagem</label><textarea value={text} onChange={e => setText(e.target.value)} maxLength={3000} placeholder="Digite o texto que será falado..." /></div>
        <button className="primary" onClick={generate} disabled={loading}><Sparkles size={18}/> {loading ? "Processando..." : "Gerar áudio"}</button>
        {audioUrl && <div className="audioCard"><audio controls src={audioUrl}/><a className="download" href={audioUrl} download="voicelab.wav"><Download size={17}/> Baixar áudio</a></div>}
      </section>

      <section className="panel gapTop">
        <h2>Vozes salvas neste dispositivo</h2>
        <div className="voiceGrid">{voices.length === 0 ? <div className="empty">Nenhuma voz cadastrada.</div> : voices.map(v => <div className="voiceCard" key={v.id}><div className="avatar"><AudioLines size={21}/></div><div className="voiceMeta"><strong>{v.name}</strong><span>{v.fileName || "voz autorizada"}</span></div><button className="iconBtn" onClick={() => removeVoice(v.id)}><Trash2 size={16}/></button></div>)}</div>
      </section>

      {message && <div className="toast">{message}</div>}
      <footer>Use apenas sua própria voz ou vozes de pessoas que tenham autorizado expressamente o uso.</footer>
    </main>
  );
}
