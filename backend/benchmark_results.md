# Inference latency benchmark

Sample video: `18ff0f7575ad4757b9a93d9ce7fea133.mp4`

### Device: cuda

| stage | mean_ms | median_ms | p95_ms | max_ms |
|---|---|---|---|---|
| preprocess | 4.16 | 4.14 | 4.18 | 6.52 |
| inference | 5.17 | 5.13 | 5.47 | 5.68 |
| postprocess | 0.12 | 0.11 | 0.14 | 0.15 |
| total | 9.45 | 9.39 | 9.79 | 11.82 |

Frames measured: 150 — mean end-to-end FPS: **105.83**

### Device: cpu

| stage | mean_ms | median_ms | p95_ms | max_ms |
|---|---|---|---|---|
| preprocess | 4.20 | 4.17 | 4.44 | 5.08 |
| inference | 55.49 | 56.43 | 57.95 | 61.49 |
| postprocess | 0.13 | 0.13 | 0.15 | 0.16 |
| total | 59.83 | 60.77 | 62.34 | 65.97 |

Frames measured: 150 — mean end-to-end FPS: **16.71**
