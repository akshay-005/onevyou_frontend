// frontend/src/pages/CallRoom.tsx - COMPLETELY REWRITTEN FOR RELIABILITY
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, Wifi, Maximize2 } from "lucide-react";
import { useSocket } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";

AgoraRTC.setLogLevel(3);

const CallRoom: React.FC = () => {
  const { channelName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const socket = useSocket();

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<ILocalAudioTrack | null>(null);
  const localVideoRef = useRef<ILocalVideoTrack | null>(null);
  const hasJoinedRef = useRef(false);
  const cleanupDoneRef = useRef(false);
  const autoEndTimerRef = useRef<number | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const [joined, setJoined] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const query = new URLSearchParams(window.location.search);
  const durationMin = Number(query.get("duration")) || 1;

  // Safe play helper
  const safePlay = (track: any, elementId?: string) => {
    try {
      const result = elementId ? track?.play(elementId) : track?.play();
      if (result && typeof result.catch === 'function') {
        result.catch((e: any) => console.warn("Play failed:", e));
      }
    } catch (e) {
      console.warn("Play error:", e);
    }
  };

  useEffect(() => {
    if (!channelName || hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    const init = async () => {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "h264" });
      clientRef.current = client;

      try {
        // Get token
        const res = await fetch(`${API_BASE}/api/agora/token?channelName=${channelName}&durationMin=${durationMin}`);
        const data = await res.json();
        if (!data.success) throw new Error("Token failed");

        // Join
        await client.join(data.appId, channelName, data.token, data.uid);
        console.log("✅ Joined");

        // Create tracks
        let audio: ILocalAudioTrack, video: ILocalVideoTrack;
        try {
          [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { AEC: true, AGC: true, ANS: true },
            { encoderConfig: "480p_1" }
          );
        } catch (err) {
          audio = await AgoraRTC.createMicrophoneAudioTrack();
          video = null as any;
          toast({ title: "Camera unavailable", variant: "destructive" });
        }

        localAudioRef.current = audio;
        localVideoRef.current = video;

        // Play local
        if (video) safePlay(video, "local-player");

        // Publish
        await client.publish(video ? [audio, video] : [audio]);
        console.log("✅ Published");

        // Handle remote users
        client.on("user-published", async (user, mediaType) => {
          console.log(`📥 ${user.uid} published ${mediaType}`);
          
          try {
            await client.subscribe(user, mediaType);
            
            if (mediaType === "video") {
              const container = document.getElementById("remote-player");
              if (container) {
                let playerDiv = document.getElementById(`player-${user.uid}`);
                if (!playerDiv) {
                  playerDiv = document.createElement("div");
                  playerDiv.id = `player-${user.uid}`;
                  playerDiv.className = "w-full h-full";
                  container.appendChild(playerDiv);
                }
                setTimeout(() => safePlay(user.videoTrack, `player-${user.uid}`), 500);
              }
            }
            
            if (mediaType === "audio") {
              safePlay(user.audioTrack);
            }

            setRemoteUsers(prev => {
              if (prev.find(u => u.uid === user.uid)) return prev;
              return [...prev, user];
            });
          } catch (err) {
            console.error("Subscribe error:", err);
          }
        });

        client.on("user-unpublished", (user) => {
          document.getElementById(`player-${user.uid}`)?.remove();
        });

        client.on("user-left", (user) => {
          document.getElementById(`player-${user.uid}`)?.remove();
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        client.on("connection-state-change", (cur, prev) => {
          console.log(`${prev} → ${cur}`);
          // Only cleanup if disconnected unexpectedly (not by us)
          if (cur === "DISCONNECTED" && prev === "CONNECTED" && !cleanupDoneRef.current) {
            console.warn("⚠️ Unexpected disconnect!");
            cleanup();
          }
        });

        // Start timer
        startTimeRef.current = Date.now();
        timerRef.current = window.setInterval(() => {
          setDurationSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        setJoined(true);

        // Auto-end after call duration
        const autoEndMs = durationMin * 60 * 1000;
        console.log(`⏰ Call will auto-end in ${durationMin} minutes (${autoEndMs}ms)`);
        
        autoEndTimerRef.current = window.setTimeout(() => {
          console.log("⏰ Time up - ending call");
          cleanup();
        }, autoEndMs);

        // Notify backend
        socket?.emit("call:start", { channelName, userId: localStorage.getItem("userId") });

      } catch (err: any) {
        console.error("Init error:", err);
        toast({ title: "Call Failed", description: err.message, variant: "destructive" });
        cleanup();
      }
    };

    const cleanup = async () => {
      if (cleanupDoneRef.current) {
        console.log("⚠️ Cleanup already done, skipping");
        return;
      }
      
      // Debug: Log stack trace to see WHO called cleanup
      console.trace("🧹 Cleanup called from:");
      
      cleanupDoneRef.current = true;
      console.log("🧹 Starting cleanup");

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (autoEndTimerRef.current) {
        clearTimeout(autoEndTimerRef.current);
        autoEndTimerRef.current = null;
      }

      const elapsed = startTimeRef.current > 0 
        ? Math.floor((Date.now() - startTimeRef.current) / 1000) 
        : 0;

      socket?.emit("call:end", { channelName, durationSec: elapsed });

      const client = clientRef.current;
      if (client) {
        try {
          await client.leave();
          client.removeAllListeners();
        } catch {}
      }

      if (localAudioRef.current) {
        localAudioRef.current.close();
        localAudioRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.close();
        localVideoRef.current = null;
      }

      console.log("✅ Cleanup complete");
      toast({ title: "Call ended" });
      navigate("/dashboard");
    };

    init();

    const handleCallEnded = () => cleanup();
    socket?.on("call:ended", handleCallEnded);

    return () => {
      console.log("🔄 Component unmounting");
      socket?.off("call:ended", handleCallEnded);
      if (!cleanupDoneRef.current) {
        cleanup();
      }
    };
  }, [channelName]);

  const toggleMic = async () => {
    if (localAudioRef.current) {
      await localAudioRef.current.setEnabled(!isMicOn);
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCamera = async () => {
    if (localVideoRef.current) {
      await localVideoRef.current.setEnabled(!isCamOn);
      setIsCamOn(!isCamOn);
    }
  };

  const format = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex-1 relative bg-black">
        <div id={isSwapped ? "local-player" : "remote-player"} className="w-full h-full flex items-center justify-center">
          {!isSwapped && remoteUsers.length === 0 && (
            <div className="text-center animate-pulse">
              <div className="text-gray-400 text-lg mb-2">Waiting...</div>
              <div className="text-gray-500 text-sm">{joined ? "Connected" : "Connecting..."}</div>
            </div>
          )}
        </div>

        <div className="absolute top-4 left-4 bg-black/50 px-3 py-1.5 rounded-full flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{format(durationSec)}</span>
        </div>

        <div className="absolute top-20 right-4 w-24 h-32 sm:w-32 sm:h-44 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          <div id={isSwapped ? "remote-player" : "local-player"} className="w-full h-full" />
          <button
            onClick={() => setIsSwapped(!isSwapped)}
            className="absolute bottom-2 right-2 bg-black/70 p-1.5 rounded-full"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs">
            {isSwapped ? "Remote" : "You"}
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full ${isMicOn ? "bg-gray-700" : "bg-red-600"}`}
          >
            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full ${isCamOn ? "bg-gray-700" : "bg-red-600"}`}
          >
            {isCamOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
          <button
            onClick={() => {
              console.log("🔴 Leave button clicked");
              if (timerRef.current) clearInterval(timerRef.current);
              if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
              if (!cleanupDoneRef.current) {
                cleanupDoneRef.current = true;
                navigate("/dashboard");
              }
            }}
            className="p-4 rounded-full bg-red-600"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallRoom;