export const runtime = "nodejs";

import { Client } from "@gradio/client";

const SPACE = process.env.HF_SPACE_ID_SECONDARY || "ResembleAI/Chatterbox-Multilingual-TTS";

const PRESETS = {
  male_01: [101, 0.42, 0.72, 0.48], male_02: [102, 0.50, 0.76, 0.52], male_03: [103, 0.58, 0.70, 0.46], male_04: [104, 0.46, 0.84, 0.56], male_05: [105, 0.54, 0.78, 0.50],
  female_01: [201, 0.44, 0.74, 0.50], female_02: [202, 0.52, 0.82, 0.54], female_03: [203, 0.60, 0.76, 0.48], female_04: [204, 0.48, 0.88, 0.56], female_05: [205, 0.56, 0.72, 0.52],
  child_01: [301, 0.78, 0.90, 0.42], child_02: [302, 0.82, 0.94, 0.40], child_03: [303, 0.74, 0.88, 0.44], child_04: [304, 0.86, 0.96, 0.38], child_05: [305, 0.80, 0.92, 0.41],
  character_wizard: [401, 0.92, 0.72, 0.62], character_pirate: [402, 1.05, 0.86, 0.58], character_robot: [403, 0.30, 0.55, 0.70], character_storyteller: [404, 0.70, 0.68, 0.46], character_creature: [405, 1.18, 1.00, 0.40]
};

const SAMPLE_TEXT = "Olá! Esta é uma prévia da minha voz no VoiceLab.";

export async function POST(request) {
  try {
    const { slug } = await request.json();
    const preset = PRESETS[slug];
    if (!preset) return Response.json({ error: "Preset inválido." }, { status: 400 });

    const [seed, exaggeration, temperature, cfg] = preset;
    const options = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : undefined;
    const app = await Client.connect(SPACE, options);
    const result = await app.predict("/generate_tts_audio", [
      SAMPLE_TEXT,
      "pt",
      null,
      exaggeration,
      temperature,
      seed,
      cfg
    ]);

    const output = result?.data?.[0];
    const audioUrl = typeof output === "string" ? output : output?.url;
    if (!audioUrl) return Response.json({ error: "A prévia não foi gerada." }, { status: 502 });

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) return Response.json({ error: "Falha ao baixar a prévia." }, { status: 502 });

    return new Response(await audioResponse.arrayBuffer(), {
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Erro ao gerar prévia." }, { status: 500 });
  }
}
