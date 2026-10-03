# Animation sheets from ChatGPT → game anims pack

1. `extract.py` (venv with rembg): crops each animation row of `source/<char>_anim_sheet.png`, upscales 2x and mattes it → `reg_<name>.png`.
   Region rectangles are per sheet (edit `R`).
2. `split.py`: splits every region into frames (column gaps + blob ownership: detached blade tips/effects go to the
   figure on their left, blobs that join two figures are split by columns) → `frames/<name>_NN.png` + `frames/meta.json`.
3. `pack_gpt.py`: maps sheet rows to game clips (idle, walk, light, heavy, crouch_heavy, special_cast, rush, hit_high,
   knockdown, getup, win…) with per-frame durations and attack phases, anchors frames on the feet, writes
   `public/assets/fighters/<id>/anims.json` + `anims/<clip>/NN.webp` and a matching static `idle.png`.
Then `npm run art:manifest`.
Run from a working dir containing `sheet.png` (copy from `source/`).

## Green-screen strips (preferred, higher quality)
One PNG per animation in `source/<char>_strips/<clip>.png` (one horizontal row of frames on #00FF00, facing right).
`python strips.py <char_id> source/<char>_strips` keys the green (with despill), splits the row into the frame count
requested in the prompt (`COUNTS`), gives detached blade tips / cape edges back to their own frame, scales everything
from the idle height, anchors on the feet and writes the anims pack. Then `npm run art:manifest`.
