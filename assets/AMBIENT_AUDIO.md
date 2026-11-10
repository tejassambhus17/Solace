# Original ambient loops

- ambient-forest.wav — Forest air: softly filtered noise with a sparse synthesized high tone.
- ambient-ocean.wav — Ocean hush: filtered noise shaped by a slow periodic envelope.
- ambient-twilight.wav — Twilight tones: quiet 110/165/220 Hz sine tones with low noise.
- ambient-rain.wav — Rain: original filtered noise with a gently varying high-frequency texture.
- ambient-wind.wav — Soft wind: original low filtered noise with a slow gust envelope.

These are original procedural compositions made for Solace using deterministic Python synthesis. Each is a 12-second, 22,050 Hz, mono, signed 16-bit PCM WAV (529,244 bytes), with short edge fades. Moments loop the selected environment at low volume and pause with the activity. The mixer plays independent foreground tracks with adjustable levels and an optional stop timer. Sound starts after a user action.

The mixer applies separate gain trims to these original files. At the same slider and master settings, the four tracks' measured RMS levels are within 3 dB, and the sum of their individual peak amplitudes at full volume remains below 0.8 of full scale. The trim affects mixer playback only. Muting sets the layer level to zero and unmuting restores its previous level for the current visit.

Environment visuals compose existing botanical.png and dark-night.png with code-rendered wave/sky geometry. Their original raster provenance remains in the existing artwork documents. No new external image or audio license is required for these compositions.
