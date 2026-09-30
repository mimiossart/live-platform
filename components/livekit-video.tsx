"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { BackgroundProcessor, supportsBackgroundProcessors } from "@livekit/track-processors";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";

export type LiveKitVideoHandle = { toggleCamera: () => Promise<boolean>; toggleMicrophone: () => Promise<boolean>; toggleScreenShare: () => Promise<boolean>; };

type Props = {
  liveId: string;
  isOwner: boolean;
  isGuest?: boolean;
  battle?: boolean;
  matchId?: string | null;
};

const LiveKitVideo = forwardRef<LiveKitVideoHandle, Props>(function LiveKitVideo({ liveId, isOwner, isGuest = false, battle = false, matchId = null }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState("Connexion vidéo…");
  const [error, setError] = useState("");
  const [needsAudio, setNeedsAudio] = useState(false);
  const [filter, setFilter] = useState("normal");
  const [background, setBackground] = useState("none");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const processorRef = useRef<any>(null);
  const [screenSharing, setScreenSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const getLocalSlot = (identity: string) => { if (!containerRef.current) return null; return containerRef.current.querySelector(`[data-participant="${CSS.escape(identity)}"]`) as HTMLDivElement | null; };

    const getSlot = (identity: string, local = false) => {
      if (!containerRef.current) return null;
      let slot = containerRef.current.querySelector(
        `[data-participant="${CSS.escape(identity)}"]`,
      ) as HTMLDivElement | null;
      if (!slot) {
        slot = document.createElement("div");
        slot.dataset.participant = identity;
        slot.className = `livekit-participant${local ? " local" : ""}`;
        containerRef.current.appendChild(slot);
      }
      return slot;
    };

    const attach = (track: RemoteTrack, participant: RemoteParticipant, source?: Track.Source) => {
      if (track.kind === Track.Kind.Video) {
        const element = track.attach();
        if (element instanceof HTMLVideoElement) {
          element.className = source === Track.Source.ScreenShare ? "livekit-video livekit-screen" : "livekit-video";
          element.autoplay = true;
          element.playsInline = true;
        }
        const slot=getSlot(participant.identity); if(source===Track.Source.ScreenShare){slot?.appendChild(element);} else {slot?.replaceChildren(element);}
      } else {
        const element = track.attach();
        element.className = "livekit-audio";
        element.setAttribute("aria-hidden", "true");
        containerRef.current?.appendChild(element);
      }
    };

    const removeTrack = (track: RemoteTrack, participant: RemoteParticipant) => {
      track.detach().forEach((element) => element.remove());
      if (track.kind === Track.Kind.Video) {
        const slot = containerRef.current?.querySelector(
          `[data-participant="${CSS.escape(participant.identity)}"]`,
        );
        if (slot && !slot.querySelector(".livekit-video")) slot.remove();
      }
    };

    const onSubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => attach(track, participant, publication.source);

    const onUnsubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => removeTrack(track, participant);

    const onDisconnected = (participant: RemoteParticipant) => {
      const slot = containerRef.current?.querySelector(
        `[data-participant="${CSS.escape(participant.identity)}"]`,
      );
      slot?.remove();
    };

    const onAudioStatus = () => {
      if (!isOwner) setNeedsAudio(!room.canPlaybackAudio);
    };

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, onDisconnected);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioStatus);
    room.on(RoomEvent.Disconnected, () => setStatus("Vidéo déconnectée."));

    (async () => {
      try {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveId, matchId: battle ? matchId : null }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible d'obtenir le token.");

        await room.connect(data.serverUrl, data.participantToken);
        if (cancelled) return;

        setStatus(isOwner || isGuest ? "Caméra en direct" : "En direct");
        if (!isOwner) setNeedsAudio(!room.canPlaybackAudio);

        if (isOwner || isGuest) {
          await room.localParticipant.enableCameraAndMicrophone();
          const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (publication?.track) {
            const element = publication.track.attach();
            if (element instanceof HTMLVideoElement) {
              element.className = "livekit-video";
              element.autoplay = true;
              element.playsInline = true;
            }
            getSlot(room.localParticipant.identity, true)?.replaceChildren(element);
          }
        }

        // Render tracks that were already published before this client connected.
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.videoTrackPublications.values()) {
            if (publication.track) attach(publication.track, participant, publication.source);
          }
          for (const publication of participant.audioTrackPublications.values()) {
            if (publication.track) attach(publication.track, participant, publication.source);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Connexion vidéo impossible.");
          setStatus("");
        }
      }
    })();

    return () => {
      cancelled = true;
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, onDisconnected);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioStatus);
      room.disconnect();
      roomRef.current = null;
    };
  }, [liveId, isOwner, isGuest, battle, matchId]);

  async function applyBackground(mode: string) {
    const processor = processorRef.current;
    if (!processor) { setError("Les effets de fond ne sont pas disponibles sur ce navigateur."); return; }
    try {
      if (mode === "blur") await processor.switchTo({ mode: "background-blur", blurRadius: 12 });
      else if (mode === "image") { if (!backgroundUrl.trim()) { setError("Ajoute l’URL d’une image de fond."); return; } await processor.switchTo({ mode: "virtual-background", imagePath: backgroundUrl.trim() }); }
      else await processor.switchTo({ mode: "disabled" });
      setBackground(mode); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’appliquer le fond."); }
  }

  async function toggleCamera() { const room=roomRef.current; if(!room || (!isOwner&&!isGuest)) return false; const pub=room.localParticipant.getTrackPublication(Track.Source.Camera); const enabled=!(pub?.isMuted); await room.localParticipant.setCameraEnabled(!enabled); return !enabled; }

  async function toggleMicrophone() { const room=roomRef.current; if(!room || (!isOwner&&!isGuest)) return false; const pub=room.localParticipant.getTrackPublication(Track.Source.Microphone); const enabled=!(pub?.isMuted); await room.localParticipant.setMicrophoneEnabled(!enabled); return !enabled; }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room || (!isOwner && !isGuest)) return;
    try {
      const enabled = !screenSharing;
      const publication = await room.localParticipant.setScreenShareEnabled(enabled, { audio: true });
      if (enabled && publication?.track) {
        const element = publication.track.attach();
        if (element instanceof HTMLVideoElement) {
          element.className = "livekit-video livekit-screen";
          element.autoplay = true;
          element.playsInline = true;
          element.muted = true;
        }
        const slot = containerRef.current?.querySelector(`[data-participant="${CSS.escape(room.localParticipant.identity)}"]`) as HTMLDivElement | null;
        if (slot) slot.appendChild(element);
      }
      setScreenSharing(enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de partager la fenêtre.");
    }
  }

  useImperativeHandle(ref, () => ({ toggleCamera, toggleMicrophone, toggleScreenShare }), [isOwner, isGuest, screenSharing]);

  async function enableAudio() {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setNeedsAudio(!room.canPlaybackAudio);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'activer le son.");
    }
  }

  return (
    <div className="video-live">
      <div ref={containerRef} className={"livekit-container filter-"+filter+(battle?" battle-mode":"")} />
      {(isOwner || isGuest) && !error && <div className="live-effects">
        <button type="button" onClick={()=>setFilter("normal")}>Normal</button>
        <button type="button" onClick={()=>setFilter("warm")}>✨ Chaud</button>
        <button type="button" onClick={()=>setFilter("mono")}>⚫ N&B</button>
        <button type="button" onClick={()=>setFilter("vivid")}>🌈 Vif</button>
        <button type="button" onClick={()=>applyBackground("blur")}>🌫️ Flou</button>
        <button type="button" onClick={()=>applyBackground("none")}>Fond réel</button>
        <input value={backgroundUrl} onChange={e=>setBackgroundUrl(e.target.value)} placeholder="URL image de fond" />
        <button type="button" onClick={()=>applyBackground("image")}>🖼️ Fond virtuel</button>
        <button type="button" onClick={toggleScreenShare}>{screenSharing?"⏹️ Arrêter le partage":"🎮 Partager une fenêtre / jeu"}</button>
        {background!=="none" && <span>Effet: {background}</span>}
      </div>}
      {!error && status && <div className="video-status">{status}</div>}
      {error && <div className="video-error">{error}</div>}
      {needsAudio && !error && (
        <button className="camera-hint" style={{ cursor: "pointer", border: 0 }} onClick={enableAudio}>
          ▶ Appuie ici pour activer le son
        </button>
      )}
      {(isOwner || isGuest) && !error && (
        <div className="camera-hint">Caméra et micro actifs — autorise-les dans ton navigateur.</div>
      )}
    </div>
  );
}
