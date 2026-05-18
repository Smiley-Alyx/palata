export type MusicConfig = {
  src: string;
  loop?: boolean;
  volume?: number;
};

// SfxKey is intentionally a free-form string so the registry in
// `sfx-config.ts` can grow without touching the audio manager.
// The narrative roadmap uses namespaced keys (e.g. `weapon.pipe.swing`)
// alongside legacy short keys (`doorOpen`, `footstep`, ...) for back-compat.
export type SfxKey = string;

export class AudioManager {
  private unlocked = false;

  private musicEnabled = true;
  private sfxEnabled = true;

  private musicVolume = 0.5;
  private sfxVolume = 0.7;

  private musicEl: HTMLAudioElement | null = null;
  private musicConfig: MusicConfig | null = null;

  private sfxSrcByKey: Partial<Record<SfxKey, string>> = {};

  private loopingSfxElByKey: Partial<Record<SfxKey, HTMLAudioElement>> = {};

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    this.playMusic();

    if (this.musicEl) {
      this.musicEl.muted = true;
      void this.musicEl
        .play()
        .catch(() => {
          // ignore autoplay restrictions
        })
        .finally(() => {
          if (this.musicEl) {
            this.musicEl.pause();
            this.musicEl.currentTime = 0;
            this.musicEl.muted = false;
          }
        });
    }
  }

  getMusicEnabled() {
    return this.musicEnabled;
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else {
      this.playMusic();
    }
  }

  getSfxEnabled() {
    return this.sfxEnabled;
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (!enabled) {
      this.stopAllLoopingSfx();
    }
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  setMusicVolume(volume: number) {
    const v = Math.max(0, Math.min(1, volume));
    this.musicVolume = v;
    this.applyMusicVolume();
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  setSfxVolume(volume: number) {
    const v = Math.max(0, Math.min(1, volume));
    this.sfxVolume = v;
  }

  private applyMusicVolume() {
    if (!this.musicEl) return;
    const base = this.musicConfig?.volume ?? 0.5;
    this.musicEl.volume = Math.max(0, Math.min(1, base * this.musicVolume));
  }

  setMusic(config: MusicConfig | null) {
    this.musicConfig = config;

    if (!config) {
      if (this.musicEl) {
        this.musicEl.pause();
        this.musicEl.src = '';
        this.musicEl = null;
      }
      return;
    }

    if (!this.musicEl) {
      this.musicEl = new Audio();
    }

    this.musicEl.src = config.src;
    this.musicEl.loop = config.loop ?? true;
    this.applyMusicVolume();

    this.playMusic();
  }

  playMusic() {
    if (!this.musicEl || !this.musicConfig) return;
    if (!this.unlocked) return;
    if (!this.musicEnabled) return;
    void this.musicEl.play().catch(() => {
      // ignore
    });
  }

  stopMusic() {
    if (!this.musicEl) return;
    this.musicEl.pause();
    this.musicEl.currentTime = 0;
  }

  setSfxSources(sources: Partial<Record<SfxKey, string>> | null) {
    this.sfxSrcByKey = sources ?? {};
  }

  getSfxSrc(key: SfxKey): string | undefined {
    return this.sfxSrcByKey[key];
  }

  playSfx(key: SfxKey, volume = 0.7) {
    if (!this.unlocked) return;
    if (!this.sfxEnabled) return;
    const src = this.sfxSrcByKey[key];
    if (!src) return;

    const el = new Audio(src);
    el.volume = Math.max(0, Math.min(1, volume * this.sfxVolume));
    void el.play().catch(() => {
      // ignore
    });
  }

  /**
   * Start (or update volume of) a looping SFX channel keyed by `key`.
   *
   * When `srcOverride` is provided it bypasses the registry — useful for
   * systems that want multiple instances of the same registered sound to
   * play independently (each with a unique key).
   */
  playLoopingSfx(key: SfxKey, volume = 0.7, srcOverride?: string) {
    if (!this.unlocked) return;
    if (!this.sfxEnabled) return;

    const src = srcOverride ?? this.sfxSrcByKey[key];
    if (!src) return;

    const existing = this.loopingSfxElByKey[key];
    if (existing && existing.src === src && !existing.paused) {
      existing.volume = Math.max(0, Math.min(1, volume * this.sfxVolume));
      return;
    }

    if (existing) {
      existing.pause();
      existing.currentTime = 0;
    }

    const el = new Audio(src);
    el.loop = true;
    el.volume = Math.max(0, Math.min(1, volume * this.sfxVolume));
    this.loopingSfxElByKey[key] = el;
    void el.play().catch(() => {
      // ignore
    });
  }

  stopLoopingSfx(key: SfxKey) {
    const el = this.loopingSfxElByKey[key];
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    delete this.loopingSfxElByKey[key];
  }

  private stopAllLoopingSfx() {
    for (const el of Object.values(this.loopingSfxElByKey)) {
      if (!el) continue;
      el.pause();
      el.currentTime = 0;
    }
    this.loopingSfxElByKey = {};
  }
}
