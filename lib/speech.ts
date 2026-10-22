"use client";

const PREFERRED_VOICE = /google|natural|enhanced|premium|neural|siri/i;

/** Voices that can read another language's script when the device lacks a native one. */
const RELATED_VOICES: Record<string, string> = { mr: "hi-IN" };

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Chrome loads voices asynchronously; touching getVoices early warms the list before the first tap. */
export function warmUpVoices() {
  if (!isSpeechSupported()) return () => undefined;
  const synth = window.speechSynthesis;
  synth.getVoices();
  const onChange = () => synth.getVoices();
  synth.addEventListener?.("voiceschanged", onChange);
  return () => synth.removeEventListener?.("voiceschanged", onChange);
}

function pickVoice(voices: SpeechSynthesisVoice[], tag: string) {
  const wanted = tag.toLowerCase();
  const base = wanted.split("-")[0];
  const matches = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").split("-")[0] === base);
  const exact = matches.filter((voice) => voice.lang.toLowerCase().replace("_", "-") === wanted);
  return exact.find((voice) => PREFERRED_VOICE.test(voice.name))
    ?? exact[0]
    ?? matches.find((voice) => PREFERRED_VOICE.test(voice.name))
    ?? matches[0]
    ?? null;
}

type SpeakOptions = {
  text: string;
  lang: string;
  /** Spoken instead when the device has no voice for `lang` (e.g. the original English name). */
  fallbackText?: string;
  fallbackLang?: string;
  onStart?: () => void;
  onEnd?: () => void;
};

/** Must be called directly from a user gesture so mobile Safari allows playback. */
export function speak({ text, lang, fallbackText, fallbackLang = "en-IN", onStart, onEnd }: SpeakOptions): boolean {
  if (!isSpeechSupported() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();

  const voices = synth.getVoices();
  let spokenText = text;
  let spokenLang = lang;
  const untranslated = fallbackText !== undefined && fallbackText === text && !lang.toLowerCase().startsWith("en");
  let voice = untranslated ? null : pickVoice(voices, lang);
  const related = RELATED_VOICES[lang.split("-")[0].toLowerCase()];
  if (!voice && related && !untranslated) {
    voice = pickVoice(voices, related);
    if (voice) spokenLang = related;
  }
  if (!voice && voices.length) {
    voice = pickVoice(voices, fallbackLang) ?? pickVoice(voices, "en-US");
    spokenText = fallbackText ?? text;
    spokenLang = voice?.lang ?? fallbackLang;
  }

  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = spokenLang;
  if (voice) utterance.voice = voice;
  utterance.volume = 1;
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  synth.resume();
  synth.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
