// Mirrors Sources/Keeb/Core/LoudnessNormalizer.swift — keep CLIP_TARGET in sync
// with scripts/calibrate-normalization-gains.py.

const CLIP_TARGET = 0.32
const MIN_GAIN = 0.55
const MAX_GAIN = 16.0

/** Bidirectional per-clip loudness equalization (in-place). */
export function normalizeClipLoudness(buffer) {
  const channelCount = buffer.numberOfChannels
  const frameCount = buffer.length
  if (frameCount === 0 || channelCount === 0) return buffer

  const sampleRate = buffer.sampleRate
  const windowSize = Math.min(Math.max(64, Math.floor(sampleRate * 0.010)), frameCount)
  const denom = windowSize * channelCount

  let sumSquares = 0
  for (let ch = 0; ch < channelCount; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < windowSize; i++) {
      sumSquares += data[i] * data[i]
    }
  }
  let maxSumSquares = sumSquares

  if (frameCount > windowSize) {
    for (let s = 1; s <= frameCount - windowSize; s++) {
      for (let ch = 0; ch < channelCount; ch++) {
        const data = buffer.getChannelData(ch)
        const leaving = data[s - 1]
        const entering = data[s + windowSize - 1]
        sumSquares += entering * entering - leaving * leaving
      }
      if (sumSquares > maxSumSquares) maxSumSquares = sumSquares
    }
  }

  const maxRMS = Math.sqrt(Math.max(0, maxSumSquares) / denom)
  if (maxRMS <= 0.001) return buffer

  const gain = Math.min(MAX_GAIN, Math.max(MIN_GAIN, CLIP_TARGET / maxRMS))
  if (Math.abs(gain - 1.0) <= 0.005) return buffer

  for (let ch = 0; ch < channelCount; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < frameCount; i++) {
      data[i] *= gain
    }
  }
  return buffer
}

/** Decode WAV/OGG bytes and apply the same clip norm the Mac app uses at load. */
export async function decodeAndNormalize(ctx, arrayBuffer) {
  const copy = arrayBuffer.slice(0)
  const buffer = await ctx.decodeAudioData(copy)
  return normalizeClipLoudness(buffer)
}
