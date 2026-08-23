export const runtime = "nodejs";

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
  if (!apiKey) throw new Error("As vozes prontas ainda não estão configuradas no servidor.");

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
    throw new Error(detail || "Não foi possível gerar o áudio com esta voz.");
  }

  return response;
}

export async function POST(request) {
  try {
    const { slug, text } = await request.json();
    const cleanText = String(text || "").trim();

    if (!PRESET_ORDER.includes(slug)) return Response.json({ error: "Preset inválido." }, { status: 400 });
    if (!cleanText) return Response.json({ error: "Digite uma mensagem." }, { status: 400 });
    if (cleanText.length > 300) return Response.json({ error: "Gere até 300 caracteres por vez." }, { status: 400 });

    const audioResponse = await generateWithElevenLabs(slug, cleanText);
    return new Response(await audioResponse.arrayBuffer(), {
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/mpeg",
        "Content-Disposition": "inline; filename=voicelab.mp3",
        "Cache-Control": "no-store",
        "X-VoiceLab-Provider": "elevenlabs"
      }
    });
  } catch (error) {
    console.error("preset-speech:", error);
    return Response.json({ error: error?.message || "Não foi possível gerar o áudio." }, { status: 500 });
  }
}
