// frontend/src/pages/CallRoom.tsx - COMPLETELY REWRITTEN FOR RELIABILITY
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, Wifi, Maximize2 } from "lucide-react";
import { useSocket, safeEmit } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";



AgoraRTC.setLogLevel(3);

  const CallRoom: React.FC = () => {
  const { channelName } = useParams();
  // Detect whether user is caller or callee
const role = new URLSearchParams(window.location.search).get("role") || "caller";

  const navigate = useNavigate();
  const { toast } = useToast();
  const socket = useSocket();
  const [accepted, setAccepted] = useState(false);


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
  const [isConnecting, setIsConnecting] = useState(false);
  


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
  // 🧠 Only start Agora when user clicked “Accept”
  if (!accepted || !channelName || hasJoinedRef.current) return;

  hasJoinedRef.current = true;

  const init = async () => {
    // 🔓 Fully unlock mic and camera before joining
    const unlockMedia = async () => {
      try {
        console.log("🔓 Requesting audio/video permission...");
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        tempStream.getTracks().forEach(track => track.stop());
        console.log("✅ Media unlocked (mic + cam permissions granted)");
      } catch (err) {
        console.warn("⚠️ Media unlock failed:", err);
      }
    };
    await unlockMedia();



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
  console.warn("🎙️ Initial camera track creation failed, retrying once...", err);
  await new Promise(r => setTimeout(r, 1000));
  try {
    [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks(
      { AEC: true, AGC: true, ANS: true },
      { encoderConfig: "480p_1" }
    );
  } catch (retryErr) {
    console.error("🚫 Second track creation failed:", retryErr);
    audio = await AgoraRTC.createMicrophoneAudioTrack();
    video = null as any;
    toast({ title: "Camera unavailable", description: "Audio-only mode", variant: "destructive" });
  }
}

          

        localAudioRef.current = audio;
        localVideoRef.current = video;

        // Play local
        if (video) safePlay(video, "local-player");

        // Publish
        await client.publish(video ? [audio, video] : [audio]);
        console.log("✅ Published");

        // 🧩 Mobile audio unlock fallback (for Safari/Chrome mobile)
document.addEventListener("click", () => {
  if (localAudioRef.current) {
    try {
      localAudioRef.current.play?.().catch(() => {});
      console.log("🎧 Manual audio play triggered on user interaction");
    } catch (err) {
      console.warn("Audio play error:", err);
    }
  }
}, { once: true });


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
                const tryPlay = (attempt = 1) => {
  try {
    user.videoTrack?.play(`player-${user.uid}`);
    console.log(`🎥 Remote video playing for ${user.uid}`);
  } catch (err) {
    if (attempt < 4) {
      console.warn(`Video play failed (attempt ${attempt})`, err);
      setTimeout(() => tryPlay(attempt + 1), 400 * attempt);
    } else {
      console.error("❌ Video failed to play after retries", err);
    }
  }
};
setTimeout(() => tryPlay(), 700);

              }
            }
            
            if (mediaType === "audio") {
  if (user.audioTrack) {
    console.log(`🎧 Playing remote audio for ${user.uid}`);
    safePlay(user.audioTrack);
  } else {
    console.warn("⚠️ No remote audio track found — possible permission issue");
  }
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
        
        const bufferMs = 3000; // 3-second buffer for full minute experience
autoEndTimerRef.current = window.setTimeout(() => {
  console.log("⏰ Time up - ending call (with buffer)");
  cleanup();
}, autoEndMs + bufferMs);


        // Notify backend
        const userId = localStorage.getItem("userId");
if (!userId) {
  console.warn("⚠️ No userId found in localStorage, delaying call:start emit");
  setTimeout(() => {
    const retryUserId = localStorage.getItem("userId");
    if (retryUserId) {
      safeEmit("call:start", { channelName, userId: retryUserId });
      console.log("✅ Retried call:start emit with userId", retryUserId);
    }
  }, 1000);
} else {
  safeEmit("call:start", { channelName, userId });
}


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

  const elapsed =
    startTimeRef.current > 0
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;

  safeEmit("call:end", { channelName, durationSec: elapsed });

  const client = clientRef.current;
  if (client) {
    try {
      await client.unpublish();
    } catch (err) {
      console.warn("Unpublish failed:", err);
    }

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

  // ✅ Reset refs for next session (keep this inside cleanup)
  hasJoinedRef.current = false;
  cleanupDoneRef.current = false;
  clientRef.current = null;
  localAudioRef.current = null;
  localVideoRef.current = null;
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
  }, [accepted, channelName]);

  // 🔄 Socket communication between caller & callee
useEffect(() => {
  if (!socket) return;

  // When callee accepts
  socket.on("call:accepted", () => {
  console.log("✅ Callee accepted — joining room now...");
  const ring = document.getElementById("ringtone") as HTMLAudioElement;
  if (ring) ring.pause();

  // 🔄 Show connecting overlay
  setIsConnecting(true);

  // Wait 1.5s for smoother transition, then join
  setTimeout(() => {
    setIsConnecting(false);
    setAccepted(true);
  }, 1500);
});


  // When callee rejects
  socket.on("call:rejected", () => {
    console.log("❌ Callee rejected the call");
    toast({ title: "Call rejected" });
    navigate("/dashboard");
  });

  // When caller cancels
  socket.on("call:cancelled", () => {
    console.log("☎️ Caller cancelled the call");
    toast({ title: "Call cancelled" });
    navigate("/dashboard");
  });

  return () => {
    socket.off("call:accepted");
    socket.off("call:rejected");
    socket.off("call:cancelled");
  };
}, [socket]);



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

  // ✅ Show different UI based on role before accepting
if (role === "callee" && !accepted) {
  const queryParams = new URLSearchParams(window.location.search);
  const callId = queryParams.get("callId");
  const callerId = queryParams.get("fromUserId"); // only if you pass it in link

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white text-center">
      <audio id="incomingTone" autoPlay loop>
        <source src="/sounds/incoming.mp3" type="audio/mpeg" />
      </audio>
      <h2 className="text-2xl font-semibold mb-4">📞 Incoming Call</h2>
      <p className="text-gray-400 mb-6">Tap “Accept” to enable audio & video</p>

      <div className="flex gap-6">
        <button
          onClick={() => {
            setAccepted(true);
            safeEmit("call:response", {
              toUserId: callerId, // notify the backend who the caller is
              accepted: true,
              callId,
              channelName,
            });
          }}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-full text-white font-semibold shadow-lg"
        >
          Accept
        </button>

        <button
          onClick={() => {
            safeEmit("call:response", {
              toUserId: callerId,
              accepted: false,
              callId,
              channelName,
            });
            navigate("/dashboard");
          }}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full text-white font-semibold shadow-lg"
        >
          Decline
        </button>
      </div>
    </div>
  );
}


// ✅ Caller waiting screen
if (role === "caller" && !accepted) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white text-center">
      <h2 className="text-2xl font-semibold mb-4">📞 Calling...</h2>
      <p className="text-gray-400 mb-6">Waiting for other user to answer</p>

      <audio id="ringtone" autoPlay loop>
        <source src="/sounds/ringtone.mp3" type="audio/mpeg" />
      </audio>

      <button
        onClick={() => {
          const ring = document.getElementById("ringtone") as HTMLAudioElement;
          if (ring) ring.pause();
          safeEmit("call:cancelled", { channelName });
          navigate("/dashboard");
        }}
        className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full text-white font-semibold"
      >
        Cancel Call
      </button>
    </div>
  );
}

// 🌀 Show Connecting Overlay
if (isConnecting) {
  return (
    <AnimatePresence>
      <motion.div
        key="connecting-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white text-center"

      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-transparent border-white rounded-full mb-6"
        />
        <h2 className="text-2xl font-semibold mb-2">🔗 Connecting...</h2>
        <p className="text-gray-400 text-sm">Setting up your audio and video...</p>
      </motion.div>
    </AnimatePresence>
  );
}



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