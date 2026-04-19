/**
 * Testes para AudioAnalyzerService
 *
 * Todos os testes são unitários: ffprobe e ffmpeg são mockados via
 * jest.unstable_mockModule() (ESM). Nenhum processo real é executado.
 */

import { jest } from "@jest/globals";

// ── Mocks ESM (devem vir antes do import do módulo em teste) ──────────────────

// Mock: child_process.execFile
const mockExecFile = jest.fn();
jest.unstable_mockModule("child_process", () => ({
  execFile: mockExecFile,
}));

// Mock: fs.existsSync
const mockExistsSync = jest.fn().mockReturnValue(true);
jest.unstable_mockModule("fs", () => ({
  existsSync: mockExistsSync,
}));

// Mock: logger (evita output em testes)
jest.unstable_mockModule("../../src/logger.js", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Importação dinâmica após registrar os mocks
const { AudioAnalyzerService } = await import("../../src/services/AudioAnalyzerService.js");

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** JSON retornado pelo ffprobe para um FLAC estéreo sem BPM na tag */
const FFPROBE_FLAC = JSON.stringify({
  streams: [{
    codec_name: "flac",
    sample_rate: "44100",
    channels: 2,
    tags: {},
  }],
  format: {
    duration: "285.32",
    bit_rate: "900000",
    tags: {},
  },
});

/** JSON retornado pelo ffprobe para um MP3 com tag BPM */
const FFPROBE_MP3_WITH_BPM = JSON.stringify({
  streams: [{
    codec_name: "mp3",
    sample_rate: "44100",
    channels: 2,
    tags: { BPM: "140" },
  }],
  format: {
    duration: "168.00",
    bit_rate: "320000",
    tags: {},
  },
});

/** JSON retornado pelo ffprobe para um AAC mono com TBPM */
const FFPROBE_AAC_TBPM = JSON.stringify({
  streams: [{
    codec_name: "aac",
    sample_rate: "48000",
    channels: 1,
    tags: { TBPM: "90.5" },
  }],
  format: {
    duration: "212.00",
    bit_rate: "256000",
    tags: {},
  },
});

/**
 * stderr típico do ffmpeg astats para uma faixa estéreo.
 * O filtro escreve stats por canal e depois Overall (que queremos).
 */
const FFMPEG_ASTATS_STEREO = `
[Parsed_astats_0 @ 0x...] Channel 1:
[Parsed_astats_0 @ 0x...] DC offset:                             -0.000023
[Parsed_astats_0 @ 0x...] Min level:                             -0.891
[Parsed_astats_0 @ 0x...] Max level:                              0.893
[Parsed_astats_0 @ 0x...] Peak level dB:                         -0.982
[Parsed_astats_0 @ 0x...] RMS level dB:                         -14.312
[Parsed_astats_0 @ 0x...] Crest factor:                           5.88
[Parsed_astats_0 @ 0x...] Dynamic range:                         43.21
[Parsed_astats_0 @ 0x...] Flat factor:                            0.00
[Parsed_astats_0 @ 0x...] Channel 2:
[Parsed_astats_0 @ 0x...] Peak level dB:                         -1.024
[Parsed_astats_0 @ 0x...] RMS level dB:                         -14.891
[Parsed_astats_0 @ 0x...] Crest factor:                           6.00
[Parsed_astats_0 @ 0x...] Dynamic range:                         44.00
[Parsed_astats_0 @ 0x...] Flat factor:                            0.00
[Parsed_astats_0 @ 0x...] Overall:
[Parsed_astats_0 @ 0x...] Peak level dB:                         -0.803
[Parsed_astats_0 @ 0x...] RMS level dB:                         -14.300
[Parsed_astats_0 @ 0x...] Crest factor:                           6.20
[Parsed_astats_0 @ 0x...] Dynamic range:                         45.00
[Parsed_astats_0 @ 0x...] Flat factor:                            0.00
`;

/**
 * Gera um stderr sintético do filtro ebur128 com N amostras momentâneas
 * distribuídas uniformemente em `duration` segundos.
 *
 * @param {number} duration  — duração total em segundos
 * @param {number[]} lufsArc — valores LUFS que se repetem ciclicamente pelas amostras
 *                             (uma entrada = um segmento; 15 entradas = arco completo)
 * @param {{ integrated?: number, lra?: number, peak?: number }} summary
 */
function makeEbur128Stderr(duration = 291, lufsArc = [-14], summary = { integrated: -14, lra: 8, peak: -0.3 }) {
  const STEP = 0.1; // ebur128 emite a cada 100ms
  const lines = [];
  let t = STEP;
  let i = 0;
  while (t <= duration) {
    const m = lufsArc[Math.floor((i / Math.ceil(duration / STEP)) * lufsArc.length)];
    lines.push(
      `[Parsed_ebur128_0 @ 0x...] t: ${t.toFixed(1)      .padStart(7)}  ` +
      `TARGET:-23 LUFS    M: ${String(m.toFixed(1)).padStart(6)} ` +
      `S: ${String(m.toFixed(1)).padStart(6)}     ` +
      `I: ${String((summary.integrated ?? -14).toFixed(1)).padStart(6)} LUFS       ` +
      `LRA: ${String((summary.lra ?? 8).toFixed(1)).padStart(5)} LU  ` +
      `FTPK:   0.0 dBFS  TPK: ${(summary.peak ?? -0.3).toFixed(1)} dBFS`
    );
    t = parseFloat((t + STEP).toFixed(1));
    i++;
  }
  // Summary block
  lines.push("[Parsed_ebur128_0 @ 0x...] Summary:");
  lines.push("");
  lines.push("  Integrated loudness:");
  lines.push(`    I:        ${(summary.integrated ?? -14).toFixed(1)} LUFS`);
  lines.push(`    Threshold: -24.0 LUFS`);
  lines.push("");
  lines.push("  Loudness range:");
  lines.push(`    LRA:       ${(summary.lra ?? 8).toFixed(1)} LU`);
  lines.push(`    Threshold: -34.0 LUFS`);
  lines.push(`    LRA low:  -20.0 LUFS`);
  lines.push(`    LRA high: -12.0 LUFS`);
  lines.push("");
  lines.push("  True peak:");
  lines.push(`    Peak:      ${(summary.peak ?? -0.3).toFixed(1)} dBFS`);
  return lines.join("\n");
}

// Fixture padrão: 291s de faixa, loudness constante a -14 LUFS
const FFMPEG_EBUR128_FLAT = makeEbur128Stderr(291, [-14], { integrated: -14, lra: 8, peak: -0.3 });

// Fixture com arco crescente: começa quiet (-28), termina loud (-9)
const FFMPEG_EBUR128_RISING = makeEbur128Stderr(291,
  [-28, -26, -24, -22, -20, -18, -16, -14, -13, -12, -11, -10, -10, -9, -9],
  { integrated: -16, lra: 18, peak: -0.1 }
);

/** Faixa de metadados do Plex */
const TRACK_METAL = {
  title: "Paranoid",
  artist: "Black Sabbath",
  album: "Paranoid",
  genres: ["Heavy Metal", "Rock"],
  Media: [{ Part: [{ file: "/music/Black Sabbath/Paranoid/01 - Paranoid.mp3" }] }],
};

// ── Factory ───────────────────────────────────────────────────────────────────

function makeService(overrides = {}) {
  return new AudioAnalyzerService({
    plexMediaRoot:  "/srv/music",
    plexPathPrefix: "/music",
    ffprobeBin: "ffprobe",
    ffmpegBin:  "ffmpeg",
    ...overrides,
  });
}

/**
 * Configura execFile para retornar sucesso nas 6 chamadas:
 *   1. ffprobe (stdout = JSON)
 *   2. ffmpeg astats (stderr)
 *   3. ffmpeg ebur128 (stderr)
 *   4-6. ffmpeg bandas espectrais bass/mid/high (stderr)
 */
function mockSuccess({
  ffprobeStdout  = FFPROBE_FLAC,
  astatsStderr   = FFMPEG_ASTATS_STEREO,
  ebur128Stderr  = FFMPEG_EBUR128_FLAT,
  spectralStderr = FFMPEG_ASTATS_STEREO,
} = {}) {
  mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
    cb(null, { stdout: ffprobeStdout, stderr: "" });
  });
  mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
    cb(null, { stdout: "", stderr: astatsStderr });
  });
  mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
    cb(null, { stdout: "", stderr: ebur128Stderr });
  });
  // _getSpectralBands: 3 passes em paralelo (bass, mid, high)
  for (let i = 0; i < 3; i++) {
    mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
      cb(null, { stdout: "", stderr: spectralStderr });
    });
  }
}

/** Mock para quando ffprobe falha (os 5 passes restantes do ffmpeg ainda precisam ser respondidos) */
function mockFfprobeError(err = new Error("ffprobe failed")) {
  mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => { cb(err, null); });
  // astats + ebur128 + 3 espectrais precisam de mocks para não travar
  for (let i = 0; i < 5; i++) {
    mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => { cb(null, { stdout: "", stderr: "" }); });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("AudioAnalyzerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  // ── _resolvePath() ────────────────────────────────────────────────────────

  describe("_resolvePath()", () => {
    it("mapeia /music/track.flac para o path real configurado", () => {
      const svc = makeService();
      expect(svc._resolvePath("/music/Artist/Album/track.flac"))
        .toBe("/srv/music/Artist/Album/track.flac");
    });

    it("retorna o path original quando plexMediaRoot está vazio", () => {
      const svc = makeService({ plexMediaRoot: "" });
      expect(svc._resolvePath("/music/track.flac")).toBe("/music/track.flac");
    });

    it("retorna o path original quando não começa com plexPathPrefix", () => {
      const svc = makeService();
      expect(svc._resolvePath("/data/other/track.flac")).toBe("/data/other/track.flac");
    });

    it("retorna null para input null", () => {
      expect(makeService()._resolvePath(null)).toBeNull();
    });

    it("retorna null para input undefined", () => {
      expect(makeService()._resolvePath(undefined)).toBeNull();
    });

    it("preserva caracteres Unicode no path", () => {
      const svc = makeService();
      expect(svc._resolvePath("/music/Björk/Homogenic/Jóga.m4a"))
        .toBe("/srv/music/Björk/Homogenic/Jóga.m4a");
    });
  });

  // ── analyze() ────────────────────────────────────────────────────────────

  describe("analyze()", () => {
    it("retorna null quando o arquivo não existe no filesystem", async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await makeService().analyze("/music/missing.flac");
      expect(result).toBeNull();
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it("retorna null quando ffprobe lança erro", async () => {
      mockFfprobeError();
      const result = await makeService().analyze("/music/track.flac");
      expect(result).toBeNull();
    });

    it("retorna AcousticFeatures com campos de formato quando ffprobe tem sucesso", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      expect(result).not.toBeNull();
      expect(result.codec).toBe("flac");
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
      expect(result.duration).toBeCloseTo(285.32, 1);
      expect(result.bitrate).toBe(900000);
      expect(result.bpm).toBeNull();
    });

    it("retorna campos astats corretos (RMS, peak, crest) quando pass 1 tem sucesso", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      expect(result.rmsDb).toBeCloseTo(-14.3, 0);
      expect(result.peakDb).toBeCloseTo(-0.803, 1);
      expect(result.crestFactor).toBeCloseTo(6.2, 0);
      expect(result.dynamicRange).toBeCloseTo(45.0, 0);
      expect(result.flatFactor).toBe(0);
    });

    it("retorna campos ebur128 corretos (LUFS, LRA, truePeak) quando pass 2 tem sucesso", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      expect(result.lufsIntegrated).toBeCloseTo(-14, 0);
      expect(result.lufsRange).toBeCloseTo(8, 0);
      expect(result.truePeak).toBeCloseTo(-0.3, 1);
    });

    it("retorna 15 segmentos no temporalArc", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      expect(result.temporalArc).toHaveLength(15);
    });

    it("cada segmento do temporalArc tem segment, startPct, endPct, lufs e label", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      const seg = result.temporalArc[0];
      expect(seg).toHaveProperty("segment", 0);
      expect(seg).toHaveProperty("startPct", 0);
      expect(typeof seg.lufs).toBe("number");
      expect(typeof seg.label).toBe("string");
    });

    it("os segmentos cobrem 0% a 100% sem lacunas", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      expect(result.temporalArc[0].startPct).toBe(0);
      expect(result.temporalArc[14].endPct).toBe(100);
      // Cada segmento começa onde o anterior termina
      for (let i = 1; i < 15; i++) {
        expect(result.temporalArc[i].startPct).toBe(result.temporalArc[i - 1].endPct);
      }
    });

    it("silencePercent é 0 quando todas as amostras têm sinal", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      expect(result.silencePercent).toBeCloseTo(0, 0);
    });

    it("silencePercent é alto quando muitas amostras são nan (silêncio)", async () => {
      // Gera stderr com metade das amostras como silent (LUFS < -70)
      const halfSilent = makeEbur128Stderr(291, [-120, -120, -120, -120, -120, -120, -120, -120, -14, -14, -14, -14, -14, -14, -14],
        { integrated: -20, lra: 15, peak: -1 });
      mockSuccess({ ebur128Stderr: halfSilent });
      const result = await makeService().analyze("/music/track.flac");
      expect(result.silencePercent).toBeGreaterThan(40);
    });

    it("extrai BPM da tag BPM (MP3)", async () => {
      mockSuccess({ ffprobeStdout: FFPROBE_MP3_WITH_BPM });
      const result = await makeService().analyze("/music/track.mp3");
      expect(result.bpm).toBe(140);
    });

    it("extrai BPM da tag TBPM (AAC)", async () => {
      mockSuccess({ ffprobeStdout: FFPROBE_AAC_TBPM });
      const result = await makeService().analyze("/music/track.aac");
      expect(result.bpm).toBeCloseTo(90.5, 1);
    });

    it("retorna features parciais (rmsDb=null) quando astats falha mas ebur128 OK", async () => {
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(null, { stdout: FFPROBE_FLAC, stderr: "" });
      });
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(new Error("ffmpeg astats failed"), null);
      });
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(null, { stdout: "", stderr: FFMPEG_EBUR128_FLAT });
      });
      // _getSpectralBands: 3 passes (bass, mid, high)
      for (let i = 0; i < 3; i++) {
        mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
          cb(null, { stdout: "", stderr: FFMPEG_ASTATS_STEREO });
        });
      }
      const result = await makeService().analyze("/music/track.flac");
      expect(result).not.toBeNull();
      expect(result.codec).toBe("flac");
      expect(result.rmsDb).toBeNull();
      expect(result.lufsIntegrated).toBeCloseTo(-14, 0); // ebur128 ainda disponível
    });

    it("retorna features parciais (lufs=null) quando ebur128 falha mas astats OK", async () => {
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(null, { stdout: FFPROBE_FLAC, stderr: "" });
      });
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(null, { stdout: "", stderr: FFMPEG_ASTATS_STEREO });
      });
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(new Error("ffmpeg ebur128 failed"), null);
      });
      // _getSpectralBands: 3 passes (bass, mid, high)
      for (let i = 0; i < 3; i++) {
        mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
          cb(null, { stdout: "", stderr: FFMPEG_ASTATS_STEREO });
        });
      }
      const result = await makeService().analyze("/music/track.flac");
      expect(result).not.toBeNull();
      expect(result.rmsDb).toBeCloseTo(-14.3, 0);   // astats disponível
      expect(result.lufsIntegrated).toBeNull();       // ebur128 falhou
      expect(result.temporalArc).toEqual([]);
    });

    it("chama ffprobe com os argumentos corretos", async () => {
      mockSuccess();
      await makeService().analyze("/music/Artist/track.flac");
      const [bin, args] = mockExecFile.mock.calls[0];
      expect(bin).toBe("ffprobe");
      expect(args).toContain("-print_format");
      expect(args).toContain("json");
      expect(args).toContain("-show_format");
      expect(args).toContain("-show_streams");
      expect(args).toContain("-select_streams");
      expect(args).toContain("a:0");
      expect(args[args.length - 1]).toBe("/srv/music/Artist/track.flac");
    });

    it("chama ffmpeg com -t 30 e -af astats (pass 1)", async () => {
      mockSuccess();
      await makeService().analyze("/music/track.flac");
      const [bin, args] = mockExecFile.mock.calls[1];
      expect(bin).toBe("ffmpeg");
      expect(args).toContain("-t");
      expect(args).toContain("30");
      expect(args).toContain("-af");
      expect(args).toContain("astats");
    });

    it("chama ffmpeg com ebur128=peak=true (pass 2)", async () => {
      mockSuccess();
      await makeService().analyze("/music/track.flac");
      const [bin, args] = mockExecFile.mock.calls[2];
      expect(bin).toBe("ffmpeg");
      expect(args.join(" ")).toContain("ebur128=peak=true");
      // pass 2 não tem -t (processa a faixa inteira)
      expect(args).not.toContain("-t");
    });

    it("usa os binários personalizados quando configurados", async () => {
      mockSuccess();
      const svc = makeService({ ffprobeBin: "/opt/bin/ffprobe", ffmpegBin: "/opt/bin/ffmpeg" });
      await svc.analyze("/music/track.flac");
      expect(mockExecFile.mock.calls[0][0]).toBe("/opt/bin/ffprobe");
      expect(mockExecFile.mock.calls[1][0]).toBe("/opt/bin/ffmpeg");
      expect(mockExecFile.mock.calls[2][0]).toBe("/opt/bin/ffmpeg");
      expect(mockExecFile.mock.calls[3][0]).toBe("/opt/bin/ffmpeg");
      expect(mockExecFile.mock.calls[4][0]).toBe("/opt/bin/ffmpeg");
      expect(mockExecFile.mock.calls[5][0]).toBe("/opt/bin/ffmpeg");
    });

    it("retorna spectralBassDb, spectralMidDb, spectralHighDb quando passes espectrais têm sucesso", async () => {
      mockSuccess();
      const result = await makeService().analyze("/music/track.flac");
      // spectralStderr padrão = FFMPEG_ASTATS_STEREO cujo RMS Overall = -14.3
      expect(result.spectralBassDb).toBeCloseTo(-14.3, 0);
      expect(result.spectralMidDb).toBeCloseTo(-14.3, 0);
      expect(result.spectralHighDb).toBeCloseTo(-14.3, 0);
    });

    it("retorna spectral null quando os passes espectrais falham", async () => {
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(null, { stdout: FFPROBE_FLAC, stderr: "" });
      });
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(null, { stdout: "", stderr: FFMPEG_ASTATS_STEREO });
      });
      mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
        cb(null, { stdout: "", stderr: FFMPEG_EBUR128_FLAT });
      });
      for (let i = 0; i < 3; i++) {
        mockExecFile.mockImplementationOnce((_bin, _args, _opts, cb) => {
          cb(new Error("spectral failed"), null);
        });
      }
      const result = await makeService().analyze("/music/track.flac");
      expect(result).not.toBeNull();
      expect(result.spectralBassDb).toBeNull();
      expect(result.spectralMidDb).toBeNull();
      expect(result.spectralHighDb).toBeNull();
    });

    it("chama ffmpeg com lowpass=f=250,astats para banda grave (call[3])", async () => {
      mockSuccess();
      await makeService().analyze("/music/track.flac");
      const args = mockExecFile.mock.calls[3][1];
      expect(args.join(" ")).toContain("lowpass=f=250,astats");
    });

    it("chama ffmpeg com highpass=f=250,lowpass=f=4000 para banda média (call[4])", async () => {
      mockSuccess();
      await makeService().analyze("/music/track.flac");
      const args = mockExecFile.mock.calls[4][1];
      expect(args.join(" ")).toContain("highpass=f=250,lowpass=f=4000,astats");
    });

    it("chama ffmpeg com highpass=f=4000,astats para banda aguda (call[5])", async () => {
      mockSuccess();
      await makeService().analyze("/music/track.flac");
      const args = mockExecFile.mock.calls[5][1];
      expect(args.join(" ")).toContain("highpass=f=4000,astats");
      expect(args.join(" ")).not.toContain("lowpass");
    });
  });

  // ── buildAcousticDescription() ───────────────────────────────────────────

  describe("buildAcousticDescription()", () => {
    // Flat 15-segment arc: all segments at -14 LUFS = "loud"
    const FLAT_ARC = Array.from({ length: 15 }, (_, i) => ({
      segment: i,
      startPct: Math.round((i / 15) * 100),
      endPct: Math.round(((i + 1) / 15) * 100),
      lufs: -14,
      label: "loud",
    }));

    // Rising 15-segment arc: segments go from -28 to -9 LUFS
    const RISING_LUFS = [-28, -26, -24, -22, -20, -18, -16, -14, -13, -12, -11, -10, -10, -9, -9];
    const RISING_ARC = RISING_LUFS.map((lufs, i) => ({
      segment: i,
      startPct: Math.round((i / 15) * 100),
      endPct: Math.round(((i + 1) / 15) * 100),
      lufs,
      label: lufs > -9 ? "very loud" : lufs > -14 ? "loud" : lufs > -18 ? "moderate" :
             lufs > -23 ? "quiet" : lufs > -32 ? "very quiet" : "silent",
    }));

    const FULL_FEATURES = {
      codec: "flac", duration: 285, bitrate: 900000, sampleRate: 44100, channels: 2,
      bpm: null, rmsDb: -14.3, peakDb: -0.8, crestFactor: 6.2, dynamicRange: 45.0, flatFactor: 0,
      lufsIntegrated: -14.0, lufsRange: 8.0, truePeak: -0.3,
      silencePercent: 3,
      temporalArc: FLAT_ARC,
      spectralBassDb: -18.0, spectralMidDb: -22.0, spectralHighDb: -28.0,
    };

    // Variant sem LUFS — para testar fallback RMS
    const FEATURES_NO_LUFS = {
      ...FULL_FEATURES,
      lufsIntegrated: null, lufsRange: null, truePeak: null,
    };

    it("inclui título e artista", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("Paranoid");
      expect(desc).toContain("Black Sabbath");
    });

    it("inclui nome do álbum quando disponível", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain('album "Paranoid"');
    });

    it("inclui gêneros", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("Heavy Metal");
      expect(desc).toContain("Rock");
    });

    it("inclui codec em maiúsculas", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("FLAC");
    });

    it("formata duração como Xm00s", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      // 285s = 4m45s
      expect(desc).toContain("4m45s");
    });

    it("formata bitrate em kbps", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("900kbps");
    });

    // ── Loudness / LUFS ──────────────────────────────────────────────────

    it("usa LUFS integrado quando lufsIntegrated está disponível", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("LUFS");
      expect(desc).toContain("-14.0");
    });

    it("inclui loudness range em LU quando disponível", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("LU");
      expect(desc).toContain("8.0");
    });

    it("inclui true peak em dBFS quando disponível", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("dBFS");
      expect(desc).toContain("-0.3");
    });

    it("usa RMS como fallback quando lufsIntegrated é null", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FEATURES_NO_LUFS);
      expect(desc).toContain("-14.3");
      expect(desc).toContain("-0.8");
    });

    it("aplica label de energia baseado em LUFS (-14 = loud)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("loud");
    });

    it("aplica label de energia de fallback via RMS (-13 = loud, energetic)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FEATURES_NO_LUFS, rmsDb: -13 });
      expect(desc).toContain("loud, energetic");
    });

    it("aplica label de energia de fallback via RMS (> -10 = very loud, highly compressed)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FEATURES_NO_LUFS, rmsDb: -8 });
      expect(desc).toContain("very loud, highly compressed");
    });

    it("aplica label de dinâmica (crest=5 = moderately compressed)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FEATURES_NO_LUFS, crestFactor: 5 });
      expect(desc).toContain("moderately compressed");
    });

    it("aplica label de dinâmica (flat factor > 0.5 = heavily limited)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FEATURES_NO_LUFS, flatFactor: 1.2 });
      expect(desc).toContain("heavily limited, clipped");
    });

    // ── Silêncio ─────────────────────────────────────────────────────────

    it("inclui seção Silence quando silencePercent > 1%", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, silencePercent: 5 });
      expect(desc).toContain("Silence:");
    });

    it("omite seção Silence quando silencePercent <= 1%", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, silencePercent: 0.5 });
      expect(desc).not.toContain("Silence:");
    });

    it("inclui percentual de silêncio formatado", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, silencePercent: 3 });
      expect(desc).toContain("3%");
    });

    // ── Temporal arc ─────────────────────────────────────────────────────

    it("inclui seção Temporal arc quando arc tem segmentos", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("Temporal arc:");
    });

    it("omite seção Temporal arc quando arc é vazio", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, temporalArc: [] });
      expect(desc).not.toContain("Temporal arc:");
    });

    it("arco temporal uniforme mostra 'consistent' para loudness uniforme", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("consistent");
    });

    it("arco temporal crescente inclui labels de segmentos individuais", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, temporalArc: RISING_ARC });
      // Rising arc tem muita variação — espera todos os 15 labels separados por →
      expect(desc).toContain("→");
    });

    // ── BPM ──────────────────────────────────────────────────────────────

    it("inclui BPM quando disponível", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, bpm: 140 });
      expect(desc).toContain("BPM");
      expect(desc).toContain("140");
    });

    it("omite linha de BPM quando bpm é null", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, bpm: null });
      expect(desc).not.toContain("BPM");
    });

    // ── Edge cases ────────────────────────────────────────────────────────

    it("omite seção Format quando todos os campos são null", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, {
        codec: null, duration: null, bitrate: null, sampleRate: null, channels: null,
        bpm: null, rmsDb: -14, peakDb: -1, crestFactor: 6, dynamicRange: 40, flatFactor: 0,
        lufsIntegrated: null, lufsRange: null, truePeak: null,
        silencePercent: 0, temporalArc: [],
      });
      expect(desc).not.toContain("Format:");
    });

    it("omite seção Acoustics quando rmsDb e lufsIntegrated são null", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, {
        ...FULL_FEATURES,
        rmsDb: null, peakDb: null,
        lufsIntegrated: null, lufsRange: null, truePeak: null,
      });
      expect(desc).not.toContain("Acoustics:");
    });

    it("preserva Unicode no título e artista", () => {
      const svc = makeService();
      const track = { title: "Jóga", artist: "Björk", album: "Homogenic", genres: ["Art Pop"] };
      const desc = svc.buildAcousticDescription(track, FULL_FEATURES);
      expect(desc).toContain("Jóga");
      expect(desc).toContain("Björk");
    });

    it("usa fallbacks Unknown quando título/artista são undefined", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(
        { title: undefined, artist: undefined, album: undefined, genres: [] },
        FULL_FEATURES,
      );
      expect(desc).toContain("Unknown");
      expect(desc).toContain("Unknown Artist");
    });

    // ── Bandas espectrais ──────────────────────────────────────────

    it("inclui seção Spectral quando todas as bandas estão disponíveis", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      expect(desc).toContain("Spectral:");
    });

    it("inclui label de bass na seção Spectral (bass=-18, mid=-22 → bass-heavy)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      // bassVsMid = -18 - (-22) = 4 > 2 → "bass-heavy"
      expect(desc).toContain("bass-heavy");
    });

    it("inclui label de highs na seção Spectral (high=-28, mid=-22 → warm)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      // highVsMid = -28 - (-22) = -6 < -4 → "warm, rolled-off highs"
      expect(desc).toContain("warm, rolled-off highs");
    });

    it("omite seção Spectral quando spectralBassDb é null", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, { ...FULL_FEATURES, spectralBassDb: null });
      expect(desc).not.toContain("Spectral:");
    });

    it("inclui vocabulário de gênero expandido na descrição (Heavy Metal)", () => {
      const svc = makeService();
      const desc = svc.buildAcousticDescription(TRACK_METAL, FULL_FEATURES);
      // "Heavy Metal" está no genreVocabulary.js com "distorted guitars, ..."
      expect(desc).toContain("distorted guitars");
    });
  });
});
