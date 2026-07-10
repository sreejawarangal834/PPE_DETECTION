# Frame Extraction Pipeline

Extracts frames at a fixed interval from the [Construction Activity Recognition
dataset](https://www.kaggle.com/datasets/ehsaanali/construction-activity-recognition-dataset)
on Kaggle, preserving the `activity/video` folder structure.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your Kaggle credentials (get these
from Kaggle → Account → Create New API Token):

```bash
cp .env.example .env
```

Alternatively, place a `kaggle.json` in `~/.kaggle/` — either method works
with `kagglehub`.

## Usage

```bash
python extract_frames.py --frame-interval 10 --output-dir ./data/frames
```

If you've already downloaded the dataset separately, skip the Kaggle
download and point directly at a local copy:

```bash
python extract_frames.py --dataset-path /path/to/dataset --output-dir ./data/frames
```

### Options

| Flag                | Default            | Description                                |
|---------------------|---------------------|--------------------------------------------|
| `--frame-interval`  | `10`                 | Save every Nth frame from each video       |
| `--output-dir`      | `./data/frames`      | Where extracted frames are written         |
| `--dataset-path`    | *(none)*              | Use a local dataset instead of downloading |

## Output structure

```
data/frames/
  <activity_name>/
    <video_name>/
      frame_00000.jpg
      frame_00010.jpg
      ...
```

## Notes

- Frame images and the `data/` directory are gitignored — they're large and
  regenerable, so they shouldn't live in version control.
- Never commit `.env` or `kaggle.json`. If a Kaggle API key is ever
  accidentally committed, rotate it immediately from the Kaggle account
  settings, since it remains recoverable from git history even after
  deletion.
