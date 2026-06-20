import { GameSettings } from '../types';



class AudioManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private music: { [key: string]: HTMLAudioElement } = {};
    private currentMusic: string | null = null;
    public musicVolume: number = 0.5;
    public sfxVolume: number = 0.7;
    private initialized: boolean = false;
    private activeDimmingCount: number = 0;

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
        };
        const musicFiles = {
            menu: '/sound/menu.mp3',
            gameplay: '/sound/gameplay.mp3',
            endscreen: '/sound/endscreen.mp3'
        };

        // Preload sounds
        for (const [key, path] of Object.entries(soundFiles)) {
            const audio = new Audio(path);
            audio.preload = 'auto'; // Important for mobile
            this.sounds[key] = audio;
        }

        // Preload music
        for (const [key, path] of Object.entries(musicFiles)) {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.loop = (key !== 'endscreen');
            this.music[key] = audio;
        }
    }

    private applyMusicVolume() {
        if (!this.currentMusic || !this.music[this.currentMusic]) return;
        const targetVol = this.activeDimmingCount > 0 
            ? this.musicVolume * 0.35 // Dim music to 35% of its set volume
            : this.musicVolume;
        this.music[this.currentMusic].volume = targetVol;
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
        if (this.initialized) return;

        try {
            // Unlock audio context constraints for iOS/Android
            // We iterate and play/pause a tiny bit of silence or just volume 0
            const allAudio = [
                ...Object.values(this.sounds),
                ...Object.values(this.music)
            ];

            const results = await Promise.allSettled(allAudio.map(s => {
                s.volume = 0;
                return s.play().then(() => {
                    s.pause();
                    s.currentTime = 0;
                });
            }));

            // If ALL failed, we are still locked.
            const anySuccess = results.some(r => r.status === 'fulfilled');

            if (anySuccess) {
                this.initialized = true;
                // Audio Initialized

                // Restore music
                if (this.currentMusic && this.music[this.currentMusic]) {
                    const music = this.music[this.currentMusic];
                    this.applyMusicVolume();
                    music.play().catch(() => { });
                }
            } else {
                // Audio Autoplay Blocked - Waiting for User Interaction
            }
        } catch (e) {
            // Audio initialization failed
        }
    }

    public playSound(key: string, options?: { volume?: number, playbackRate?: number }) {
        // If not initialized, we shouldn't crash, but we might not hear it yet depending on browser.
        // Better: Try to play.
        const original = this.sounds[key];
        if (!original) return;

        // Clone for polyphony (multiple overlapping sounds)
        // Optimization: For mobile, limit concurrent sounds if needed, but modern devices handle 5-10 fine.
        const sound = original.cloneNode() as HTMLAudioElement;

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
            'phone', 'saw', 'choke', 'remote', 'contract', 'luckycharm', 'flashbang', 'crusher', 'totem', 'mirror'
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
        // If same track requested
        if (this.currentMusic === key) {
            const track = this.music[key];
            if (track && this.initialized) {
                // If it's paused (finished non-looping track), restart it
                if (track.paused) {
                    track.currentTime = 0;
                    track.play().catch(() => { });
                }
            }
            return;
        }

        // Fade out/stop old
        if (this.currentMusic && this.music[this.currentMusic]) {
            const oldMusic = this.music[this.currentMusic];
            oldMusic.pause();
            oldMusic.currentTime = 0;
        }

        this.currentMusic = key;
        const newMusic = this.music[key];

        if (newMusic) {
            this.applyMusicVolume();
            newMusic.currentTime = 0;

            const playPromise = newMusic.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (error.name === 'NotAllowedError') {
                        // Expected if user hasn't clicked yet. 
                        // It will start once initialize() is called.
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
    }

    public stopMusic() {
        if (this.currentMusic && this.music[this.currentMusic]) {
            this.music[this.currentMusic].pause();
            this.music[this.currentMusic].currentTime = 0;
        }
        this.currentMusic = null;
    }
}

export const audioManager = new AudioManager();
