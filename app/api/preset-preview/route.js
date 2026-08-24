export const runtime = "nodejs";

import { synthesizePreset, PRESET_ORDER } from "../../../lib/elevenlabs-presets";

const SAMPLE_TEXT = "Olá! Esta é uma prévia da minha voz no VoiceLab.";

export async function POST(request) {
  try {
    const { slug } = await request.json();
    if (!PRESET_ORDER.includes(slug)) return Response.json({ error: "Preset inválido." }, { status: 400 });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return Response.json({ error: "A ElevenLabs não está configurada no servidor." }, { status: 503 });

    const result = await synthesizePreset(apiKey, slug, SAMPLE_TEXT);

    return new Response(result.audio, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-VoiceLab-Preview": "elevenlabs",
        "X-VoiceLab-Voice": encodeURIComponent(result.voiceName)
      }
    });
  } catch (error) {
    console.error("preset-preview:", error);
    return Response.json({ error: error?.message || "Não foi possível carregar a prévia." }, { status: 500 });
  }
}
