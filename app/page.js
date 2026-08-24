"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Upload, Sparkles, Download, Trash2, ShieldCheck, Play, Square, LogOut, History } from "lucide-react";
import { supabase } from "../lib/supabase";

const CATEGORY_LABELS = { male: "Masculinas", female: "Femininas", child: "Infantis sintéticas", character: "Personagens" };

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [voices, setVoices] = useState([]);
  const [presets, setPresets] = useState([]);
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
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session || null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (mounted) setSession(nextSession || null); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    loadPresets();
    if (!session?.user) { setVoices([]); setHistory([]); setSelectedVoiceId(""); return; }
    loadVoices(); loadHistory();
  }, [session?.user?.id]);

  async function loadPresets() {
    const { data, error } = await supabase.from("voice_presets").select("id,slug,name,category,description,sample_path,preview_path,is_active,sort_order").eq("is_active", true).order("sort_order", { ascending: true });
    if (!error) { setPresets(data || []); if (!selectedVoiceId && data?.[0]) setSelectedVoiceId(`preset:${data[0].slug}`); }
  }
  async function loadVoices() { const { data, error } = await supabase.from("voices").select("id,name,sample_path,original_filename,mime_type,created_at").order("created_at", { ascending: false }); if (error) return setMessage(error.message); setVoices(data || []); }
  async function loadHistory() { const { data, error } = await supabase.from("generations").select("id,text_input,engine,status,audio_path,created_at,voice_id").order("created_at", { ascending: false }).limit(20); if (!error) setHistory(data || []); }

  async function authenticate() {
    if (!email.trim() || password.length < 6) return setMessage("Informe um e-mail e uma senha com pelo menos 6 caracteres.");
    setLoading(true); setMessage("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session) { setSession(data.session); setMessage("Conta criada e conectada."); }
        else setMessage("Cadastro criado. Confira seu e-mail para confirmar a conta.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (!data?.session) throw new Error("Login aceito, mas a sessão não foi criada. Tente novamente.");
        setSession(data.session);
        setMessage("Login realizado.");
      }
    } catch (e) { setMessage(e.message || "Não foi possível entrar."); }
    finally { setLoading(false); }
  }

  async function logout() { stopPreview(); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(""); await supabase.auth.signOut(); setSession(null); }
  function stopPreview() { if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.currentTime=0; previewAudioRef.current=null; } if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current=""; } setPreviewingId(""); }
  async function playBlob(blob,id) { stopPreview(); const url=URL.createObjectURL(blob); previewUrlRef.current=url; const audio=new Audio(url); previewAudioRef.current=audio; setPreviewingId(id); audio.onended=stopPreview; audio.onerror=stopPreview; await audio.play(); }
  async function previewPreset(slug) { const id=`preset:${slug}`; if(previewingId===id)return stopPreview(); setMessage("Carregando prévia..."); try { const res=await fetch("/api/preset-preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug})}); if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||"Não foi possível carregar a prévia.");} await playBlob(await res.blob(),id); setMessage("Prévia carregada."); } catch(e){stopPreview();setMessage(e.message||"Não foi possível tocar a prévia.");} }
  async function downloadVoiceBlob(voice){const{data,error}=await supabase.storage.from("voice-samples").download(voice.sample_path);if(error)throw error;return data;}
  async function previewPersonalVoice(id){const key=`voice:${id}`;if(previewingId===key)return stopPreview();try{const voice=voices.find(v=>v.id===id);if(!voice)throw new Error("Voz não encontrada.");await playBlob(await downloadVoiceBlob(voice),key);}catch(e){stopPreview();setMessage(e.message||"Não foi possível tocar a prévia.");}}
  async function previewSelected(){if(!selectedVoiceId)return;if(selectedVoiceId.startsWith("preset:"))return previewPreset(selectedVoiceId.slice(7));if(selectedVoiceId.startsWith("voice:"))return previewPersonalVoice(selectedVoiceId.slice(6));}
  async function addAuthorizedVoice(){if(!session?.user)return setMessage("Entre na sua conta primeiro.");if(!authorized)return setMessage("Confirme que a voz é sua ou que você possui autorização expressa para usá-la.");if(!name.trim()||!file)return setMessage("Informe um nome e selecione uma amostra de áudio.");setLoading(true);setMessage("");try{const ext=(file.name.split(".").pop()||"wav").replace(/[^a-zA-Z0-9]/g,"");const path=`${session.user.id}/${crypto.randomUUID()}.${ext}`;const{error:uploadError}=await supabase.storage.from("voice-samples").upload(path,file,{contentType:file.type||"audio/wav",upsert:false});if(uploadError)throw uploadError;const{data,error}=await supabase.from("voices").insert({user_id:session.user.id,name:name.trim(),sample_path:path,original_filename:file.name,mime_type:file.type||null}).select().single();if(error){await supabase.storage.from("voice-samples").remove([path]);throw error;}setVoices(prev=>[data,...prev]);setSelectedVoiceId(`voice:${data.id}`);setName("");setFile(null);setAuthorized(false);setMessage("Voz salva na sua conta com sucesso.");}catch(e){setMessage(e.message||"Não foi possível salvar a voz.");}finally{setLoading(false);}}
  async function generate(){if(!session?.user)return setMessage("Entre na sua conta primeiro.");if(!selectedVoiceId||!text.trim())return setMessage("Selecione uma voz e digite uma mensagem.");stopPreview();setLoading(true);setMessage("");try{let res;let voiceIdForHistory=null;let engineLabel="preset";if(selectedVoiceId.startsWith("preset:")){const slug=selectedVoiceId.slice(7);res=await fetch("/api/preset-speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,text:text.trim()})});engineLabel=`preset:${slug}`;}else{const id=selectedVoiceId.slice(6);const voice=voices.find(v=>v.id===id);if(!voice)throw new Error("Voz não encontrada.");const reference=await downloadVoiceBlob(voice);const form=new FormData();form.append("text",text.trim());form.append("reference",reference,voice.original_filename||"reference.wav");res=await fetch("/api/speech",{method:"POST",body:form});voiceIdForHistory=id;engineLabel="clonada";}if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||"Não foi possível gerar o áudio.");}const provider=res.headers.get("x-voicelab-provider")||res.headers.get("x-voice-provider")||"chatterbox";const blob=await res.blob();const audioPath=`${session.user.id}/${crypto.randomUUID()}.wav`;const{error:uploadError}=await supabase.storage.from("generated-audio").upload(audioPath,blob,{contentType:blob.type||"audio/wav",upsert:false});if(uploadError)throw uploadError;const{error:historyError}=await supabase.from("generations").insert({user_id:session.user.id,voice_id:voiceIdForHistory,text_input:text.trim(),engine:`${engineLabel} • ${provider}`.slice(0,200),audio_path:audioPath,status:"completed"});if(historyError)throw historyError;if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioUrl(URL.createObjectURL(blob));setMessage("Áudio gerado e salvo no histórico.");await loadHistory();}catch(e){setMessage(e.message||"Não foi possível gerar o áudio.");}finally{setLoading(false);}}
  async function removeVoice(id){const voice=voices.find(v=>v.id===id);if(!voice)return;setLoading(true);try{await supabase.storage.from("voice-samples").remove([voice.sample_path]);const{error}=await supabase.from("voices").delete().eq("id",id);if(error)throw error;setVoices(prev=>prev.filter(v=>v.id!==id));if(selectedVoiceId===`voice:${id}`)setSelectedVoiceId(presets[0]?`preset:${presets[0].slug}`:"");setMessage("Voz removida.");}catch(e){setMessage(e.message||"Não foi possível remover a voz.");}finally{setLoading(false);}}
  async function playHistory(item){if(!item.audio_path)return;try{const{data,error}=await supabase.storage.from("generated-audio").download(item.audio_path);if(error)throw error;if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioUrl(URL.createObjectURL(data));setMessage("Áudio do histórico carregado no player.");}catch(e){setMessage(e.message||"Não foi possível abrir esse áudio.");}}

  if(!session)return <main className="shell"><header className="topbar"><div className="brand"><div className="logo"><AudioLines size={24}/></div><div><strong>VoiceLab</strong><span>Conta protegida pelo Supabase</span></div></div></header><section className="hero"><p className="eyebrow">Estúdio de voz por IA</p><h1>Entre para acessar suas vozes.</h1><p>Use as vozes prontas ou salve suas próprias vozes autorizadas.</p></section><section className="panel" style={{maxWidth:520}}><h2>{authMode==="signup"?"Criar conta":"Entrar"}</h2><div className="field"><label>E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" /></div><div className="field"><label>Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!loading)authenticate();}} placeholder="Mínimo 6 caracteres" /></div><button className="primary" onClick={authenticate} disabled={loading}>{loading?"Processando...":authMode==="signup"?"Criar conta":"Entrar"}</button><button className="secondary" style={{marginLeft:8}} onClick={()=>setAuthMode(authMode==="signup"?"login":"signup")}>{authMode==="signup"?"Já tenho conta":"Criar uma conta"}</button></section>{message&&<div className="toast">{message}</div>}</main>;

  return <main className="shell"><header className="topbar"><div className="brand"><div className="logo"><AudioLines size={24}/></div><div><strong>VoiceLab</strong><span>{session.user.email}</span></div></div><div style={{display:"flex",gap:8,alignItems:"center"}}><div className="safe"><ShieldCheck size={16}/> uso autorizado</div><button className="secondary" onClick={logout}><LogOut size={16}/> Sair</button></div></header><section className="hero"><p className="eyebrow">Estúdio de voz por IA</p><h1>Escolha uma voz e transforme texto em áudio.</h1><p>Você tem 20 vozes prontas com prévia, além das vozes autorizadas que salvar na sua conta.</p></section><section className="panel"><h2>1. Escolher voz</h2><div className="field"><label>Voz para gerar o áudio</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><select style={{flex:1,minWidth:220}} value={selectedVoiceId} onChange={e=>{stopPreview();setSelectedVoiceId(e.target.value);}}><option value="">Selecione</option>{Object.entries(CATEGORY_LABELS).map(([category,label])=><optgroup label={label} key={category}>{presets.filter(p=>p.category===category).map(p=><option value={`preset:${p.slug}`} key={p.id}>{p.name}</option>)}</optgroup>)}{voices.length>0&&<optgroup label="Minhas vozes">{voices.map(v=><option value={`voice:${v.id}`} key={v.id}>{v.name}</option>)}</optgroup>}</select><button className="secondary" onClick={previewSelected} disabled={!selectedVoiceId}>{previewingId===selectedVoiceId?<><Square size={16}/> Parar</>:<><Play size={16}/> Ouvir prévia</>}</button></div></div></section><section className="panel"><h2>2. Gerar fala</h2><div className="field"><label>Texto</label><textarea maxLength={300} value={text} onChange={e=>setText(e.target.value)} placeholder="Digite o texto que será falado..." /></div><div className="counter">{text.length}/300 caracteres por geração na versão gratuita.</div><button className="primary" onClick={generate} disabled={loading}><Sparkles size={18}/>{loading?"Gerando...":"Gerar áudio"}</button>{audioUrl&&<div className="audioBox"><audio controls src={audioUrl}/><a className="download" href={audioUrl} download="voicelab.wav"><Download size={16}/> Baixar áudio</a></div>}</section><section className="panel"><h2>20 vozes prontas</h2>{Object.entries(CATEGORY_LABELS).map(([category,label])=><div key={category} style={{marginTop:20}}><h3>{label}</h3><div className="voiceList">{presets.filter(p=>p.category===category).map(p=><div className="voiceItem" key={p.id}><div className="voiceIcon"><AudioLines size={22}/></div><div className="voiceInfo"><strong>{p.name}</strong><span>{p.description}</span></div><button className="secondary" onClick={()=>setSelectedVoiceId(`preset:${p.slug}`)}>Usar</button><button className="secondary" onClick={()=>previewPreset(p.slug)}>{previewingId===`preset:${p.slug}`?<><Square size={16}/> Parar</>:<><Play size={16}/> Prévia</>}</button></div>)}</div></div>)}</section><section className="panel"><h2>Adicionar minha voz autorizada</h2><p className="muted">Envie somente uma voz que seja sua ou para a qual você tenha autorização expressa do titular.</p><div className="grid"><div className="field"><label>Nome da voz</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Minha voz" /></div><div className="field"><label>Amostra de áudio</label><label className="fileButton"><Upload size={18}/>{file?file.name:"Selecionar arquivo"}<input hidden type="file" accept="audio/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label></div></div><label className="consent"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/><span>Confirmo que esta voz é minha ou que tenho autorização expressa do titular para cloná-la e utilizá-la.</span></label><button className="primary" onClick={addAuthorizedVoice} disabled={loading}>Salvar voz</button>{voices.length>0&&<div className="voiceList" style={{marginTop:20}}>{voices.map(v=><div className="voiceItem" key={v.id}><div className="voiceIcon"><AudioLines size={22}/></div><div className="voiceInfo"><strong>{v.name}</strong><span>{v.original_filename}</span></div><button className="secondary" onClick={()=>previewPersonalVoice(v.id)}><Play size={16}/> Prévia</button><button className="danger" onClick={()=>removeVoice(v.id)}><Trash2 size={16}/></button></div>)}</div>}</section><section className="panel"><h2><History size={20}/> Histórico</h2>{history.length===0?<p className="muted">Nenhum áudio gerado ainda.</p>:<div className="historyList">{history.map(item=><div className="historyItem" key={item.id}><div><strong>{item.text_input}</strong><span>{new Date(item.created_at).toLocaleString("pt-BR")} • {item.engine}</span></div><button className="secondary" onClick={()=>playHistory(item)}><Play size={16}/> Ouvir</button></div>)}</div>}</section>{message&&<div className="toast">{message}</div>}</main>;
}
