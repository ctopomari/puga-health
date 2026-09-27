// @ts-nocheck
export const VOICE_STATES = Object.freeze({
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting-permission',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  TRANSCRIBING: 'transcribing',
  RESPONDING: 'responding',
  PLAYING: 'playing',
  ERROR: 'error',
})

export function getSupportedVoiceCapabilities() {
  if (typeof navigator === 'undefined') return { mediaRecorder: false, speechSynthesis: false }
  return {
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    speechSynthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
  }
}

export async function requestMicrophonePermission() {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('Microphone capture is not supported in this browser.'), { code: 'VOICE_UNSUPPORTED' })
  }
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

export function createRecorder(stream, handlers = {}) {
  if (typeof MediaRecorder === 'undefined') {
    throw Object.assign(new Error('MediaRecorder is not supported.'), { code: 'VOICE_UNSUPPORTED' })
  }
  const chunks = []
  const recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data)
  }
  recorder.onstart = handlers.onStart
  recorder.onerror = handlers.onError
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
    handlers.onStop?.(blob)
    stream.getTracks().forEach((track) => track.stop())
  }
  return recorder
}

export function speak(text, options = {}) {
  if (!('speechSynthesis' in window)) {
    throw Object.assign(new Error('Voice playback is not supported.'), { code: 'TTS_UNSUPPORTED' })
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = options.lang || 'en-NG'
  utterance.rate = options.rate || 0.95
  utterance.onstart = options.onStart
  utterance.onend = options.onEnd
  utterance.onerror = options.onError
  window.speechSynthesis.speak(utterance)
  return utterance
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
