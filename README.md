# VoiceLab

Aplicação Next.js para cadastrar uma voz própria ou autorizada, salvar vozes para reutilização e transformar texto em áudio.

## Recursos

- cadastro de amostra de voz autorizada;
- biblioteca local de vozes salvas;
- seleção de voz;
- geração de áudio a partir de texto;
- player no navegador;
- download do resultado em MP3;
- confirmação obrigatória de autorização de uso.

## Configuração

Crie uma variável de ambiente chamada `ELEVENLABS_API_KEY` com sua chave da ElevenLabs.

Depois execute:

```bash
npm install
npm run dev
```

## Deploy na Vercel

Cadastre `ELEVENLABS_API_KEY` em Project Settings > Environment Variables e faça o deploy.

## Uso responsável

Use apenas sua própria voz ou vozes de pessoas que tenham autorizado expressamente o uso. Não utilize o aplicativo para fraude, falsidade ideológica, golpes ou para se passar por outra pessoa sem consentimento.
