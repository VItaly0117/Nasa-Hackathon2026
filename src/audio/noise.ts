// Генератор буфера шума (реголит, ветер, сварка)
export function createNoiseBuffer(ctx: AudioContext, seconds = 0.5): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Генерируем розовый шум: он ближе к мягкому потоку воздуха, чем яркий белый шум.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  // Crossfade the loop endpoints to avoid an audible click every few seconds.
  const fade = Math.min(Math.floor(ctx.sampleRate * 0.08), Math.floor(bufferSize / 4));
  for (let i = 0; i < fade; i++) {
    const mix = i / fade;
    const head = data[i];
    const tailIndex = bufferSize - fade + i;
    const tail = data[tailIndex];
    const blended = tail * (1 - mix) + head * mix;
    data[i] = blended;
    data[tailIndex] = blended;
  }
  return buffer;
}
