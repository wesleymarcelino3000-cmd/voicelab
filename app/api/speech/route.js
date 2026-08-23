export const runtime = "nodejs";

import { Client, handle_file } from "@gradio/client";

const PRIMARY_DEFAULT = "ResembleAI/Chatterbox-Multilingual-TTS";

async function generateWithSpace(source, text, reference) {
  const options = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : undefined;
  const app = await Client.connect(source, options);

  const result = await app.predict("/generate_tts_audio", [
    text,
    "pt",
    handle_file(reference),
    0.5,
    0.8,
    0,
    0.5
  ]);

  const output = result?.data?.[0];
  const audioUrl = typeof output === "string" ? output : output?.url;
  if (!audioUrl) throw new Error("O motor não retornou o arquivo de áudio.");

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error("Não foi possível obter o áudio gerado.");

  return {
    audio: await audioResponse.arrayBuffer(),
    contentType: audioResponse.headers.get("content-type") || "audio/wav"
  };
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const text = String(form.get("text") || "").trim();
    const reference = form.get("reference");

    if (!text || !reference) {
      return Response.json({ error: "Texto e amostra de voz são obrigatórios." }, { status: 400 });
    }

    if (text.length > 300) {
      return Response.json({ error: "Nesta versão gratuita, gere até 300 caracteres por vez." }, { status: 400 });
    }

    const providers = [
      { name: "principal", source: process.env.HF_SPACE_ID || PRIMARY_DEFAULT },
      process.env.HF_SPACE_ID_SECONDARY
        ? { name: "reserva", source: process.env.HF_SPACE_ID_SECONDARY }
        : null
    ].filter(Boolean);

    const errors = [];

    for (const provider of providers) {
      try {
        const result = await generateWithSpace(provider.source, text, reference);
        return new Response(result.audio, {
          headers: {
            "Content-Type": result.contentType,
            "Content-Disposition": "inline; filename=voicelab.wav",
            "Cache-Control": "no-store",
            "X-Voice-Provider": provider.name
          }
        });
      } catch (error) {
        errors.push(`${provider.name}: ${error?.message || "falha desconhecida"}`);
      }
    }

    return Response.json(
      {
        error: providers.length > 1
          ? "Os dois motores de voz estão indisponíveis no momento."
          : "O motor de voz está indisponível no momento.",
        details: errors
      },
      { status: 503 }
    );
  } catch (error) {
    return Response.json({ error: error?.message || "Erro interno ao gerar áudio." }, { status: 500 });
  }
}
