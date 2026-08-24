export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const SAMPLE_TEXT = "Olá! Esta é uma prévia da minha voz no VoiceLab.";

const PRESET_ORDER = [
  "male_01","male_02","male_03","male_04","male_05",
  "female_01","female_02","female_03","female_04","female_05",
  "child_01","child_02","child_03","child_04","child_05",
  "character_wizard","character_pirate","character_robot","character_storyteller","character_creature"
];

const CATEGORY_BY_SLUG = {
  male_01: "male", male_02: "male", male_03: "male", male_04: "male", male_05: "male",
  female_01: "female", female_02: "female", female_03: "female", female_04: "female", female_05: "female",
  child_01: "child", child_02: "child", child_03: "child", child_04: "child", child_05: "child",
  character_wizard: "character", character_pirate: "character", character_robot: "character", character_storyteller: "character", character_creature: "character"
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase não está configurado no servidor.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getCachedPreview(supabase, slug) {
  const path = `previews/${slug}.mp3`;
  const { data } = supabase.storage.from("preset-voices").getPublicUrl(path);
  const response = await fetch(data.publicUrl, { cache: "no-store" });
  if (!response.ok) return null;
  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/mpeg"
  };
}

async function getElevenLabsVoices(apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Não foi possível carregar as vozes da ElevenLabs.");
  const data = await response.json();
  const voices = Array.isArray(data?.voices) ? data.voices.filter(v => v?.voice_id) : [];
  if (!voices.length) throw new Error("Nenhuma voz da ElevenLabs está disponível nesta conta.");
  return voices;
}

function chooseVoice(voices, slug) {
  const category = CATEGORY_BY_SLUG[slug];
  const index = PRESET_ORDER.indexOf(slug);
  const gender = category === "male" ? "male" : category === "female" ? "female" : null;
  const genderMatches = gender
    ? voices.filter(v => String(v?.labels?.gender || "").toLowerCase() === gender)
    : [];
  const pool = genderMatches.length ? genderMatches : voices;
  return pool[index % pool.length];
}

async function generatePreview(apiKey, slug) {
  const voices = await getElevenLabsVoices(apiKey);
  const voice = chooseVoice(voices, slug);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text: SAMPLE_TEXT,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.82,
        style: 0.25,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.detail?.message || body?.detail || "";
    } catch {}
    throw new Error(typeof detail === "string" && detail ? detail : "Não foi possível gerar esta prévia na ElevenLabs.");
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/mpeg"
  };
}

async function savePreview(supabase, slug, generated) {
  const path = `previews/${slug}.mp3`;
  const blob = new Blob([generated.audio], { type: generated.contentType || "audio/mpeg" });
  const { error } = await supabase.storage.from("preset-voices").upload(path, blob, {
    contentType: "audio/mpeg",
    cacheControl: "31536000",
    upsert: false
  });
  if (error && !String(error.message || "").toLowerCase().includes("already exists")) {
    console.error("preview cache upload:", error);
  }
}

export async function POST(request) {
  try {
    const { slug } = await request.json();
    if (!PRESET_ORDER.includes(slug)) {
      return Response.json({ error: "Preset inválido." }, { status: 400 });
    }

    const supabase = getSupabase();
    const cached = await getCachedPreview(supabase, slug);
    if (cached) {
      return new Response(cached.audio, {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-VoiceLab-Preview": "cached"
        }
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("A ElevenLabs ainda não está configurada no servidor.");

    const generated = await generatePreview(apiKey, slug);
    await savePreview(supabase, slug, generated);

    return new Response(generated.audio, {
      headers: {
        "Content-Type": generated.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-VoiceLab-Preview": "generated-and-cached"
      }
    });
  } catch (error) {
    console.error("preset-preview:", error);
    return Response.json({ error: error?.message || "Não foi possível carregar a prévia." }, { status: 500 });
  }
}
