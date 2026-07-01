import { GameSettings } from '../types';



class AudioManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private music: { [key: string]: HTMLAudioElement } = {};
    private currentMusic: string | null = null;
    public musicVolume: number = 0.5;
    public sfxVolume: number = 0.7;
    private initialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;
    private activeDimmingCount: number = 0;
    private loadPromises: Promise<void>[] = [];
    private pendingMusic: string | null = null;
    public isInitialized: boolean = false;

    constructor() {
        this.loadAssets();
    }

    private loadAssets() {
        if (typeof window === 'undefined') return;

        const soundFiles = {
            grab: '/sound/grab1.ogg',
            click: '/sound/grab1.ogg',
            blankshell: '/sound/blankshellshoot.wav',
            liveshell: '/sound/liveshellshoot.mp3',
            // New Animation Sounds
            standing: '/sound/AnimationSounds/Standing.mp3',
            dropping: '/sound/AnimationSounds/droping.mp3',
            checkhandcuffs: '/sound/AnimationSounds/checkhandcuffs.mp3',
            handcuffed: '/sound/AnimationSounds/handcuffed.mp3',
            adrenaline: '/sound/AnimationSounds/adrenaline.mp3',
            beer: '/sound/AnimationSounds/beer.mp3',
            cig: '/sound/AnimationSounds/cig.mp3',
            glass: '/sound/AnimationSounds/glass.mp3',
            inverter: '/sound/AnimationSounds/inverter.mp3',
            big_inverter: '/sound/AnimationSounds/BigInverter.mp3',
            phone: '/sound/AnimationSounds/phone.mp3',
            saw: '/sound/AnimationSounds/saw.mp3',
            choke: '/sound/AnimationSounds/Choke.mp3',
            remote: '/sound/AnimationSounds/remote.mp3',
            contract: '/sound/AnimationSounds/BloodContract.mp3',
            luckycharm: '/sound/AnimationSounds/luckcharm.mp3',
            flashbang: '/sound/AnimationSounds/flashbang.mp3',
            crusher: '/sound/crusher.mp3',
            totem: '/sound/AnimationSounds/Totem.mp3',
            mirror: '/sound/AnimationSounds/mirror.mp3',
            cards: '/sound/AnimationSounds/cards.mp3',
            slotmachine: '/sound/AnimationSounds/slotmachine.mp3',
            jackpot: '/sound/AnimationSounds/jackpot.mp3',
            jackpotloop: '/sound/AnimationSounds/jackpotloop.mp3',
        };
        const musicFiles = {
            menu: '/sound/menu.mp3',
            gameplay: '/sound/gameplay.mp3',
            endscreen: '/sound/endscreen.mp3'
        };

        const loadAudio = (audio: HTMLAudioElement) => new Promise<void>((resolve) => {
            const onDone = () => {
                audio.removeEventListener('canplaythrough', onDone);
                audio.removeEventListener('error', onDone);
                resolve();
            };
            audio.addEventListener('canplaythrough', onDone, { once: true });
            audio.addEventListener('error', onDone, { once: true });
            audio.preload = 'auto';
            try {
                audio.load();
            } catch (e) {
                resolve();
            }
        });

        for (const [key, path] of Object.entries(soundFiles)) {
            const audio = new Audio(path);
            audio.preload = 'auto'; // Important for mobile
            this.sounds[key] = audio;
            this.loadPromises.push(loadAudio(audio));
        }

        for (const [key, path] of Object.entries(musicFiles)) {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.loop = (key !== 'endscreen');
            this.music[key] = audio;
            this.loadPromises.push(loadAudio(audio));
        }
    }

    private applyMusicVolume() {
        if (!this.currentMusic || !this.music[this.currentMusic]) return;
        let scale = 1.0;
        if (this.isJackpotActive) {
            scale = 0.05; // Lower it even more, almost mute (5%)
        } else if (this.activeDimmingCount > 0) {
            scale = 0.35; // Dim music to 35% of its set volume
        }
        this.music[this.currentMusic].volume = this.musicVolume * scale;
    }

    public getAudioLoadingProgress(): number {
        if (typeof window === 'undefined') return 100;
        const allAudio = [
            ...Object.values(this.sounds),
            ...Object.values(this.music)
        ];
        if (allAudio.length === 0) return 100;
        let loadedCount = 0;
        allAudio.forEach(audio => {
            if (audio.readyState >= 2 || audio.error) {
                loadedCount++;
            }
        });
        return Math.round((loadedCount / allAudio.length) * 100);
    }

    // Call this on the first user interaction (e.g., clicking "ENTER" or anywhere on splash screen)
    public async initialize() {
        if (this.initialized) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            try {
                await Promise.allSettled(this.loadPromises);

                const allAudio = [
                    ...Object.values(this.sounds),
                    ...Object.values(this.music)
                ];

                const results = await Promise.allSettled(allAudio.map(async (s) => {
                    s.volume = 0;
                    s.muted = true;
                    try {
                        await s.play();
                    } catch (error) {
                        // Ignore autoplay prevention errors, we only want playback unlocking if possible.
                    }
                    s.pause();
                    s.currentTime = 0;
                    s.muted = false;
                }));

                const anySuccess = results.some(r => r.status === 'fulfilled');
                this.isInitialized = anySuccess || allAudio.length === 0;
                this.initialized = true;

                if (this.currentMusic && this.music[this.currentMusic]) {
                    const music = this.music[this.currentMusic];
                    this.applyMusicVolume();
                    music.play().catch(() => { });
                } else if (this.pendingMusic) {
                    const queued = this.pendingMusic;
                    this.pendingMusic = null;
                    this.playMusic(queued);
                }
            } catch (e) {
                this.initialized = true;
                console.warn('Audio initialization failed:', e);
            } finally {
                this.initializationPromise = null;
            }
        })();

        return this.initializationPromise;
    }

    public playSound(key: string, options?: { volume?: number, playbackRate?: number }) {
        // If not initialized, we shouldn't crash, but we might not hear it yet depending on browser.
        // Better: Try to play.
        const original = this.sounds[key];
        if (!original) return;

        // Clone for polyphony (multiple overlapping sounds)
        // Optimization: For mobile, limit concurrent sounds if needed, but modern devices handle 5-10 fine.
        const sound = original.cloneNode() as HTMLAudioElement;
        sound.preload = 'auto';
        sound.muted = false;
        if (sound.readyState < 2) {
            try {
                sound.load();
            } catch (e) {
                // Some browsers may reject load on cloned objects.
            }
        }
        sound.currentTime = 0;

        // BOOST specific sounds
        const boostMap: { [key: string]: number } = {
            'liveshell': 1.5,
            'blankshell': 1.5,
            'grab': 1.5,
            'click': 0.8 // Slightly quieter
        };
        const boost = boostMap[key] || 1.0;

        // Check if this sound should dim the background music
        const shouldDim = [
            'dropping', 'checkhandcuffs', 'handcuffed', 'adrenaline', 
            'beer', 'cig', 'glass', 'inverter', 'big_inverter', 
            'phone', 'saw', 'choke', 'remote', 'contract', 'luckycharm', 'flashbang', 'crusher', 'totem', 'mirror',
            'slotmachine'
        ].includes(key);

        if (shouldDim) {
            this.activeDimmingCount++;
            this.applyMusicVolume();
        }

        let finalVolume = this.sfxVolume * boost;
        if (options?.volume) finalVolume *= options.volume;
        sound.volume = Math.min(1.0, finalVolume);

        if (options?.playbackRate) {
            sound.preservesPitch = false;
            sound.playbackRate = options.playbackRate;
        }

        const playPromise = sound.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (shouldDim) {
                    this.activeDimmingCount = Math.max(0, this.activeDimmingCount - 1);
                    this.applyMusicVolume();
                }
                // Auto-play was prevented. This happens if playSound is called before any user interaction.
                // We silently ignore it to avoid console spam.
                if (error.name !== 'NotAllowedError') {
                    console.warn(`SFX '${key}' error:`, error);
                }
            });
        }

        // Cleanup when done (garbage collection help)
        sound.onended = () => {
            sound.pause();
            sound.src = '';
            sound.onended = null;
            if (shouldDim) {
                this.activeDimmingCount = Math.max(0, this.activeDimmingCount - 1);
                this.applyMusicVolume();
            }
        };
    }

    public playMusic(key: string) {
        if (this.currentMusic === key) {
            const track = this.music[key];
            if (track && this.isInitialized) {
                if (track.paused) {
                    track.currentTime = 0;
                    track.play().catch(() => { });
                }
            }
            return;
        }

        if (this.currentMusic && this.music[this.currentMusic]) {
            const oldMusic = this.music[this.currentMusic];
            oldMusic.pause();
            oldMusic.currentTime = 0;
        }

        this.currentMusic = key;
        const newMusic = this.music[key];

        if (!this.isInitialized) {
            this.pendingMusic = key;
            return;
        }

        if (newMusic) {
            this.applyMusicVolume();
            newMusic.currentTime = 0;

            const playPromise = newMusic.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (error.name === 'NotAllowedError') {
                        this.pendingMusic = key;
                    } else {
                        console.warn(`Music '${key}' error:`, error);
                    }
                });
            }
        }
    }

    public updateVolumes(settings: GameSettings) {
        this.musicVolume = settings.musicVolume ?? 0.5;
        this.sfxVolume = settings.sfxVolume ?? 0.7;
        this.applyMusicVolume();
        if (this.jackpotIntroAudio) {
            this.jackpotIntroAudio.volume = this.sfxVolume;
        }
        if (this.jackpotLoopAudio) {
            this.jackpotLoopAudio.volume = this.sfxVolume;
        }
    }

    public stopMusic() {
        if (this.currentMusic && this.music[this.currentMusic]) {
            this.music[this.currentMusic].pause();
            this.music[this.currentMusic].currentTime = 0;
        }
        this.currentMusic = null;
    }

    private jackpotIntroAudio: HTMLAudioElement | null = null;
    private jackpotLoopAudio: HTMLAudioElement | null = null;
    private isJackpotActive: boolean = false;

    public playJackpotIntro() {
        this.stopJackpotMusic();

        const intro = this.sounds['jackpot'];
        if (!intro) return;

        this.isJackpotActive = true;
        this.applyMusicVolume();

        this.jackpotIntroAudio = intro.cloneNode() as HTMLAudioElement;
        this.jackpotIntroAudio.volume = this.sfxVolume;
        this.jackpotIntroAudio.onended = () => {
            this.playJackpotLoop();
        };
        this.jackpotIntroAudio.play().catch(e => {
            console.warn("Jackpot intro blocked", e);
        });
    }

    public playJackpotLoop() {
        if (this.jackpotIntroAudio) {
            this.jackpotIntroAudio.onended = null;
            this.jackpotIntroAudio.pause();
            this.jackpotIntroAudio = null;
        }

        const loop = this.sounds['jackpotloop'];
        if (!loop) {
            this.isJackpotActive = false;
            this.applyMusicVolume();
            return;
        }

        this.isJackpotActive = true;
        this.applyMusicVolume();

        this.jackpotLoopAudio = loop.cloneNode() as HTMLAudioElement;
        this.jackpotLoopAudio.loop = true;
        this.jackpotLoopAudio.volume = this.sfxVolume;
        this.jackpotLoopAudio.play().catch(e => console.warn("Jackpot loop blocked", e));
    }

    public stopJackpotMusic() {
        if (this.jackpotIntroAudio) {
            this.jackpotIntroAudio.onended = null;
            this.jackpotIntroAudio.pause();
            this.jackpotIntroAudio = null;
        }
        if (this.jackpotLoopAudio) {
            this.jackpotLoopAudio.pause();
            this.jackpotLoopAudio = null;
        }
        this.isJackpotActive = false;
        this.applyMusicVolume();
    }
}

export const audioManager = new AudioManager();
