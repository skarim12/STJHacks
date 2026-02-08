export async function generateOpenAiImageBase64(opts: {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
}): Promise<{ b64: string; revisedPrompt?: string }> {
  const key = String(process.env.API_KEY ?? '').trim();
  if (!key) throw new Error('API_KEY env var not set (OpenAI)');

  const model = String(process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1');
  const size = opts.size ?? '1536x1024';

  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      prompt: opts.prompt,
      size,
      response_format: 'b64_json'
    })
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`OpenAI images error ${r.status}: ${t.slice(0, 300)}`);
  }

  const data: any = await r.json();
  const b64 = data?.data?.[0]?.b64_json;
  const revisedPrompt = data?.data?.[0]?.revised_prompt;
  if (!b64) throw new Error('OpenAI images response missing b64_json');
  return { b64, revisedPrompt };
}
