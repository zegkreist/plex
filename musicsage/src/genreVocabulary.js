/**
 * genreVocabulary
 *
 * Mapeia nomes de gêneros musicais para vocabulário descritivo usado para
 * enriquecer os textos embedados. Isso melhora a separação semântica entre
 * gêneros no espaço de embedding (ex: "Heavy Metal" ≠ "Bossa Nova").
 */

/** @type {Record<string, string>} */
export const GENRE_VOCABULARY = {
  "Heavy Metal":        "distorted guitars, aggressive rhythms, powerful drums, dark and heavy themes",
  "Metal":              "heavy distortion, complex riffs, aggressive tones, intense energy",
  "Rock":               "electric guitars, strong rhythm section, energetic, guitar-driven",
  "Classic Rock":       "guitar solos, arena sound, powerful vocals, timeless rock",
  "Progressive Rock":   "complex time signatures, extended compositions, technical musicianship, concept albums",
  "Punk Rock":          "fast and raw, simple chords, short energetic songs, rebellious attitude",
  "Punk":               "DIY, raw production, fast tempo, rebellious, anti-establishment",
  "Indie Rock":         "independent sound, alternative guitars, eclectic production",
  "Alternative Rock":   "non-mainstream textures, experimental tendencies, varied moods",
  "Grunge":             "heavy distortion, melancholic tone, raw production, angst",
  "Jazz":               "improvisation, complex harmonies, swing rhythms, sophisticated, brass and woodwinds",
  "Smooth Jazz":        "mellow, polished, relaxed groove, saxophone-forward, background music",
  "Fusion":             "jazz improvisation with rock and funk elements, electric instruments, complex harmonies",
  "Blues":              "12-bar structure, guitar bends, emotional expression, call and response",
  "R&B":                "soulful vocals, groove, emotion, rhythm and melody fusion",
  "Soul":               "gospel-influenced, warm production, deeply emotive vocals, passion",
  "Funk":               "syncopated rhythm, bass-driven, danceable grooves, extended jams",
  "Disco":              "four-on-the-floor beat, strings, brass, upbeat danceable energy",
  "Pop":                "catchy hooks, polished production, mainstream appeal, verse-chorus structure",
  "Indie Pop":          "melodic, introspective lyrics, indie production aesthetic",
  "Synth-Pop":          "synthesizer-driven, electronic beats, melodic and atmospheric",
  "Electronic":         "synthesizers, programmed beats, artificial textures, studio-crafted sound",
  "Electronica":        "textural synthesis, experimental beats, atmospheric and ambient elements",
  "Dance":              "driving beat, four-on-the-floor, energetic, designed for movement",
  "EDM":                "electronic drop, euphoric build-up, festival energy, synthesizer layers",
  "House":              "steady 4/4 kick, soulful vocals, Chicago roots, club energy",
  "Techno":             "industrial rhythm, minimal melody, dark and repetitive, Berlin influence",
  "Trance":             "builds and breakdowns, hypnotic melody, euphoric energy, uplifting",
  "Ambient":            "atmospheric and textural, slow development, immersive, minimal beat",
  "Classical":          "orchestral, wide dynamic range, acoustic instruments, formal structure, composition-focused",
  "Baroque":            "counterpoint, harpsichord, ornate phrasing, historical period aesthetics",
  "Opera":              "dramatic vocals, orchestral accompaniment, theatrical storytelling",
  "Hip-Hop":            "rap vocals, sampling, strong bass, urban themes, rhythmic lyricism",
  "Rap":                "wordy rhyming delivery, beat-driven, street narrative",
  "Trap":               "808 bass, hi-hat rolls, dark melodic tones, modern hip-hop production",
  "Country":            "guitar twang, storytelling lyrics, Nashville sound, rural themes",
  "Folk":               "acoustic instruments, storytelling, organic sound, intimate and traditional",
  "Folk Rock":          "acoustic instruments with electric elements, protest roots, lyrical depth",
  "Reggae":             "off-beat rhythm (skank), bass-heavy, Jamaican influence, relaxed tempo",
  "Ska":                "upbeat offbeat rhythm, horn section, Jamaican roots, energetic",
  "World Music":        "international instruments, diverse cultural rhythms, global influences",
  "Latin":              "rhythmic percussion, Spanish language, romantic or festive mood",
  "Bossa Nova":         "soft samba rhythm, guitar and voice, Brazilian elegance, gentle swing",
  "Flamenco":           "passionate guitar, hand claps, Andalusian roots, emotional intensity",
  "New Age":            "soothing textures, meditative pace, spiritual or relaxing mood",
  "Gospel":             "devotional lyrics, choir arrangements, powerful vocal delivery",
  "Soundtrack":         "cinematic orchestration, thematic motifs, emotional storytelling through music",
  "Art Pop":            "experimental production, artistic vision, melodic but unconventional",
  "Alternative":        "non-mainstream sound, varied influences, often introspective",
  "Post-Rock":          "instrumental crescendos, atmospheric build-ups, guitar-driven dynamics",
  "Math Rock":          "irregular time signatures, technical guitar work, complex arrangements",
  "Hardcore":           "intense fast tempo, screamed vocals, aggressive and raw",
};

/**
 * Constrói uma descrição de gênero enriquecida com vocabulário musical.
 * Gêneros conhecidos recebem suas características descritivas entre parênteses.
 * Gêneros desconhecidos são incluídos como nome simples.
 *
 * @param {string[]} genres
 * @returns {string|null}   null se o array for vazio
 */
export function buildGenreContext(genres) {
  if (!genres?.length) return null;
  return genres
    .map((g) => {
      const vocab = GENRE_VOCABULARY[g];
      return vocab ? `${g} (${vocab})` : g;
    })
    .join("; ");
}
