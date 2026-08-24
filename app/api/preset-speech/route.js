export const runtime = "nodejs";

import { synthesizePreset, PRESET_ORDER } from "../../../lib/elevenlabs-presets";

export async function POST(request) {
  try {
    const { slug, text } = await request.json();
    const cleanText = String(text || "").trim();

    if (!PRESET_ORDER.includes(slug)) return Response.json({ error: "Preset inválido." }, { status: 400 });
    if (!cleanText) return Response.json({ error: "Digite uma mensagem." }, { status: 400 });
    if (cleanText.length > 300) return Response.json({ error: "Gere até 300 caracteres por vez." }, { status: 400 });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return Response.json({ error: "A ElevenLabs não está configurada no servidor." }, { status: 503 });

    const result = await synthesizePreset(apiKey, slug, cleanText);

    return new Response(result.audio, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": "inline; filename=voicelab.mp3",
        "Cache-Control": "no-store",
        "X-VoiceLab-Provider": "elevenlabs",
        "X-VoiceLab-Voice": encodeURIComponent(result.voiceName)
      }
    });
  } catch (error) {
    console.error("preset-speech:", error);
    return Response.json({ error: error?.message || "Não foi possível gerar o áudio agora." }, { status: 500 });
  }
}
