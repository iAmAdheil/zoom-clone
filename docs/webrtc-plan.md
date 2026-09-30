# WebRTC plan (stage 3, decided by the lead)

## Topology
Peer-to-peer mesh. Each participant keeps one `RTCPeerConnection` per other participant. This suits rooms of 2 to 6 people. Above 6 people, the UI keeps working but video may degrade. Do not add an SFU.

## Signaling
Use the existing meeting WebSocket. Messages are defined in `docs/api.md` (`signal`, and `connected_ids` in the `snapshot`). The server never reads `data`.

`data` format (owned by the frontend):
- `{"kind":"offer","sdp":"..."}`
- `{"kind":"answer","sdp":"..."}`
- `{"kind":"ice","candidate":{...}}`

## Who calls whom (avoids glare)
- When a client gets its `snapshot`, it does not call anybody.
- A newly joined client is called by every client that is already connected. The old client sends the offer when it receives `participant_joined` for that id.
- The server sends `participant_joined` when the first socket of the new participant opens, not at REST join time (BUG-01). So the new client is connected when the event arrives, and a `signal` to it does not get `bad_target` for that reason. The `hello` step in `peerManager.ts` still works and is still safe to keep. (Its code comment about REST join time is out of date. Fix it with the next frontend change.)
- Rule to break any tie: the client with the lower participant id is the offerer for that pair.
- Use the "perfect negotiation" pattern only if a test shows glare. Keep the code simple otherwise.

## Media
- Local stream: one `getUserMedia({audio: true, video: true})` call. It already exists in pre-join. Reuse the same stream in the room. Do not open the camera twice.
- Mute and video toggles set `track.enabled` and also send the `set_muted` and `set_video_off` events (already built in stage 2). Remote tiles use the events for the icons, and the remote stream for the picture.
- A tile shows the avatar when `is_video_off` is true, or when the peer has no video track.
- If the user denies the camera or microphone, join anyway as "no media". The user can still see and hear others.
- Remote audio plays through a hidden `<audio autoplay>` element, or the `<video>` element of the tile. Do not play the local audio back to the user.

## Media update (audio fix)
- The devices open at page load only when the Permissions API says "granted". Else the pre-join page shows "Allow camera and microphone", and `getUserMedia` runs inside that tap (or inside the Join tap). Mobile browsers may show no prompt without a tap.
- `getUserMedia` asks for both devices first, then for each one alone. Audio constraints set `echoCancellation`, `noiseSuppression` and `autoGainControl` to true.
- Each connection has one audio and one video transceiver, "sendrecv", even with no local track. Mute, device change and a late "Allow" use `replaceTrack` only. No renegotiation.
- The `replaceTrack` calls of one peer run in a chain, and each call reads the wanted track when it runs. So the last mute or unmute always wins.
- A refused `audio.play()` (autoplay rules) shows "Sound is blocked. Click to turn on sound". The next click, key press or tap plays the sound.
- `getStats` every 500 ms: `audioLevel` drives the speaker frame. No audio bytes for 5 s from an unmuted peer shows "No audio from <name>". A local `AnalyserNode` warns when my microphone gives only silence.

## ICE servers
- Default: `stun:stun.l.google.com:19302`.
- Optional TURN from env: `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL`. If they are not set, use STUN only.
- Document in the README that strict NATs need TURN.

## Lifecycle
- On `participant_left`, `you_were_removed`, `meeting_ended` or leave: close the peer connection, stop remote tracks, remove the tile.
- On WebSocket reconnect (stage 2 logic): keep the local stream, rebuild the peer connections that are not `connected`.
- On page unload, close all peers and stop all local tracks.
- Handle `iceconnectionstatechange` failed: try one ICE restart, then show a small "connection problem" badge on that tile.

## Code layout
```
frontend/src/lib/webrtc/
  peerManager.ts    creates and tracks RTCPeerConnections, no React
  signaling.ts      sends and parses `signal` messages through useRoom
  useMedia.ts       local stream, mute, video, device errors
frontend/src/lib/useRoom.ts   exposes `send(signal)` and an `onSignal` subscription
```
The React components only read `remoteStreams: Map<participantId, MediaStream>`.

## Tests
- Unit test `peerManager` glare rule with a fake `RTCPeerConnection`.
- Playwright with 3 contexts and Chromium fake media flags: each context shows 2 remote video tiles with `videoWidth > 0` and playing audio tracks (`getStats` shows inbound audio bytes increasing).
- Test: mute changes the remote icon and stops the audio bytes; video off shows the avatar; a peer leaves and its tile goes away.
