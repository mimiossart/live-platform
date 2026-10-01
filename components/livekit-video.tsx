"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { BackgroundProcessor, supportsBackgroundProcessors } from "@livekit/track-processors";
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
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
  composite?: boolean;
  sceneSources?: any[];
  orientation?: "portrait" | "landscape";
};

const LiveKitVideo = forwardRef<LiveKitVideoHandle, Props>(function LiveKitVideo({ liveId, isOwner, isGuest = false, battle = false, matchId = null, composite = false, sceneSources = [], orientation = "portrait" }, ref) {
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
  const sceneSourcesRef = useRef<any[]>(sceneSources); const orientationRef = useRef(orientation);
  useEffect(()=>{sceneSourcesRef.current=sceneSources;orientationRef.current=orientation},[sceneSources,orientation]);
  const compositeRef = useRef<{canvas:HTMLCanvasElement; track:LocalVideoTrack; stream:MediaStream; raf:number}|null>(null);
  const localCameraRef = useRef<HTMLVideoElement|null>(null);
  const localScreenRef = useRef<HTMLVideoElement|null>(null);
  const mediaCacheRef = useRef<Map<string, HTMLImageElement|HTMLVideoElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

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

    const isCompositePublication = (publication?: RemoteTrackPublication | null) =>
      publication?.trackName === "livewave-composite";

    const attach = (
      track: RemoteTrack,
      participant: RemoteParticipant,
      publication?: RemoteTrackPublication,
    ) => {
      const source = publication?.source;
      if (track.kind === Track.Kind.Video) {
        const composite = isCompositePublication(publication);
        const cameraPublications = Array.from(participant.videoTrackPublications.values())
          .filter((p) => p.source === Track.Source.Camera);
        const activeComposite = cameraPublications.find(isCompositePublication);
        const hasComposite = !!activeComposite;

        // The Studio publishes the final scene as "livewave-composite".
        // The spectator subscribes to that one video only: raw camera and
        // screen-share tracks are disabled while a composite exists.
        if (hasComposite && source === Track.Source.ScreenShare) {
          if (publication?.isSubscribed) publication.setSubscribed(false);
          return;
        }
        if (source === Track.Source.Camera && !composite && activeComposite) {
          if (publication?.isSubscribed) publication.setSubscribed(false);
          return;
        }

        if (composite) {
          for (const other of participant.videoTrackPublications.values()) {
            if (other === publication) continue;
            if (
              other.source === Track.Source.Camera ||
              other.source === Track.Source.ScreenShare
            ) {
              if (other.isSubscribed) other.setSubscribed(false);
            }
          }
        }

        const element = track.attach();
        if (element instanceof HTMLVideoElement) {
          element.className = source === Track.Source.ScreenShare
            ? "livekit-video livekit-screen"
            : "livekit-video";
          const updateStageRatio = () => {
            const stage = containerRef.current?.closest(".stage");
            if (!stage) return;
            stage.classList.toggle("live-landscape", element.videoWidth >= element.videoHeight);
            stage.classList.toggle("live-portrait", element.videoHeight > element.videoWidth);
          };
          element.addEventListener("loadedmetadata", updateStageRatio, { once: true });
          if (element.readyState >= 1) updateStageRatio();
          element.autoplay = true;
          element.playsInline = true;
          element.muted = true;
        }

        const slot = getSlot(participant.identity);
        if (source === Track.Source.ScreenShare) {
          slot?.appendChild(element);
        } else if (composite) {
          slot?.replaceChildren(element);
        } else if (!slot?.querySelector(".livekit-video")) {
          slot?.appendChild(element);
        }
      } else {
        const element = track.attach();
        element.className = "livekit-audio";
        element.setAttribute("aria-hidden", "true");
        containerRef.current?.appendChild(element);
      }
    };

    const removeTrack = (
      track: RemoteTrack,
      participant: RemoteParticipant,
      publication?: RemoteTrackPublication,
    ) => {
      track.detach().forEach((element) => element.remove());
      if (track.kind === Track.Kind.Video) {
        const slot = containerRef.current?.querySelector(
          `[data-participant="${CSS.escape(participant.identity)}"]`,
        );
        if (!slot) return;

        // If the composite disappears, fall back to the raw camera only when
        // there is no composite publication left.
        if (isCompositePublication(publication)) {
          const fallback = Array.from(participant.videoTrackPublications.values())
            .find((p) => p.source === Track.Source.Camera && !isCompositePublication(p) && p.track);
          if (fallback) {
            if (!fallback.isSubscribed) fallback.setSubscribed(true);
            if (fallback.track) attach(fallback.track, participant, fallback);
          }
        }

        const hasVideo = !!slot.querySelector(".livekit-video");
        if (!hasVideo && !slot.querySelector(".livekit-screen")) slot.remove();
      }
    };

    const onSubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => attach(track, participant, publication);

    const onUnsubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => removeTrack(track, participant, publication);

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
          await room.localParticipant.setMicrophoneEnabled(true);
          const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (publication?.track) {
            const element = publication.track.attach();
            if (element instanceof HTMLVideoElement) {
              element.className = "livekit-video";
              element.autoplay = true;
              element.playsInline = true;
              const updateStageRatio = () => {
                const stage = containerRef.current?.closest(".stage");
                if (!stage) return;
                stage.classList.toggle("live-landscape", element.videoWidth >= element.videoHeight);
                stage.classList.toggle("live-portrait", element.videoHeight > element.videoWidth);
              };
              element.addEventListener("loadedmetadata", updateStageRatio, { once: true });
              if (element.readyState >= 1) updateStageRatio();
            }
            getSlot(room.localParticipant.identity, true)?.replaceChildren(element);
          }
          if (composite && isOwner) await startComposite(room);
        }

        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.videoTrackPublications.values()) {
            if (publication.track) attach(publication.track, participant, publication);
          }
          for (const publication of participant.audioTrackPublications.values()) {
            if (publication.track) attach(publication.track, participant, publication);
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
  }, [liveId, isOwner, isGuest, battle, matchId, composite]);

  function getLocalPreviewSlot() {
    if (!containerRef.current || !roomRef.current?.localParticipant) return null;
    return containerRef.current.querySelector(
      `[data-participant="${CSS.escape(roomRef.current.localParticipant.identity)}"]`,
    ) as HTMLDivElement | null;
  }

  async function startComposite(room: Room) {
    if (!composite || compositeRef.current || !room.localParticipant) return;
    const canvas=document.createElement("canvas");
    // TikTok-style LIVE canvas: 1080x1920 vertical / 1920x1080 horizontal.
    // 30 FPS keeps the stream stable for game + camera compositing.
    canvas.width=orientationRef.current==="portrait"?1080:1920;
    canvas.height=orientationRef.current==="portrait"?1920:1080;
    const ctx=canvas.getContext("2d"); if(!ctx) return;
    const stream=canvas.captureStream(30); const videoTrack=stream.getVideoTracks()[0]; if(!videoTrack) return;
    const track=new LocalVideoTrack(videoTrack, { width: canvas.width, height: canvas.height }, false);
    const camPub=room.localParticipant.getTrackPublication(Track.Source.Camera); const camTrack=camPub?.track;
    if(camTrack){ const el=camTrack.attach(); if(el instanceof HTMLVideoElement){el.muted=true;el.playsInline=true;await el.play().catch(()=>{});localCameraRef.current=el;} }

    const getMedia=(source:any)=>{
      if(!source.mediaUrl)return null;
      const cached=mediaCacheRef.current.get(source.id);
      if(cached)return cached;
      if(source.type==="image"){
        const img=new Image(); img.src=source.mediaUrl; mediaCacheRef.current.set(source.id,img); return img;
      }
      if(source.type==="video"){
        const v=document.createElement("video"); v.src=source.mediaUrl; v.muted=true; v.loop=true; v.playsInline=true; v.autoplay=true; v.play().catch(()=>{}); mediaCacheRef.current.set(source.id,v); return v;
      }
      return null;
    };
    const draw=()=>{
      const w=canvas.width,h=canvas.height;
      ctx.fillStyle="#050505";ctx.fillRect(0,0,w,h);
      const sources=sceneSourcesRef.current;
      const game=sources.find((s:any)=>["game","window","screen"].includes(s.type));
      const hasScreen=!!localScreenRef.current&&localScreenRef.current.readyState>=2;
      const fitVideo=(video:HTMLVideoElement,x:number,y:number,sw:number,sh:number,mode:"contain"|"cover"="contain")=>{
        const vw=video.videoWidth||16,vh=video.videoHeight||9;
        const scale=mode==="cover"?Math.max(sw/vw,sh/vh):Math.min(sw/vw,sh/vh);
        const dw=vw*scale,dh=vh*scale;
        ctx.drawImage(video,x+(sw-dw)/2,y+(sh-dh)/2,dw,dh);
      };
      if(game&&hasScreen){const gx=w*game.x/100,gy=h*game.y/100,gw=w*game.w/100,gh=h*game.h/100;fitVideo(localScreenRef.current!,gx,gy,gw,gh,"cover");}
      else if(game){ctx.fillStyle="#050505";ctx.fillRect(0,0,w,h);}
      if(!hasScreen && localCameraRef.current && !game){
        fitVideo(localCameraRef.current,0,0,w,h,"cover");
      }
      for(const s of sources){
        if(s.type==="camera"&&localCameraRef.current){
          const fullCamera=!hasScreen;
          const x=fullCamera?0:w*(s.x/100-s.w/200),y=fullCamera?0:h*(s.y/100-s.h/200);
          const sw=fullCamera?w:w*s.w/100,sh=fullCamera?h:h*s.h/100;
          ctx.save();
          if(!fullCamera){ctx.beginPath();ctx.roundRect(x,y,sw,sh,18);ctx.clip();}
          fitVideo(localCameraRef.current,x,y,sw,sh,fullCamera?"cover":"contain");
          ctx.restore();
        }
        if((s.type==="image"||s.type==="video")&&s.mediaUrl){const m=getMedia(s);if(m&&((m instanceof HTMLImageElement&&m.complete)||(m instanceof HTMLVideoElement&&m.readyState>=2))){const x=w*(s.x/100-s.w/200),y=h*(s.y/100-s.h/200),sw=w*s.w/100,sh=h*s.h/100;ctx.drawImage(m,x,y,sw,sh)}}
        if(s.type==="text"){ctx.fillStyle="#fff";ctx.font="700 34px sans-serif";ctx.textAlign="left";ctx.fillText(s.label?.replace("🔤 ","")||"LiveWave",w*s.x/100,h*s.y/100)}
        if(s.type==="banner"){const x=w*(s.x/100-s.w/200),y=h*(s.y/100-s.h/200),sw=w*s.w/100,sh=h*s.h/100;ctx.fillStyle="rgba(255,45,104,.92)";ctx.fillRect(x,y,sw,sh);ctx.fillStyle="#fff";ctx.font="700 28px sans-serif";ctx.textAlign="center";ctx.fillText(s.label?.replace("📢 ","")||"LIVE",x+sw/2,y+sh/2+10)}
      }
      if(compositeRef.current) compositeRef.current.raf=requestAnimationFrame(draw);
    };
    compositeRef.current={canvas,track,stream,raf:0}; compositeRef.current.raf=requestAnimationFrame(draw);
    const compositePublication = await room.localParticipant.publishTrack(track,{
      name:"livewave-composite",
      source:Track.Source.Camera,
      simulcast:false,
      videoEncoding:{maxBitrate:5400000,maxFramerate:30},
    });

    // Show the final composited stream in the Studio itself. Previously the
    // local slot kept the raw camera, which made the game capture appear
    // missing even though the screen track was being captured.
    if (compositePublication.track) {
      const preview = compositePublication.track.attach();
      if (preview instanceof HTMLVideoElement) {
        preview.className = "livekit-video";
        preview.autoplay = true;
        preview.playsInline = true;
        preview.muted = true;
        await preview.play().catch(() => {});
      }
      const slot = getLocalPreviewSlot();
      slot?.replaceChildren(preview);
    }

    if(camTrack) await room.localParticipant.unpublishTrack(camTrack,false);
  }

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

  async function toggleCamera() { const room=roomRef.current; if(!room || (!isOwner&&!isGuest)) return false; let pub=room.localParticipant.getTrackPublication(Track.Source.Camera); if(!pub?.track){await room.localParticipant.setCameraEnabled(true);pub=room.localParticipant.getTrackPublication(Track.Source.Camera);if(pub?.track){const el=pub.track.attach();if(el instanceof HTMLVideoElement){el.muted=true;el.playsInline=true;el.autoplay=true;await el.play().catch(()=>{});localCameraRef.current=el}}return true} const enabled=!!pub.isMuted; await room.localParticipant.setCameraEnabled(enabled); if(!enabled)localCameraRef.current=null; return enabled; }

  async function toggleMicrophone() { const room=roomRef.current; if(!room || (!isOwner&&!isGuest)) return false; const pub=room.localParticipant.getTrackPublication(Track.Source.Microphone); const enabled=!(pub?.isMuted); await room.localParticipant.setMicrophoneEnabled(!enabled); return !enabled; }

  async function toggleScreenShare(): Promise<boolean> {
    const room = roomRef.current;
    if (!room || (!isOwner && !isGuest)) return false;
    try {
      const enabled = !screenSharing;
      await room.localParticipant.setScreenShareEnabled(enabled, { audio: true });
      const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (enabled && publication?.track) {
        const element = publication.track.attach();
        if (element instanceof HTMLVideoElement) {
          element.className = "livekit-video livekit-screen";
          element.autoplay = true;
          element.playsInline = true;
          element.muted = true;
          element.onloadedmetadata = () => {
            localScreenRef.current = element;
          };
          localScreenRef.current = element;
          element.style.display = "none";
          element.play().catch(() => {});
        }
        // The screen track is an internal capture source for the compositor.
        // Do not append it over the composite preview: doing so hides the
        // composited canvas and makes the selected game/window appear missing.
      }
      setScreenSharing(enabled);
      return enabled;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de partager la fenêtre.");
      return screenSharing;
    }
  }

  useEffect(()=>{const c=compositeRef.current?.canvas;if(c){c.width=orientationRef.current==="portrait"?1080:1920;c.height=orientationRef.current==="portrait"?1920:1080;}},[orientation]);
  useImperativeHandle(ref, () => ({ toggleCamera, toggleMicrophone, toggleScreenShare }), [isOwner, isGuest, screenSharing]);

  useEffect(()=>{ 
    const p=roomRef.current?.localParticipant;
    const pub=p?.getTrackPublication(Track.Source.ScreenShare);
    const t=pub?.track;
    if(t){
      const el=t.attach();
      if(el instanceof HTMLVideoElement){
        el.muted=true;
        el.playsInline=true;
        el.autoplay=true;
        el.style.display="none";
        el.play().catch(()=>{});
        localScreenRef.current=el;
      }
    }
    return ()=>{};
  },[screenSharing]);

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
      {!error && status && <div className="video-status">{status}</div>}
      {error && <div className="video-error">{error}</div>}
      {needsAudio && !error && (
        <button className="camera-hint" style={{ cursor: "pointer", border: 0 }} onClick={enableAudio}>
          ▶ Appuie ici pour activer le son
        </button>
      )}
      {(isOwner || isGuest) && !error && (
        <div className="camera-hint">Micro actif. Ajoute une source Caméra pour afficher ta caméra.</div>
      )}
    </div>
  );
});

export default LiveKitVideo;
