export const runtime = "nodejs";

import { Client, handle_file } from "@gradio/client";

const PRIMARY_SPACE = process.env.HF_SPACE_ID_PRIMARY || "ResembleAI/Chatterbox-Multilingual-TTS-V3";
const SECONDARY_SPACE = process.env.HF_SPACE_ID_SECONDARY || "ResembleAI/Chatterbox-Multilingual-TTS";

function shouldFallback(status, message = "") {
  if (!status) return true;
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  const text = String(message).toLowerCase();
  return text.includes("unavailable") || text.includes("timeout") || text.includes("queue") || text.includes("gpu") || text.includes("capacity");
}

async function callSpace(spaceId, mode, text, reference) {
  const options = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : undefined;
  const app = await Client.connect(spaceId, options);

  const args = mode === "v3"
    ? [text, handle_file(reference), "pt", 0.5, 0.8, 0, 0.5]
    : [text, "pt", handle_file(reference), 0.5, 0.8, 0, 0.5];

  const result = await app.predict("/generate_tts_audio", args);
  const output = result?.data?.[0];
  const audioUrl = typeof output === "string" ? output : output?.url;

  if (!audioUrl) throw new Error(`${spaceId} não retornou áudio.`);

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    const error = new Error(`Falha ao baixar áudio de ${spaceId}.`);
    error.status = audioResponse.status;
    throw error;
  }

  return {
    audio: await audioResponse.arrayBuffer(),
    contentType: audioResponse.headers.get("content-type") || "audio/wav",
    provider: spaceId,
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

    let result;
    let primaryError;

    try {
      result = await callSpace(PRIMARY_SPACE, "v3", text, reference);
    } catch (error) {
      primaryError = error;
      if (!shouldFallback(error?.status, error?.message)) throw error;
    }

    if (!result) {
      try {
        result = await callSpace(SECONDARY_SPACE, "legacy", text, reference);
      } catch (secondaryError) {
        return Response.json(
          {
            error: "Os dois motores estão indisponíveis no momento.",
            primary: primaryError?.message || "Falha no motor principal.",
            secondary: secondaryError?.message || "Falha no motor reserva.",
          },
          { status: 503 }
        );
      }
    }

    return new Response(result.audio, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": "inline; filename=voicelab.wav",
        "Cache-Control": "no-store",
        "X-VoiceLab-Provider": result.provider,
      }
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Erro interno ao gerar áudio." }, { status: 500 });
  }
}
