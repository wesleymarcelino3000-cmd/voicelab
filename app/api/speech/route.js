export const runtime = "nodejs";

import { Client, handle_file } from "@gradio/client";

export async function POST(request) {
  try {
    const source = process.env.HF_SPACE_ID;
    if (!source) {
      return Response.json({ error: "HF_SPACE_ID não configurado na Vercel." }, { status: 500 });
    }

    const form = await request.formData();
    const text = String(form.get("text") || "").trim();
    const reference = form.get("reference");

    if (!text || !reference) {
      return Response.json({ error: "Texto e amostra de voz são obrigatórios." }, { status: 400 });
    }

    if (text.length > 3000) {
      return Response.json({ error: "Use no máximo 3000 caracteres por geração." }, { status: 400 });
    }

    const options = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : undefined;
    const app = await Client.connect(source, options);
    const result = await app.predict("/generate", {
      text,
      reference_audio: handle_file(reference),
      language: "pt"
    });

    const output = result?.data?.[0];
    const audioUrl = typeof output === "string" ? output : output?.url;
    if (!audioUrl) {
      return Response.json({ error: "O servidor de áudio não retornou um arquivo." }, { status: 502 });
    }

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return Response.json({ error: "Não foi possível baixar o áudio gerado." }, { status: 502 });
    }

    const audio = await audioResponse.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": audioResponse.headers.get("content-type") || "audio/wav",
        "Content-Disposition": "inline; filename=voicelab.wav",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Erro interno ao gerar áudio." }, { status: 500 });
  }
}
