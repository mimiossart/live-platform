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
  isOwner: boolean;
};

export default function LiveKitVideo({ liveId, isOwner }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState("Connexion vidéo…");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const attach = (track: RemoteTrack) => {
      if (!containerRef.current || track.kind !== Track.Kind.Video) return;
      const element = track.attach();
      element.className = "livekit-video";
      element.autoplay = true;
      element.playsInline = true;
      containerRef.current.replaceChildren(element);
    };

    const onSubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      _participant: RemoteParticipant,
    ) => attach(track);

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
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

        setStatus(isOwner ? "Caméra en direct" : "En direct");

        if (isOwner) {
          await room.localParticipant.enableCameraAndMicrophone();
          const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (publication?.track && containerRef.current) {
            const element = publication.track.attach();
            element.className = "livekit-video";
            element.autoplay = true;
            element.playsInline = true;
            containerRef.current.replaceChildren(element);
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
      room.disconnect();
      roomRef.current = null;
    };
  }, [liveId, isOwner]);

  return (
    <div className="video-live">
      <div ref={containerRef} className="livekit-container" />
      {!error && status && <div className="video-status">{status}</div>}
      {error && <div className="video-error">{error}</div>}
      {isOwner && !error && (
        <div className="camera-hint">Caméra et micro actifs — autorise-les dans ton navigateur.</div>
      )}
    </div>
  );
}
