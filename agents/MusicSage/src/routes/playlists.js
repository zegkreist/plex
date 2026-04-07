/**
 * POST   /api/playlists/generate     → gera nova playlist por critérios
 * POST   /api/playlists/from-prompt  → gera playlist a partir de texto livre
 * POST   /api/playlists/:id/push-to-plex → cria playlist no servidor Plex
 * GET    /api/playlists              → lista playlists salvas
 * GET    /api/playlists/:id          → retorna playlist específica
 * PATCH  /api/playlists/:id          → atualiza nome e/ou faixas (sincroniza com Plex se sincronizado)
 * DELETE /api/playlists/:id          → remove playlist (e do Plex se sincronizado)
 */

/** Tenta sincronizar uma playlist com o Plex em background (não bloqueia). */
function _tryPushToPlex(plexService, playlistBuilder, saved) {
  if (!plexService || saved.plexId) return;
  const keys = (saved.tracks || []).map((t) => t.ratingKey).filter(Boolean);
  if (!keys.length) return;
  plexService
    .pushPlaylist(saved.name, keys)
    .then(({ plexId }) => playlistBuilder.update(saved.id, { plexId }))
    .catch((err) => {
      // Plex pode estar offline — não é crítico
      import("../logger.js").then(({ logger }) =>
        logger.warn("PLAYLIST", `Plex sync falhou para "${saved.name}": ${err.message}`)
      );
    });
}

export function playlistsRouter(router, { playlistBuilder, plexService } = {}) {
  // POST /api/playlists/generate
  router.post("/playlists/generate", async (req, res) => {
    const { name, mood, genre, energy, size } = req.body || {};
    try {
      const playlist = await playlistBuilder.generate({
        name,
        mood,
        genre,
        energy,
        size: size ? parseInt(size, 10) : 10,
      });
      const saved = playlistBuilder.save(playlist);
      // Tenta sincronizar com Plex em background (não bloqueia a resposta)
      _tryPushToPlex(plexService, playlistBuilder, saved);
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/playlists
  router.get("/playlists", (_req, res) => {
    res.json(playlistBuilder.list());
  });

  // GET /api/playlists/:id
  router.get("/playlists/:id", (req, res) => {
    const playlist = playlistBuilder.get(req.params.id);
    if (!playlist) return res.status(404).json({ error: "Playlist não encontrada" });
    res.json(playlist);
  });

  // POST /api/playlists/from-prompt
  router.post("/playlists/from-prompt", async (req, res) => {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Campo 'prompt' é obrigatório" });
    }
    try {
      const playlist = await playlistBuilder.generateFromPrompt(prompt.trim());
      const saved = playlistBuilder.save(playlist);
      _tryPushToPlex(plexService, playlistBuilder, saved);
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/playlists/:id — atualiza localmente e sincroniza com Plex se já estiver lá
  router.patch("/playlists/:id", async (req, res) => {
    const { name, tracks } = req.body || {};
    if (name === undefined && tracks === undefined) {
      return res.status(400).json({ error: "Informe ao menos 'name' ou 'tracks' para atualizar" });
    }

    const existing = playlistBuilder.get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Playlist não encontrada" });

    const fields = {};
    if (name !== undefined) fields.name = name;
    if (tracks !== undefined) fields.tracks = tracks;
    const updated = playlistBuilder.update(req.params.id, fields);

    // Sincroniza com Plex em background se a playlist já foi enviada ao Plex
    if (plexService && existing.plexId) {
      const { plexId } = existing;
      const currentTracks = updated.tracks || [];
      const keys = currentTracks.map((t) => t.ratingKey).filter(Boolean);

      const _log = async (level, msg) => {
        const { logger } = await import("../logger.js");
        logger[level]("PLAYLIST", msg);
      };

      // Fallback: recria a playlist no Plex do zero (usado quando plexId está obsoleto)
      const _recreateInPlex = async () => {
        if (!keys.length) { playlistBuilder.update(updated.id, { plexId: null }); return; }
        try {
          const { plexId: newId } = await plexService.pushPlaylist(updated.name, keys);
          playlistBuilder.update(updated.id, { plexId: newId });
          _log("info", `Plex: playlist "${updated.name}" recriada (id=${newId})`);
        } catch (e2) {
          playlistBuilder.update(updated.id, { plexId: null });
          _log("warn", `Plex: não foi possível recriar "${updated.name}": ${e2.message}`);
        }
      };

      if (name !== undefined && tracks === undefined) {
        // Apenas renomear — se falhar, tenta recriar com todas as faixas atuais
        plexService
          .renamePlaylist(plexId, updated.name)
          .catch(() => _recreateInPlex());
      } else if (keys.length) {
        // Faixas mudaram: recria a playlist no Plex (delete + push)
        plexService
          .updatePlaylistTracks(plexId, updated.name, keys)
          .then(({ plexId: newPlexId }) => playlistBuilder.update(updated.id, { plexId: newPlexId }))
          .catch(() => _recreateInPlex());
      } else {
        // Playlist ficou vazia: remove do Plex e limpa plexId local
        plexService
          .deletePlaylist(plexId)
          .then(() => playlistBuilder.update(updated.id, { plexId: null }))
          .catch((err) => _log("warn", `Plex delete (vazia) falhou: ${err.message}`));
      }
    }

    res.json(updated);
  });

  // POST /api/playlists/:id/push-to-plex
  router.post("/playlists/:id/push-to-plex", async (req, res) => {
    if (!plexService) return res.status(503).json({ error: "PlexService não configurado" });
    const pl = playlistBuilder.get(req.params.id);
    if (!pl) return res.status(404).json({ error: "Playlist não encontrada" });
    try {
      const keys = (pl.tracks || []).map((t) => t.ratingKey).filter(Boolean);
      if (!keys.length) return res.status(400).json({ error: "Playlist não tem faixas com ratingKey" });
      // Se já estava sincronizado, remove a versão antiga antes de recriar
      if (pl.plexId) {
        await plexService.deletePlaylist(pl.plexId).catch(() => { /* já inexistente */ });
      }
      const { plexId } = await plexService.pushPlaylist(pl.name, keys);
      const updated = playlistBuilder.update(pl.id, { plexId });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/playlists/:id — remove localmente e do Plex se sincronizado
  router.delete("/playlists/:id", async (req, res) => {
    const pl = playlistBuilder.get(req.params.id);
    if (!pl) return res.status(404).json({ error: "Playlist não encontrada" });

    playlistBuilder.delete(req.params.id);

    // Remove do Plex em background (não bloqueia resposta)
    if (plexService && pl.plexId) {
      plexService.deletePlaylist(pl.plexId).catch((err) =>
        import("../logger.js").then(({ logger }) =>
          logger.warn("PLAYLIST", `Plex delete falhou para "${pl.name}": ${err.message}`)
        )
      );
    }

    res.status(204).send();
  });

  return router;
}
