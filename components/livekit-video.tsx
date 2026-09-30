"use client";

import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";

type Props = {
  liveId: string;
  isOwner: boolean;\n  isGuest?: boolean;
};

export default function LiveKitVideo({ liveId, isOwner, isGuest = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState("Connexion vidéo…");
  const [error, setError] = useState("");
  const [needsAudio, setNeedsAudio] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const attach = (track: RemoteTrack, participant?: RemoteParticipant) => {
      if (!containerRef.current) return;
      const element = track.attach();
      element.autoplay = true;
      if (element instanceof HTMLVideoElement) {
        element.className = "livekit-video";
        element.playsInline = true;
        const participantId=participant?.identity||"remote"; let slot=containerRef.current.querySelector(`[data-participant="${participantId}"]`) as HTMLDivElement|null; if(!slot){slot=document.createElement("div");slot.dataset.participant=participantId;slot.className="livekit-participant";containerRef.current.appendChild(slot)} slot.replaceChildren(element);
      } else {
        element.className = "livekit-audio";
        element.setAttribute("aria-hidden", "true");
        containerRef.current.appendChild(element);
      }
    };

    const onSubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      _participant: RemoteParticipant,
    ) => attach(track);

    const onAudioStatus = () => {
      if (!isOwner) setNeedsAudio(!room.canPlaybackAudio);
    };

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioStatus);
    room.on(RoomEvent.Disconnected, () => setStatus("Vidéo déconnectée."));

    (async () => {
      try {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveId }),
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
          if (publication?.track && containerRef.current) {
            const element = publication.track.attach();
            element.className = "livekit-video";
            element.autoplay = true;
            if (element instanceof HTMLVideoElement) element.playsInline = true;
            let slot=containerRef.current.querySelector(`[data-participant="${room.localParticipant.identity}"]`) as HTMLDivElement|null; if(!slot){slot=document.createElement("div");slot.dataset.participant=room.localParticipant.identity;slot.className="livekit-participant local";containerRef.current.appendChild(slot)} slot.replaceChildren(element);
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
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioStatus);
      room.disconnect();
      roomRef.current = null;
    };
  }, [liveId, isOwner]);

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
      <div ref={containerRef} className="livekit-container" />
      {!error && status && <div className="video-status">{status}</div>}
      {error && <div className="video-error">{error}</div>}
      {needsAudio && !error && (
        <button className="camera-hint" style={{ cursor: "pointer", border: 0 }} onClick={enableAudio}>
          ▶ Appuie ici pour activer le son
        </button>
      )}
      {isOwner && !error && (
        <div className="camera-hint">Caméra et micro actifs — autorise-les dans ton navigateur.</div>
      )}
    </div>
  );
}
