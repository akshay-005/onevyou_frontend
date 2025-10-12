// frontend/src/pages/CallRoom.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock } from "lucide-react";
import { useSocket } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";

const CallRoom: React.FC = () => {
  const { channelName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const socket = useSocket();

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracks = useRef<{ audio?: any; video?: any }>({});
  const joinInProgress = useRef(false);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const [joined, setJoined] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);

  // read duration from query string (set by caller after payment)
  const query = new URLSearchParams(window.location.search);
  const durationMin = Number(query.get("duration")) || 1;

  const stopTracks = async () => {
    try {
      if (localTracks.current.audio) {
        localTracks.current.audio.stop();
        localTracks.current.audio.close();
        localTracks.current.audio = undefined;
      }
      if (localTracks.current.video) {
        localTracks.current.video.stop();
        localTracks.current.video.close();
        localTracks.current.video = undefined;
      }
    } catch (err) {
      console.warn("Track cleanup error:", err);
    }
  };

  useEffect(() => {
    if (!channelName || joinInProgress.current) return;

    const initCall = async () => {
      joinInProgress.current = true;
      await stopTracks();

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      try {
        const res = await fetch(`${API_BASE}/api/agora/token?channelName=${channelName}`);
        const data = await res.json();
        if (!data.success) throw new Error("Failed to get Agora token");

        await new Promise((r) => setTimeout(r, 1200));
        await client.join(data.appId, data.channelName, data.token, data.uid);

        // try create tracks
        let audio, video;
        try {
          if (!localTracks.current.audio && !localTracks.current.video) {
            [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
          } else {
            audio = localTracks.current.audio;
            video = localTracks.current.video;
          }
        } catch (err: any) {
          console.error("Track creation error:", err);
          // fallback to audio-only
          audio = await AgoraRTC.createMicrophoneAudioTrack();
          video = null;
        }

        localTracks.current = { audio, video };
        if (video) video.play("local-player");
        const publishArr = [audio, video].filter(Boolean);
        await client.publish(publishArr);

        startTime.current = Date.now();
        timerRef.current = setInterval(() => {
          setDurationSec(Math.floor((Date.now() - startTime.current) / 1000));
        }, 1000);
        setJoined(true);

        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "video") {
            const el = document.createElement("div");
            el.id = `player-${user.uid}`;
            el.className = "w-full h-full";
            document.getElementById("remote-player")?.append(el);
            user.videoTrack?.play(`player-${user.uid}`);
          }
          if (mediaType === "audio") user.audioTrack?.play();
          setRemoteUsers((prev) => [...prev.filter((u) => u.uid !== user.uid), user]);
        });

        client.on("user-unpublished", (user) => {
          document.getElementById(`player-${user.uid}`)?.remove();
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });

        socket?.emit("call:start", { channelName, userId: localStorage.getItem("userId") });

        // Auto-end after duration (client-side fail-safe)
        const msLimit = durationMin * 60 * 1000;
        callLimitTimeoutRef.current = setTimeout(() => {
          toast({ title: "⏰ Time's up", description: "The paid time has ended." });
          endCall(false);
        }, msLimit);
      } catch (err: any) {
        console.error("Join error:", err);
        toast({ title: "Call Failed", description: err.message || "Could not join call.", variant: "destructive" });
        navigate("/dashboard");
      } finally {
        joinInProgress.current = false;
      }
    };

    initCall();

    socket?.on("call:ended", (payload: any) => {
      if (payload.channelName === channelName) {
        endCall(true);
      }
    });

    return () => {
      socket?.off("call:ended");
      if (timerRef.current) clearInterval(timerRef.current);
      if (callLimitTimeoutRef.current) clearTimeout(callLimitTimeoutRef.current);
      endCall(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  const toggleMic = async () => {
    const audio = localTracks.current.audio;
    if (!audio) {
      toast({ title: "No mic track found" });
      return;
    }
    const newState = !isMicOn;
    await audio.setEnabled(newState);
    setIsMicOn(newState);
  };

  const toggleCamera = async () => {
    const video = localTracks.current.video;
    if (!video) {
      toast({ title: "No camera track found" });
      return;
    }
    const newState = !isCamOn;
    await video.setEnabled(newState);
    setIsCamOn(newState);
  };

  const endCall = async (silent = false) => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callLimitTimeoutRef.current) clearTimeout(callLimitTimeoutRef.current);

      await stopTracks();
      const client = clientRef.current;
      if (client) {
        await client.leave();
        client.removeAllListeners();
        clientRef.current = null;
      }
      setJoined(false);
      setRemoteUsers([]);
      socket?.emit("call:end", { channelName, durationSec });
      if (!silent) {
        toast({ title: "Call Ended" });
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("End call error:", err);
    }
  };

  const format = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex-1 grid grid-cols-2 gap-2 p-4">
        <div id="local-player" className="bg-black rounded-lg flex items-center justify-center">
          {!joined && <div className="text-gray-400">Connecting...</div>}
        </div>
        <div id="remote-player" className="bg-black rounded-lg flex items-center justify-center">
          {remoteUsers.length === 0 && <p className="text-gray-400">Waiting for remote user...</p>}
        </div>
      </div>

      <div className="p-4 flex flex-col items-center gap-3 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" /> Duration: {format(durationSec)}
        </div>

        <div className="flex justify-center gap-6">
          <Button onClick={toggleMic} variant="outline">{isMicOn ? <Mic /> : <MicOff />} {isMicOn ? "Mute" : "Unmute"}</Button>
          <Button onClick={toggleCamera} variant="outline">{isCamOn ? <Video /> : <VideoOff />} {isCamOn ? "Camera Off" : "Camera On"}</Button>
          <Button onClick={() => endCall(false)} variant="destructive"><PhoneOff /> Leave</Button>
        </div>
      </div>
    </div>
  );
};

export default CallRoom;
