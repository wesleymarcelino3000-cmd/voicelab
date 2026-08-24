export const PRESET_ORDER = [
  "male_01","male_02","male_03","male_04","male_05",
  "female_01","female_02","female_03","female_04","female_05",
  "child_01","child_02","child_03","child_04","child_05",
  "character_wizard","character_pirate","character_robot","character_storyteller","character_creature"
];

const CATEGORY_BY_SLUG = {
  male_01:"male",male_02:"male",male_03:"male",male_04:"male",male_05:"male",
  female_01:"female",female_02:"female",female_03:"female",female_04:"female",female_05:"female",
  child_01:"child",child_02:"child",child_03:"child",child_04:"child",child_05:"child",
  character_wizard:"character",character_pirate:"character",character_robot:"character",character_storyteller:"character",character_creature:"character"
};

const SETTINGS = {
  male_01:{stability:0.58,similarity_boost:0.88,style:0.10},
  male_02:{stability:0.48,similarity_boost:0.90,style:0.18},
  male_03:{stability:0.66,similarity_boost:0.86,style:0.08},
  male_04:{stability:0.42,similarity_boost:0.92,style:0.28},
  male_05:{stability:0.54,similarity_boost:0.89,style:0.15},
  female_01:{stability:0.60,similarity_boost:0.89,style:0.10},
  female_02:{stability:0.46,similarity_boost:0.92,style:0.22},
  female_03:{stability:0.52,similarity_boost:0.90,style:0.16},
  female_04:{stability:0.40,similarity_boost:0.91,style:0.30},
  female_05:{stability:0.64,similarity_boost:0.87,style:0.08},
  child_01:{stability:0.44,similarity_boost:0.92,style:0.32},
  child_02:{stability:0.48,similarity_boost:0.91,style:0.28},
  child_03:{stability:0.40,similarity_boost:0.93,style:0.35},
  child_04:{stability:0.46,similarity_boost:0.92,style:0.30},
  child_05:{stability:0.42,similarity_boost:0.93,style:0.34},
  character_wizard:{stability:0.70,similarity_boost:0.86,style:0.34},
  character_pirate:{stability:0.48,similarity_boost:0.90,style:0.46},
  character_robot:{stability:0.78,similarity_boost:0.84,style:0.08},
  character_storyteller:{stability:0.72,similarity_boost:0.88,style:0.20},
  character_creature:{stability:0.42,similarity_boost:0.88,style:0.52}
};

async function listVoices(apiKey) {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Não foi possível carregar as vozes naturais da ElevenLabs.");
  const json = await res.json();
  const voices = (Array.isArray(json?.voices) ? json.voices : [])
    .filter(v => v?.voice_id)
    .sort((a,b) => String(a.voice_id).localeCompare(String(b.voice_id)));
  if (!voices.length) throw new Error("Nenhuma voz ElevenLabs está disponível nesta conta.");
  return voices;
}

function poolForSlug(voices, slug) {
  const category = CATEGORY_BY_SLUG[slug];
  if (category === "male" || category === "female") {
    const genderPool = voices.filter(v => String(v?.labels?.gender || "").toLowerCase() === category);
    if (genderPool.length) return genderPool;
  }
  return voices;
}

export async function resolvePreset(apiKey, slug) {
  if (!PRESET_ORDER.includes(slug)) throw new Error("Preset inválido.");
  const voices = await listVoices(apiKey);
  const pool = poolForSlug(voices, slug);
  const index = PRESET_ORDER.indexOf(slug);
  const voice = pool[index % pool.length];
  return {
    slug,
    voiceId: voice.voice_id,
    voiceName: voice.name || slug,
    settings: SETTINGS[slug] || { stability:0.55, similarity_boost:0.90, style:0.15 }
  };
}

export async function synthesizePreset(apiKey, slug, text) {
  const preset = await resolvePreset(apiKey, slug);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${preset.voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: preset.settings.stability,
        similarity_boost: preset.settings.similarity_boost,
        style: preset.settings.style,
        use_speaker_boost: true
      }
    })
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail?.message || body?.detail || "";
    } catch {}
    throw new Error(typeof detail === "string" && detail ? detail : "A ElevenLabs não conseguiu gerar este áudio.");
  }
  return {
    audio: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") || "audio/mpeg",
    voiceId: preset.voiceId,
    voiceName: preset.voiceName
  };
}
