"use client";

import { useEffect, useState } from "react";
import { AudioLines, Upload, Sparkles, Download, Trash2, ShieldCheck } from "lucide-react";

const LS_KEY = "voicelab_authorized_voices_v1";

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
    if (saved[0]) setSelectedVoiceId(saved[0].voiceId);
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
      const form = new FormData();
      form.append("name", name.trim());
      form.append("file", file);
      const res = await fetch("/api/voices/clone", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível cadastrar a voz.");

      const voice = { id: crypto.randomUUID(), name: name.trim(), voiceId: data.voiceId };
      const next = [voice, ...voices];
      saveVoices(next);
      setSelectedVoiceId(voice.voiceId);
      setName("");
      setFile(null);
      setAuthorized(false);
      setMessage("Voz autorizada cadastrada com sucesso.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!selectedVoiceId || !text.trim()) return setMessage("Selecione uma voz e digite uma mensagem.");
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: selectedVoiceId, text: text.trim() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível gerar o áudio.");
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      setMessage("Áudio gerado com sucesso.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }

  function removeVoice(id) {
    const next = voices.filter(v => v.id !== id);
    saveVoices(next);
    if (!next.some(v => v.voiceId === selectedVoiceId)) setSelectedVoiceId(next[0]?.voiceId || "");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo"><AudioLines size={24}/></div><div><strong>VoiceLab</strong><span>Estúdio de voz autorizada</span></div></div>
        <div className="safe"><ShieldCheck size={16}/> somente uso autorizado</div>
      </header>

      <section className="hero">
        <p className="eyebrow">Estúdio de voz por IA</p>
        <h1>Salve sua voz e transforme texto em áudio.</h1>
        <p>Cadastre uma amostra da sua própria voz, ou de uma voz que você tenha autorização expressa para utilizar, e reutilize em novas mensagens.</p>
      </section>

      <section className="panel">
        <h2>1. Cadastrar voz autorizada</h2>
        <div className="field"><label>Nome da voz</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Minha voz" /></div>
        <div className="field"><label>Amostra de áudio</label><label className="dropzone"><Upload size={24}/><strong>{file ? file.name : "Selecionar áudio"}</strong><span>Use uma gravação limpa, sem música de fundo.</span><input type="file" accept="audio/*" onChange={e => setFile(e.target.files?.[0] || null)} /></label></div>
        <label className="consent"><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} /><span>Confirmo que esta voz é minha ou que tenho autorização expressa da pessoa para utilizá-la.</span></label>
        <button className="primary" onClick={addAuthorizedVoice} disabled={loading}>Cadastrar voz</button>
      </section>

      <section className="panel gapTop">
        <h2>2. Gerar áudio</h2>
        <div className="field"><label>Voz salva</label><select value={selectedVoiceId} onChange={e => setSelectedVoiceId(e.target.value)}><option value="">Selecione</option>{voices.map(v => <option key={v.id} value={v.voiceId}>{v.name}</option>)}</select></div>
        <div className="field"><label>Mensagem</label><textarea value={text} onChange={e => setText(e.target.value)} maxLength={5000} placeholder="Digite o texto que será falado..." /></div>
        <button className="primary" onClick={generate} disabled={loading}><Sparkles size={18}/> {loading ? "Processando..." : "Gerar áudio"}</button>
        {audioUrl && <div className="audioCard"><audio controls src={audioUrl}/><a className="download" href={audioUrl} download="voicelab.mp3"><Download size={17}/> Baixar MP3</a></div>}
      </section>

      <section className="panel gapTop">
        <h2>Vozes salvas</h2>
        <div className="voiceGrid">{voices.length === 0 ? <div className="empty">Nenhuma voz cadastrada.</div> : voices.map(v => <div className="voiceCard" key={v.id}><div className="avatar"><AudioLines size={21}/></div><div className="voiceMeta"><strong>{v.name}</strong><span>voz autorizada</span></div><button className="iconBtn" onClick={() => removeVoice(v.id)}><Trash2 size={16}/></button></div>)}</div>
      </section>

      {message && <div className="toast">{message}</div>}
      <footer>Use apenas sua própria voz ou vozes de pessoas que tenham autorizado expressamente o uso.</footer>
    </main>
  );
}
