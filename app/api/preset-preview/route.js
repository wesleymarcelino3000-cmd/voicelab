export const runtime = "nodejs";

const SAMPLE_TEXT = "Olá! Esta é uma prévia da minha voz no VoiceLab.";

const PRESET_ORDER = [
  "male_01","male_02","male_03","male_04","male_05",
  "female_01","female_02","female_03","female_04","female_05",
  "child_01","child_02","child_03","child_04","child_05",
  "character_wizard","character_pirate","character_robot","character_storyteller","character_creature"
];

async function getElevenLabsVoices(apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Não foi possível carregar as vozes disponíveis.");
  const data = await response.json();
  const voices = Array.isArray(data?.voices) ? data.voices.filter(v => v?.voice_id) : [];
  if (!voices.length) throw new Error("Nenhuma voz pronta está disponível na conta de voz.");
  return voices;
}

async function generateWithElevenLabs(slug, text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("As prévias ainda não estão configuradas no servidor.");

  const index = PRESET_ORDER.indexOf(slug);
  if (index < 0) throw new Error("Preset inválido.");

  const voices = await getElevenLabsVoices(apiKey);
  const voice = voices[index % voices.length];
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}`, {
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
        stability: 0.48,
        similarity_boost: 0.72,
        style: 0.2,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json())?.detail?.message || ""; } catch {}
    throw new Error(detail || "Não foi possível gerar esta prévia.");
  }

  return response;
}

export async function POST(request) {
  try {
    const { slug } = await request.json();
    if (!PRESET_ORDER.includes(slug)) {
      return Response.json({ error: "Preset inválido." }, { status: 400 });
    }

    const audioResponse = await generateWithElevenLabs(slug, SAMPLE_TEXT);
    return new Response(await audioResponse.arrayBuffer(), {
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (error) {
    console.error("preset-preview:", error);
    return Response.json({ error: error?.message || "Não foi possível gerar a prévia." }, { status: 500 });
  }
}
