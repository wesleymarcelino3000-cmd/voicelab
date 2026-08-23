export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return Response.json({ error: "ELEVENLABS_API_KEY não configurada." }, { status: 500 });
    }

    const incoming = await request.formData();
    const file = incoming.get("file");
    const name = String(incoming.get("name") || "").trim();

    if (!file || !name) {
      return Response.json({ error: "Nome e arquivo de áudio são obrigatórios." }, { status: 400 });
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("files", file, file.name || "sample.mp3");

    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      body: fd
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data?.detail?.message || data?.detail || data?.message || "A ElevenLabs recusou a clonagem." },
        { status: response.status }
      );
    }

    return Response.json({
      voiceId: data.voice_id,
      requiresVerification: Boolean(data.requires_verification)
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Erro interno." }, { status: 500 });
  }
}
