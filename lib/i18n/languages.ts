export type LanguageCode = "en" | "hi" | "te" | "ta" | "kn" | "ml" | "mr" | "bn" | "es" | "fr" | "zh" | "ja";

export type Language = {
  code: LanguageCode;
  /** Name in its own script, shown in the picker. */
  nativeName: string;
  englishName: string;
  /** Short glyph shown in the picker badge. */
  glyph: string;
  /** BCP-47 tag for speech synthesis and the html lang attribute. */
  speechTag: string;
  /** Code used by machine-translation providers. */
  providerCode: string;
  script: "latin" | "indic" | "cjk";
};

export const LANGUAGES: Language[] = [
  { code: "en", nativeName: "English", englishName: "English", glyph: "En", speechTag: "en-IN", providerCode: "en", script: "latin" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", glyph: "अ", speechTag: "hi-IN", providerCode: "hi", script: "indic" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu", glyph: "అ", speechTag: "te-IN", providerCode: "te", script: "indic" },
  { code: "ta", nativeName: "தமிழ்", englishName: "Tamil", glyph: "அ", speechTag: "ta-IN", providerCode: "ta", script: "indic" },
  { code: "kn", nativeName: "ಕನ್ನಡ", englishName: "Kannada", glyph: "ಅ", speechTag: "kn-IN", providerCode: "kn", script: "indic" },
  { code: "ml", nativeName: "മലയാളം", englishName: "Malayalam", glyph: "അ", speechTag: "ml-IN", providerCode: "ml", script: "indic" },
  { code: "mr", nativeName: "मराठी", englishName: "Marathi", glyph: "म", speechTag: "mr-IN", providerCode: "mr", script: "indic" },
  { code: "bn", nativeName: "বাংলা", englishName: "Bengali", glyph: "অ", speechTag: "bn-IN", providerCode: "bn", script: "indic" },
  { code: "es", nativeName: "Español", englishName: "Spanish", glyph: "Es", speechTag: "es-ES", providerCode: "es", script: "latin" },
  { code: "fr", nativeName: "Français", englishName: "French", glyph: "Fr", speechTag: "fr-FR", providerCode: "fr", script: "latin" },
  { code: "zh", nativeName: "中文", englishName: "Chinese", glyph: "中", speechTag: "zh-CN", providerCode: "zh-CN", script: "cjk" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese", glyph: "あ", speechTag: "ja-JP", providerCode: "ja", script: "cjk" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && LANGUAGES.some((language) => language.code === value);
}

export function getLanguage(code: LanguageCode): Language {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}
