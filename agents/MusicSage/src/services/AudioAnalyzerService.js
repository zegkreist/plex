/**
 * AudioAnalyzerService
 *
 * Extrai características acústicas reais de arquivos de áudio usando ffprobe/ffmpeg.
 * Esses dados enriquecem a descrição textual usada para gerar embeddings que
 * reflitam o conteúdo sonoro da faixa em vez de apenas metadados.
 *
 * Ferramentas usadas (sem dependências npm):
 *   ffprobe  — formato, codec, sample rate, bitrate, BPM de tag
 *   ffmpeg   — dois passes em paralelo:
 *     Pass 1: astats (primeiros 30s) → RMS, peak, crest factor, dynamic range
 *     Pass 2: ebur128 (faixa inteira) → LUFS integrado, LRA, True Peak,
 *             arco temporal em 15 segmentos, % silêncio
 *
 * Se o arquivo não existe ou ffprobe falha, retorna null e o EmbeddingService
 * faz fallback para a descrição baseada em metadados.
 * Se apenas ffmpeg falha, retorna features parciais (sem acústica).
 */

import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { logger } from "../logger.js";
import { buildGenreContext } from "../genreVocabulary.js";

const execFile = promisify(_execFile);

const FFPROBE_TIMEOUT_MS  = 10_000;
const FFMPEG_TIMEOUT_MS   = 120_000; // faixa inteira para ebur128
const ASTATS_SAMPLE_SECS  = 30;      // limita astats aos primeiros 30s
const TEMPORAL_SEGMENTS   = 15;      // número de divisões do arco temporal
const SILENCE_LUFS_FLOOR  = -70;     // abaixo disto o momento é tratado como silêncio

export class AudioAnalyzerService {
  /**
   * @param {{
   *   plexMediaRoot?: string,
   *   plexPathPrefix?: string,
   *   ffprobeBin?: string,
   *   ffmpegBin?: string,
   * }} config
   *
   * plexPathPrefix — prefixo do path como o Plex o conhece (ex: "/music")
   * plexMediaRoot  — diretório local onde esses arquivos realmente estão
   *                  (ex: "/home/developer/workspace/plex_server/music")
   */
  constructor({
    plexMediaRoot  = process.env.PLEX_MEDIA_ROOT  || "",
    plexPathPrefix = process.env.PLEX_PATH_PREFIX || "/music",
    ffprobeBin     = "ffprobe",
    ffmpegBin      = "ffmpeg",
  } = {}) {
    this._plexMediaRoot  = plexMediaRoot;
    this._plexPathPrefix = plexPathPrefix;
    this._ffprobe        = ffprobeBin;
    this._ffmpeg         = ffmpegBin;
  }

  // ─── API pública ──────────────────────────────────────────────────────────

  /**
   * Analisa um arquivo de áudio e retorna características acústicas.
   *
   * @param {string} plexFilePath — path retornado pelo Plex (ex: "/music/3/Track.flac")
   * @returns {Promise<AcousticFeatures|null>} null em caso de falha total
   *
   * @typedef {Object} AcousticFeatures
   * @property {string}      codec         — ex: "flac", "mp3", "aac", "opus"
   * @property {number}      duration      — segundos
   * @property {number}      bitrate       — bits/s
   * @property {number}      sampleRate    — Hz
   * @property {number}      channels      — 1=mono, 2=stereo
   * @property {number|null} bpm           — BPM se disponível na tag
   * @property {number|null} rmsDb         — RMS level dBFS (primeiros 30s)
   * @property {number|null} peakDb        — Peak level dBFS (primeiros 30s)
   * @property {number|null} crestFactor   — crest factor (dinâmica)
   * @property {number|null} dynamicRange  — dynamic range dB
   * @property {number|null} flatFactor    — 0=limpo, >0=limitado/clipping
   * @property {number|null} lufsIntegrated — loudness integrado LUFS (faixa inteira)
   * @property {number|null} lufsRange      — loudness range LU (variação dinâmica percebida)
   * @property {number|null} truePeak       — true peak dBFS
   * @property {number}      silencePercent — % do tempo em silêncio (M < -70 LUFS)
   * @property {TemporalSegment[]} temporalArc — arco em 15 segmentos
 * @property {number|null} spectralBassDb  — RMS banda grave 20-250 Hz dBFS (primeiros 30s)
 * @property {number|null} spectralMidDb   — RMS banda média 250-4000 Hz dBFS (primeiros 30s)
 * @property {number|null} spectralHighDb  — RMS banda aguda 4-20 kHz dBFS (primeiros 30s)
   *
   * @typedef {Object} TemporalSegment
   * @property {number}      segment  — índice 0-based (0 = início, 14 = fim)
   * @property {number}      startPct — % de início na faixa (0-100)
   * @property {number}      endPct   — % de fim na faixa (0-100)
   * @property {number|null} lufs     — loudness médio do segmento (LUFS momentâneo)
   * @property {string}      label    — descrição semântica ("quiet", "moderate", "loud", "very loud")
   */
  async analyze(plexFilePath) {
    const localPath = this._resolvePath(plexFilePath);
    if (!localPath || !existsSync(localPath)) {
      logger.debug?.("AUDIO_ANALYZER", `Arquivo não encontrado: ${localPath}`);
      return null;
    }

    // Roda ffprobe + todos os passes do ffmpeg em paralelo
    const [formatResult, astatsResult, ebur128Result, spectralResult] = await Promise.allSettled([
      this._getFormatInfo(localPath),
      this._getAudioStats(localPath),
      this._getEbur128(localPath),
      this._getSpectralBands(localPath),
    ]);

    if (formatResult.status === "rejected") {
      logger.debug?.("AUDIO_ANALYZER", `ffprobe falhou para "${localPath}": ${formatResult.reason?.message}`);
      return null;
    }

    const astatsOk  = astatsResult.status  === "fulfilled";
    const ebur128Ok = ebur128Result.status === "fulfilled";

    if (!astatsOk)  logger.debug?.("AUDIO_ANALYZER", `astats falhou: ${astatsResult.reason?.message}`);
    if (!ebur128Ok) logger.debug?.("AUDIO_ANALYZER", `ebur128 falhou: ${ebur128Result.reason?.message}`);

    return {
      ...formatResult.value,
      ...(astatsOk ? astatsResult.value : {
        rmsDb: null, peakDb: null, crestFactor: null, dynamicRange: null, flatFactor: null,
      }),
      ...(ebur128Ok ? ebur128Result.value : {
        lufsIntegrated: null, lufsRange: null, truePeak: null,
        silencePercent: 0, temporalArc: [],
      }),
      ...(spectralResult.status === "fulfilled" ? spectralResult.value : {
        spectralBassDb: null, spectralMidDb: null, spectralHighDb: null,
      }),
    };
  }

  /**
   * Constrói a descrição textual enriquecida para o embedding.
   *
   * @param {object}           track    — metadados do Plex
   * @param {AcousticFeatures} features — resultado de analyze()
   * @returns {string}
   */
  buildAcousticDescription(track, features) {
    const parts = [];

    // ── Identidade ──────────────────────────────────────────────────────────
    const genreCtx = buildGenreContext(track.genres || []);
    parts.push(
      `"${track.title || "Unknown"}" by ${track.artist || "Unknown Artist"}` +
      (track.album ? `, album "${track.album}"` : "") +
      (genreCtx ? `. Genres: ${genreCtx}.` : ".")
    );

    // ── Formato/técnico ─────────────────────────────────────────────────────
    const dur   = features.duration
      ? `${Math.floor(features.duration / 60)}m${String(Math.round(features.duration % 60)).padStart(2, "0")}s`
      : null;
    const br    = features.bitrate   ? `${Math.round(features.bitrate / 1000)}kbps`    : null;
    const sr    = features.sampleRate ? `${features.sampleRate / 1000}kHz`             : null;
    const ch    = features.channels === 1 ? "mono"
                : features.channels === 2 ? "stereo"
                : features.channels       ? `${features.channels}ch`
                : null;
    const codec = features.codec?.toUpperCase() || null;
    const fmtParts = [dur, codec, br, sr, ch].filter(Boolean);
    if (fmtParts.length) parts.push(`Format: ${fmtParts.join(", ")}.`);

    if (features.bpm) parts.push(`BPM: ${Math.round(features.bpm)}.`);

    // ── Loudness perceptual (LUFS) ──────────────────────────────────────────
    if (features.lufsIntegrated != null) {
      const lufsLabel  = _lufsLabel(features.lufsIntegrated);
      const rangeLabel = features.lufsRange != null ? `, loudness range ${features.lufsRange.toFixed(1)} LU (${_lraLabel(features.lufsRange)})` : "";
      const tpLabel    = features.truePeak  != null ? `, true peak ${features.truePeak.toFixed(1)} dBFS` : "";
      parts.push(`Loudness: ${features.lufsIntegrated.toFixed(1)} LUFS (${lufsLabel})${rangeLabel}${tpLabel}.`);
    } else if (features.rmsDb != null) {
      // Fallback para RMS se ebur128 não disponível
      const energy   = _energyLabel(features.rmsDb);
      const dynamism = _dynamismLabel(features.crestFactor, features.flatFactor);
      const dr       = features.dynamicRange != null ? `, dynamic range ${features.dynamicRange.toFixed(1)} dB` : "";
      parts.push(`Acoustics: RMS ${features.rmsDb.toFixed(1)} dBFS (${energy}), peak ${features.peakDb?.toFixed(1) ?? "?"} dBFS, ${dynamism}${dr}.`);
    }

    // ── Silêncio / densidade ─────────────────────────────────────────────────
    if (features.silencePercent != null && features.silencePercent > 1) {
      parts.push(`Silence: ${features.silencePercent.toFixed(0)}% (${_silenceLabel(features.silencePercent)}).`);
    }

    // ── Arco temporal (15 segmentos) ────────────────────────────────────────
    if (features.temporalArc?.length > 0) {
      const arc = _buildTemporalArcText(features.temporalArc);
      parts.push(`Temporal arc: ${arc}.`);
    }

    // ── Bandas espectrais ────────────────────────────────────────────────────
    const spectralDesc = _spectralProfile(features.spectralBassDb, features.spectralMidDb, features.spectralHighDb);
    if (spectralDesc) parts.push(`Spectral: ${spectralDesc}.`);

    return parts.join(" ");
  }

  /**
   * Converte o path do Plex para o path local real.
   * Ex: "/music/3/Track.flac" → "/home/.../plex_server/music/3/Track.flac"
   */
  _resolvePath(plexPath) {
    if (!plexPath) return null;
    if (!this._plexMediaRoot) return plexPath;
    if (this._plexPathPrefix && plexPath.startsWith(this._plexPathPrefix)) {
      return this._plexMediaRoot + plexPath.slice(this._plexPathPrefix.length);
    }
    return plexPath;
  }

  // ─── ffprobe — formato + tags ─────────────────────────────────────────────

  async _getFormatInfo(localPath) {
    const { stdout } = await execFile(
      this._ffprobe,
      ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", "-select_streams", "a:0", localPath],
      { timeout: FFPROBE_TIMEOUT_MS }
    );

    const data   = JSON.parse(stdout);
    const stream = data.streams?.[0] ?? {};
    const format = data.format ?? {};
    const tags   = { ...format.tags, ...stream.tags };

    const bpmRaw = tags.BPM || tags.TBPM || tags.bpm || tags["TXXX:BPM"] || null;
    const bpm    = bpmRaw ? parseFloat(bpmRaw) : null;

    return {
      codec:      stream.codec_name          || null,
      duration:   parseFloat(format.duration) || null,
      bitrate:    parseInt(format.bit_rate)   || null,
      sampleRate: parseInt(stream.sample_rate) || null,
      channels:   parseInt(stream.channels)   || null,
      bpm:        (bpm && isFinite(bpm)) ? bpm : null,
    };
  }

  // ─── ffmpeg pass 1: astats (primeiros 30s) ────────────────────────────────

  async _getAudioStats(localPath) {
    const { stderr } = await execFile(
      this._ffmpeg,
      ["-t", String(ASTATS_SAMPLE_SECS), "-i", localPath, "-af", "astats", "-f", "null", "-"],
      { timeout: FFMPEG_TIMEOUT_MS }
    );
    return _parseAstats(stderr);
  }

  // ─── ffmpeg pass 2: ebur128 (faixa inteira) ───────────────────────────────

  async _getEbur128(localPath) {
    const { stderr } = await execFile(
      this._ffmpeg,
      ["-i", localPath, "-af", "ebur128=peak=true", "-f", "null", "-"],
      { timeout: FFMPEG_TIMEOUT_MS }
    );
    return _parseEbur128(stderr);
  }

  // ─── ffmpeg pass 3: bandas espectrais (primeiros 30s) ────────────────────

  async _getSpectralBands(localPath) {
    const [bassRes, midRes, highRes] = await Promise.allSettled([
      execFile(this._ffmpeg,
        ["-t", String(ASTATS_SAMPLE_SECS), "-i", localPath, "-af", "lowpass=f=250,astats", "-f", "null", "-"],
        { timeout: FFMPEG_TIMEOUT_MS }),
      execFile(this._ffmpeg,
        ["-t", String(ASTATS_SAMPLE_SECS), "-i", localPath, "-af", "highpass=f=250,lowpass=f=4000,astats", "-f", "null", "-"],
        { timeout: FFMPEG_TIMEOUT_MS }),
      execFile(this._ffmpeg,
        ["-t", String(ASTATS_SAMPLE_SECS), "-i", localPath, "-af", "highpass=f=4000,astats", "-f", "null", "-"],
        { timeout: FFMPEG_TIMEOUT_MS }),
    ]);

    const extractRms = (res) =>
      res.status === "fulfilled" ? (_parseAstats(res.value.stderr)?.rmsDb ?? null) : null;

    return {
      spectralBassDb: extractRms(bassRes),
      spectralMidDb:  extractRms(midRes),
      spectralHighDb: extractRms(highRes),
    };
  }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function _parseAstats(stderr) {
  const lines = stderr.split("\n");
  const get = (key) => {
    let last = null;
    for (const line of lines) {
      const m = line.match(new RegExp(`${key}:\\s*([\\-\\d.]+)`));
      if (m) last = parseFloat(m[1]);
    }
    return last;
  };
  return {
    rmsDb:        get("RMS level dB"),
    peakDb:       get("Peak level dB"),
    crestFactor:  get("Crest factor"),
    dynamicRange: get("Dynamic range"),
    flatFactor:   get("Flat factor"),
  };
}

/**
 * Parseia a saída do filtro ebur128 do ffmpeg.
 *
 * Cada linha de progresso tem o formato:
 *   [Parsed_ebur128_0 @ ...] t: 1.2   TARGET:-23 LUFS   M: -18.3  S: -20.1  I: -14.0 LUFS  LRA: 8.2 LU  FTPK: ...  TPK: ...
 *
 * M (momentâneo, 400ms) é usado para o arco temporal e detecção de silêncio.
 * O bloco Summary ao final contém LUFS integrado, LRA e True Peak.
 */
function _parseEbur128(stderr) {
  // ── coleta amostras momentâneas para arco temporal ─────────────────────
  const momentarySamples = [];  // { t, m } onde m pode ser null (nan)
  const lineRe = /\] t:\s*([\d.]+)\s.*M:\s*([\-\d.]+|nan)/;

  for (const line of stderr.split("\n")) {
    const m = line.match(lineRe);
    if (!m) continue;
    const t    = parseFloat(m[1]);
    const mVal = m[2] === "nan" ? null : parseFloat(m[2]);
    momentarySamples.push({ t, m: mVal });
  }

  // ── Summary block ──────────────────────────────────────────────────────
  const getSum = (key) => {
    // key already includes colon (e.g. "I:"), so no extra ":" in pattern
    const re = new RegExp(`${key}\\s*([\\-\\d.]+)`);
    const m  = stderr.match(re);
    return m ? parseFloat(m[1]) : null;
  };
  const lufsIntegrated = getSum("I:");
  const lufsRange      = getSum("LRA:");
  const truePeak       = getSum("Peak:");  // True peak summary line

  // ── % de silêncio ─────────────────────────────────────────────────────
  const totalSamples   = momentarySamples.length;
  const silentSamples  = momentarySamples.filter(s => s.m === null || s.m < SILENCE_LUFS_FLOOR).length;
  const silencePercent = totalSamples > 0 ? (silentSamples / totalSamples) * 100 : 0;

  // ── Arco temporal: 15 segmentos ────────────────────────────────────────
  const temporalArc = _buildTemporalArc(momentarySamples, TEMPORAL_SEGMENTS);

  return { lufsIntegrated, lufsRange, truePeak, silencePercent, temporalArc };
}

/**
 * Divide as amostras momentâneas em N segmentos uniformes e calcula
 * a loudness média de cada um (ignorando amostras de silêncio/nan).
 *
 * @param {{ t: number, m: number|null }[]} samples
 * @param {number} n — número de segmentos
 * @returns {TemporalSegment[]}
 */
function _buildTemporalArc(samples, n) {
  if (!samples.length) return [];

  const segSize = Math.ceil(samples.length / n);
  const arc = [];

  for (let i = 0; i < n; i++) {
    const slice   = samples.slice(i * segSize, (i + 1) * segSize);
    const active  = slice.filter(s => s.m !== null && s.m > SILENCE_LUFS_FLOOR);
    const avgLufs = active.length > 0
      ? active.reduce((acc, s) => acc + s.m, 0) / active.length
      : null;

    arc.push({
      segment:  i,
      startPct: Math.round((i / n) * 100),
      endPct:   Math.round(((i + 1) / n) * 100),
      lufs:     avgLufs != null ? parseFloat(avgLufs.toFixed(1)) : null,
      label:    avgLufs != null ? _lufsLabel(avgLufs) : "silent",
    });
  }

  return arc;
}

/**
 * Converte o arco de 15 segmentos em texto comprimido para o embedding.
 * Formatos de saída:
 *   — completamente uniforme: "consistent throughout"
 *   — pequena variação: "gradual rise", "gradual fall", "arc (rises then falls)"
 *   — grande variação: lista dos 15 labels separados por →
 *
 * Estratégia: se o desvio médio entre segmentos adjacentes for pequeno, usa
 * uma descrição resumida; se grande, expande todos os labels.
 */
function _buildTemporalArcText(arc) {
  const labels = arc.map(s => s.label);
  const lufsValues = arc.map(s => s.lufs).filter(v => v != null);
  if (!lufsValues.length) return "no signal";

  const min = Math.min(...lufsValues);
  const max = Math.max(...lufsValues);
  const range = max - min;

  // Verifica se é monótono crescente/decrescente
  const diffs = [];
  for (let i = 1; i < lufsValues.length; i++) diffs.push(lufsValues[i] - lufsValues[i - 1]);
  const allRising  = diffs.every(d => d >= -0.5);
  const allFalling = diffs.every(d => d <= 0.5);

  if (range < 2) return "consistent throughout";
  if (range < 4 && allRising)  return "gradual rise throughout";
  if (range < 4 && allFalling) return "gradual fall throughout";

  // Divide em 3 macro-seções para detectar arc shape
  const thirds = [
    lufsValues.slice(0, 5),
    lufsValues.slice(5, 10),
    lufsValues.slice(10, 15),
  ].map(g => g.length ? g.reduce((a, b) => a + b, 0) / g.length : null);

  if (thirds[0] != null && thirds[1] != null && thirds[2] != null) {
    const introLoud = _lufsLabel(thirds[0]);
    const midLoud   = _lufsLabel(thirds[1]);
    const outroLoud = _lufsLabel(thirds[2]);
    if (introLoud === midLoud && midLoud === outroLoud) return `consistent at ${introLoud}`;
  }

  // Variação significativa: expande todos os 15 segmentos
  return labels.join(" → ");
}

// ─── Labels semânticos ───────────────────────────────────────────────────────

/** LUFS integrado ou momentâneo → label textual */
function _lufsLabel(lufs) {
  if (lufs >  -9)  return "very loud";
  if (lufs > -14)  return "loud";
  if (lufs > -18)  return "moderate";
  if (lufs > -23)  return "quiet";
  if (lufs > -32)  return "very quiet";
  return "silent";
}

/** LRA (loudness range) → descrição de dinâmica percebida */
function _lraLabel(lra) {
  if (lra < 3)   return "highly compressed, no variation";
  if (lra < 6)   return "compressed";
  if (lra < 10)  return "moderate dynamics";
  if (lra < 16)  return "wide dynamics";
  return "very wide dynamics, classical/live range";
}

/** % silêncio → descrição de densidade */
function _silenceLabel(pct) {
  if (pct < 3)   return "dense, continuous";
  if (pct < 10)  return "few gaps";
  if (pct < 25)  return "some pauses, structured";
  if (pct < 50)  return "frequent breaks";
  return "sparse, lots of silence";
}

/** RMS dBFS → label de energia (fallback quando ebur128 não disponível) */
function _energyLabel(rmsDb) {
  if (rmsDb > -10)  return "very loud, highly compressed";
  if (rmsDb > -14)  return "loud, energetic";
  if (rmsDb > -18)  return "moderate energy";
  if (rmsDb > -24)  return "dynamic, spacious";
  return "soft, acoustic, low energy";
}

/** Crest factor + flat factor → descrição de dinâmica de amplitude (fallback) */
function _dynamismLabel(crestFactor, flatFactor) {
  if (flatFactor > 0.5)    return "heavily limited, clipped";
  if (crestFactor == null) return "unknown dynamics";
  if (crestFactor < 3)     return "heavily compressed, punchy";
  if (crestFactor < 6)     return "moderately compressed";
  if (crestFactor < 10)    return "natural dynamics";
  return "wide dynamic range, open";
}

/** Relação entre bandas espectrais grave/média/aguda → label descritivo */
function _spectralProfile(bassDb, midDb, highDb) {
  if (bassDb == null || midDb == null || highDb == null) return null;

  const bassVsMid = bassDb - midDb;
  const highVsMid = highDb - midDb;

  let bassLabel;
  if (bassVsMid > 6)       bassLabel = "very heavy bass";
  else if (bassVsMid > 2)  bassLabel = "bass-heavy";
  else if (bassVsMid < -6) bassLabel = "bass-light";
  else                     bassLabel = "balanced bass";

  let highLabel;
  if (highVsMid > 5)        highLabel = "bright highs";
  else if (highVsMid > 2)   highLabel = "slightly bright highs";
  else if (highVsMid < -8)  highLabel = "dark, muffled highs";
  else if (highVsMid < -4)  highLabel = "warm, rolled-off highs";
  else                      highLabel = "neutral highs";

  return `${bassLabel}, ${highLabel}`;
}
