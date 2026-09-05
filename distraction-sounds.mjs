// A long, seamless collage of tonal effects. No white-noise/static bed.
export function createDistractionSamples(sampleRate, rng = Math.random) {
  const seconds = 16;
  const samples = new Float32Array(sampleRate * seconds);
  const motif = [330, 495, 370, 660];
  let phase = 0;
  for (let phrase = 0; phrase < seconds; phrase += 1) {
    const patterned = phrase % 2 === 0;
    const style = (phrase + Math.floor(rng() * 6)) % 6;
    const base = 180 + rng() * 800;
    const pulseRate = patterned ? 6 : 3 + rng() * 9;
    const wobble = 3 + rng() * 18;
    let note = base;
    let nextChange = 0;
    for (let i = 0; i < sampleRate; i += 1) {
      const t = i / sampleRate;
      if (t >= nextChange) {
        note = patterned ? motif[Math.floor(t * 8) % motif.length] : 180 + rng() * 1400;
        nextChange = t + (patterned ? 0.125 : 0.04 + rng() * 0.23);
      }
      let frequency = note;
      if (style === 0) frequency = base + 1000 * t; // rising chirp
      if (style === 1) frequency = base + 160 * Math.sin(2 * Math.PI * wobble * t); // warble
      if (style === 2) frequency = base * (Math.floor(t * pulseRate) % 2 ? 1.5 : 1); // two-tone alarm
      if (style === 4) frequency = base + 900 * (1 - t); // falling squeak
      phase += 2 * Math.PI * frequency / sampleRate;
      const sine = Math.sin(phase);
      const tone = style === 3 ? Math.tanh(sine * 5) : style === 5 ? (Math.sin(phase) + 0.4 * Math.sin(phase * 2.03)) / 1.4 : sine;
      const pulse = 0.28 + 0.72 * Math.pow((1 + Math.sin(2 * Math.PI * pulseRate * t)) / 2, 3);
      // Brief fades prevent clicks at phrase/loop boundaries; playback never waits for a timer.
      const envelope = Math.min(1, t / 0.008, (1 - t) / 0.008);
      samples[phrase * sampleRate + i] = tone * pulse * envelope * 0.8;
    }
  }
  return samples;
}
