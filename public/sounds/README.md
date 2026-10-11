# Dialogue sounds

Put your audio files here (mp3 / ogg / wav / m4a, keep them short, a few seconds each),
then reference them from `dialogues.json` in the project root, for example:

    { "id": "mass", "emoji": "🔥", "text": "Your dialogue text", "sound": "sounds/mass.mp3" }

- `id`    unique, letters/numbers/dashes. This is what clients send to the server.
- `text`  what everyone sees in the quick-chat list, the chat and the on-screen caption (Tamil or English).
- `sound` optional. Path relative to `public/`. If the file is missing the line is shown without sound.
- `emoji` optional.
- `cooldownMs` (top level) is the minimum gap between two dialogues from the same player.

`dialogues.json` is re-read automatically when it changes, so no restart is needed locally.
On Render, commit + push to redeploy.
