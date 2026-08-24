export const runtime = "nodejs";

import { EdgeTTS } from "node-edge-tts";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PRESETS = {
  male_01: { voice: "pt-BR-AntonioNeural", pitch: "-8%", rate: "-3%" },
  male_02: { voice: "pt-BR-AntonioNeural", pitch: "+2%", rate: "+5%" },
  male_03: { voice: "pt-BR-AntonioNeural", pitch: "-15%", rate: "-7%" },
  male_04: { voice: "pt-BR-AntonioNeural", pitch: "+7%", rate: "+10%" },
  male_05: { voice: "pt-BR-AntonioNeural", pitch: "-3%", rate: "+2%" },
  female_01: { voice: "pt-BR-FranciscaNeural", pitch: "-3%", rate: "-2%" },
  female_02: { voice: "pt-BR-FranciscaNeural", pitch: "+5%", rate: "+5%" },
  female_03: { voice: "pt-BR-FranciscaNeural", pitch: "+10%", rate: "+2%" },
  female_04: { voice: "pt-BR-FranciscaNeural", pitch: "-8%", rate: "+7%" },
  female_05: { voice: "pt-BR-FranciscaNeural", pitch: "+2%", rate: "-6%" },
  child_01: { voice: "pt-BR-FranciscaNeural", pitch: "+25%", rate: "+8%" },
  child_02: { voice: "pt-BR-AntonioNeural", pitch: "+25%", rate: "+10%" },
  child_03: { voice: "pt-BR-FranciscaNeural", pitch: "+32%", rate: "+3%" },
  child_04: { voice: "pt-BR-AntonioNeural", pitch: "+32%", rate: "+5%" },
  child_05: { voice: "pt-BR-FranciscaNeural", pitch: "+20%", rate: "+12%" },
  character_wizard: { voice: "pt-BR-AntonioNeural", pitch: "-22%", rate: "-12%" },
  character_pirate: { voice: "pt-BR-AntonioNeural", pitch: "-12%", rate: "-5%" },
  character_robot: { voice: "pt-BR-AntonioNeural", pitch: "-28%", rate: "+2%" },
  character_storyteller: { voice: "pt-BR-FranciscaNeural", pitch: "-10%", rate: "-10%" },
  character_creature: { voice: "pt-BR-AntonioNeural", pitch: "-35%", rate: "-15%" }
};

async function synthesize(text, preset) {
  const file = join(tmpdir(), `voicelab-${randomUUID()}.mp3`);
  try {
    const tts = new EdgeTTS({
      voice: preset.voice,
      lang: "pt-BR",
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      pitch: preset.pitch,
      rate: preset.rate,
      volume: "+0%",
      timeout: 20000
    });
    await tts.ttsPromise(text, file);
    return await readFile(file);
  } finally {
    await unlink(file).catch(() => {});
  }
}

export async function POST(request) {
  try {
    const { slug, text } = await request.json();
    const preset = PRESETS[slug];
    const cleanText = String(text || "").trim();

    if (!preset) return Response.json({ error: "Preset inválido." }, { status: 400 });
    if (!cleanText) return Response.json({ error: "Digite uma mensagem." }, { status: 400 });
    if (cleanText.length > 300) return Response.json({ error: "Gere até 300 caracteres por vez." }, { status: 400 });

    const audio = await synthesize(cleanText, preset);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": "inline; filename=voicelab.mp3",
        "Cache-Control": "no-store",
        "X-VoiceLab-Provider": "edge-tts"
      }
    });
  } catch (error) {
    console.error("preset-speech:", error);
    return Response.json({ error: "Não foi possível gerar o áudio agora. Tente novamente em alguns segundos." }, { status: 500 });
  }
}
