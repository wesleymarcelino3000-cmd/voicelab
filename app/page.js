"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Upload, Sparkles, Download, Trash2, ShieldCheck, Play, Square, LogOut, History } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [voices, setVoices] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [text, setText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState("");
  const previewAudioRef = useRef(null);
  const previewUrlRef = useRef("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setVoices([]);
      setHistory([]);
      setSelectedVoiceId("");
      return;
    }
    loadVoices();
    loadHistory();
  }, [session?.user?.id]);

  async function loadVoices() {
    const { data, error } = await supabase
      .from("voices")
      .select("id,name,sample_path,original_filename,mime_type,created_at")
      .order("created_at", { ascending: false });
    if (error) return setMessage(error.message);
    setVoices(data || []);
    if (!selectedVoiceId && data?.[0]) setSelectedVoiceId(data[0].id);
  }

  async function loadHistory() {
    const { data, error } = await supabase
      .from("generations")
      .select("id,text_input,engine,status,audio_path,created_at,voice_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setHistory(data || []);
  }

  async function authenticate() {
    if (!email.trim() || password.length < 6) return setMessage("Informe um e-mail e uma senha com pelo menos 6 caracteres.");
    setLoading(true);
    setMessage("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setMessage("Cadastro criado. Confira seu e-mail para confirmar a conta.");
        else setMessage("Conta criada e conectada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setMessage("Login realizado.");
      }
    } catch (e) {
      setMessage(e.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    stopPreview();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    await supabase.auth.signOut();
  }

  function stopPreview() {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewingId("");
  }

  async function downloadVoiceBlob(voice) {
    const { data, error } = await supabase.storage.from("voice-samples").download(voice.sample_path);
    if (error) throw error;
    return data;
  }

  async function previewVoice(id) {
    if (previewingId === id) return stopPreview();
    stopPreview();
    try {
      const voice = voices.find(v => v.id === id);
      if (!voice) throw new Error("Voz não encontrada.");
      const blob = await downloadVoiceBlob(voice);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      setPreviewingId(id);
      audio.onended = stopPreview;
      await audio.play();
      window.setTimeout(() => {
        if (previewAudioRef.current === audio) stopPreview();
      }, 8000);
    } catch (e) {
      stopPreview();
      setMessage(e.message || "Não foi possível tocar a prévia.");
    }
  }

  async function addAuthorizedVoice() {
    if (!session?.user) return setMessage("Entre na sua conta primeiro.");
    if (!authorized) return setMessage("Confirme que a voz é sua ou que você possui autorização expressa para usá-la.");
    if (!name.trim() || !file) return setMessage("Informe um nome e selecione uma amostra de áudio.");

    setLoading(true);
    setMessage("");
    try {
      const ext = (file.name.split(".").pop() || "wav").replace(/[^a-zA-Z0-9]/g, "");
      const objectName = `${crypto.randomUUID()}.${ext}`;
      const path = `${session.user.id}/${objectName}`;
      const { error: uploadError } = await supabase.storage.from("voice-samples").upload(path, file, { contentType: file.type || "audio/wav", upsert: false });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.from("voices").insert({
        user_id: session.user.id,
        name: name.trim(),
        sample_path: path,
        original_filename: file.name,
        mime_type: file.type || null
      }).select().single();
      if (error) {
        await supabase.storage.from("voice-samples").remove([path]);
        throw error;
      }

      setVoices(prev => [data, ...prev]);
      setSelectedVoiceId(data.id);
      setName("");
      setFile(null);
      setAuthorized(false);
      setMessage("Voz salva na sua conta com sucesso.");
    } catch (e) {
      setMessage(e.message || "Não foi possível salvar a voz.");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!session?.user) return setMessage("Entre na sua conta primeiro.");
    if (!selectedVoiceId || !text.trim()) return setMessage("Selecione uma voz e digite uma mensagem.");
    stopPreview();
    setLoading(true);
    setMessage("");
    try {
      const voice = voices.find(v => v.id === selectedVoiceId);
      if (!voice) throw new Error("Voz não encontrada.");
      const reference = await downloadVoiceBlob(voice);
      const form = new FormData();
      form.append("text", text.trim());
      form.append("reference", reference, voice.original_filename || "reference.wav");

      const res = await fetch("/api/speech", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível gerar o áudio.");
      }

      const provider = res.headers.get("x-voice-provider") || "principal";
      const blob = await res.blob();
      const audioPath = `${session.user.id}/${crypto.randomUUID()}.wav`;
      const { error: uploadError } = await supabase.storage.from("generated-audio").upload(audioPath, blob, { contentType: blob.type || "audio/wav", upsert: false });
      if (uploadError) throw uploadError;

      const { error: historyError } = await supabase.from("generations").insert({
        user_id: session.user.id,
        voice_id: selectedVoiceId,
        text_input: text.trim(),
        engine: provider,
        audio_path: audioPath,
        status: "completed"
      });
      if (historyError) throw historyError;

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
      setMessage(provider === "reserva" ? "Áudio gerado pelo motor reserva e salvo no histórico." : "Áudio gerado pelo motor principal e salvo no histórico.");
      await loadHistory();
    } catch (e) {
      setMessage(e.message || "Não foi possível gerar o áudio.");
    } finally {
      setLoading(false);
    }
  }

  async function removeVoice(id) {
    const voice = voices.find(v => v.id === id);
    if (!voice) return;
    if (previewingId === id) stopPreview();
    setLoading(true);
    try {
      await supabase.storage.from("voice-samples").remove([voice.sample_path]);
      const { error } = await supabase.from("voices").delete().eq("id", id);
      if (error) throw error;
      const next = voices.filter(v => v.id !== id);
      setVoices(next);
      if (selectedVoiceId === id) setSelectedVoiceId(next[0]?.id || "");
      setMessage("Voz removida.");
    } catch (e) {
      setMessage(e.message || "Não foi possível remover a voz.");
    } finally {
      setLoading(false);
    }
  }

  async function playHistory(item) {
    if (!item.audio_path) return;
    try {
      const { data, error } = await supabase.storage.from("generated-audio").download(item.audio_path);
      if (error) throw error;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(data));
      setMessage("Áudio do histórico carregado no player.");
    } catch (e) {
      setMessage(e.message || "Não foi possível abrir esse áudio.");
    }
  }

  if (!session) {
    return (
      <main className="shell">
        <header className="topbar"><div className="brand"><div className="logo"><AudioLines size={24}/></div><div><strong>VoiceLab</strong><span>Conta protegida pelo Supabase</span></div></div></header>
        <section className="hero"><p className="eyebrow">Estúdio de voz por IA</p><h1>Entre para acessar suas vozes.</h1><p>Suas amostras e seus áudios ficam privados e vinculados à sua conta.</p></section>
        <section className="panel" style={{maxWidth:520}}>
          <h2>{authMode === "signup" ? "Criar conta" : "Entrar"}</h2>
          <div className="field"><label>E-mail</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
          <div className="field"><label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
          <button className="primary" onClick={authenticate} disabled={loading}>{loading ? "Processando..." : authMode === "signup" ? "Criar conta" : "Entrar"}</button>
          <button className="secondary" style={{marginLeft:8}} onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "Já tenho conta" : "Criar uma conta"}</button>
        </section>
        {message && <div className="toast">{message}</div>}
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo"><AudioLines size={24}/></div><div><strong>VoiceLab</strong><span>{session.user.email}</span></div></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><div className="safe"><ShieldCheck size={16}/> uso autorizado</div><button className="secondary" onClick={logout}><LogOut size={16}/> Sair</button></div>
      </header>

      <section className="hero"><p className="eyebrow">Estúdio de voz por IA</p><h1>Suas vozes, em qualquer dispositivo.</h1><p>As amostras e os áudios gerados agora ficam privados na sua conta do VoiceLab.</p></section>

      <section className="panel">
        <h2>1. Salvar voz autorizada</h2>
        <div className="field"><label>Nome da voz</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Minha voz" /></div>
        <div className="field"><label>Amostra de áudio</label><label className="dropzone"><Upload size={24}/><strong>{file ? file.name : "Selecionar áudio"}</strong><span>Prefira de 10 a 30 segundos de fala limpa, sem música de fundo.</span><input type="file" accept="audio/*" onChange={e => setFile(e.target.files?.[0] || null)} /></label></div>
        <label className="consent"><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} /><span>Confirmo que esta voz é minha ou que tenho autorização expressa da pessoa para utilizá-la.</span></label>
        <button className="primary" onClick={addAuthorizedVoice} disabled={loading}>Salvar voz</button>
      </section>

      <section className="panel gapTop">
        <h2>2. Gerar áudio</h2>
        <div className="field"><label>Voz salva</label><div style={{display:"flex",gap:8}}><select value={selectedVoiceId} onChange={e => { stopPreview(); setSelectedVoiceId(e.target.value); }}><option value="">Selecione</option>{voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><button className="secondary" type="button" disabled={!selectedVoiceId} onClick={() => previewVoice(selectedVoiceId)}>{previewingId === selectedVoiceId ? <><Square size={16}/> Parar</> : <><Play size={16}/> Prévia</>}</button></div></div>
        <div className="field"><label>Mensagem</label><textarea value={text} onChange={e => setText(e.target.value)} maxLength={300} placeholder="Digite o texto que será falado..." /></div>
        <div className="hint">{text.length}/300 caracteres por geração na versão gratuita.</div>
        <button className="primary" onClick={generate} disabled={loading}><Sparkles size={18}/> {loading ? "Processando..." : "Gerar áudio"}</button>
        {audioUrl && <div className="audioCard"><audio controls src={audioUrl}/><a className="download" href={audioUrl} download="voicelab.wav"><Download size={17}/> Baixar áudio</a></div>}
      </section>

      <section className="panel gapTop">
        <h2>Vozes salvas</h2>
        <div className="voiceGrid">{voices.length === 0 ? <div className="empty">Nenhuma voz cadastrada.</div> : voices.map(v => <div className="voiceCard" key={v.id}><div className="avatar"><AudioLines size={21}/></div><div className="voiceMeta"><strong>{v.name}</strong><span>{v.original_filename || "voz autorizada"}</span></div><button className="secondary" type="button" onClick={() => previewVoice(v.id)}>{previewingId === v.id ? <><Square size={15}/> Parar</> : <><Play size={15}/> Ouvir</>}</button><button className="iconBtn" onClick={() => removeVoice(v.id)}><Trash2 size={16}/></button></div>)}</div>
      </section>

      <section className="panel gapTop">
        <h2><History size={19} style={{verticalAlign:"middle",marginRight:8}}/>Histórico</h2>
        <div className="voiceGrid">{history.length === 0 ? <div className="empty">Nenhum áudio gerado ainda.</div> : history.map(item => <div className="voiceCard" key={item.id}><div className="avatar"><History size={20}/></div><div className="voiceMeta"><strong>{item.text_input.slice(0,80)}{item.text_input.length > 80 ? "..." : ""}</strong><span>{new Date(item.created_at).toLocaleString("pt-BR")} • {item.engine}</span></div><button className="secondary" onClick={() => playHistory(item)}><Play size={15}/> Ouvir</button></div>)}</div>
      </section>

      {message && <div className="toast">{message}</div>}
      <footer>Use apenas sua própria voz ou vozes de pessoas que tenham autorizado expressamente o uso.</footer>
    </main>
  );
}
