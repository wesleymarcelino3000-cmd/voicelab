export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return Response.json({ error: "ELEVENLABS_API_KEY não configurada." }, { status: 500 });
    }

    const { voiceId, text } = await request.json();

    if (!voiceId || !text?.trim()) {
      return Response.json({ error: "Voz e texto são obrigatórios." }, { status: 400 });
    }

    if (text.length > 5000) {
      return Response.json({ error: "O texto ultrapassa o limite de 5000 caracteres." }, { status: 400 });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2"
        })
      }
    );

    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch {}
      return Response.json(
        { error: data?.detail?.message || data?.detail || data?.message || "A ElevenLabs não conseguiu gerar o áudio." },
        { status: response.status }
      );
    }

    const audio = await response.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": "inline; filename=voice.mp3",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Erro interno." }, { status: 500 });
  }
}
