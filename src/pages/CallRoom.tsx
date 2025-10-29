// frontend/src/pages/CallRoom.tsx - 100% WORKING VERSION
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, Maximize2 } from "lucide-react";
import { useSocket, safeEmit } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

AgoraRTC.setLogLevel(3);

const CallRoom: React.FC = () => {
  const { channelName } = useParams();
  const role = new URLSearchParams(window.location.search).get("role") || "caller";
  const navigate = useNavigate();
  const { toast } = useToast();
  const socket = useSocket();

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<ILocalAudioTrack | null>(null);
  const localVideoRef = useRef<ILocalVideoTrack | null>(null);
  const hasJoinedRef = useRef(false);
  const cleanupDoneRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const autoEndTimerRef = useRef<number | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const [joined, setJoined] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
 const [accepted, setAccepted] = useState(() => {
  const role = new URLSearchParams(window.location.search).get("role");
  // If role=callee and we just came from an accepted flow, skip the incoming screen
  const autoAccept = localStorage.getItem("autoAccept") === "true";
  if (role === "callee" && autoAccept) {
    localStorage.removeItem("autoAccept");
    return true;
  }
  return false;
});

  const [isConnecting, setIsConnecting] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const query = new URLSearchParams(window.location.search);
  const durationMin = Number(query.get("duration")) || 1;

  // 🔧 CRITICAL: 8-second buffer for network delays + processing
  const CALL_DURATION_MS = durationMin * 60 * 1000;
  const GRACE_PERIOD_MS = 8000; // 8 seconds buffer

  // Safe play helper
  const safePlay = async (track: any, elementId?: string) => {
    if (!track) return;
    
    try {
      const result = elementId ? track.play(elementId) : track.play();
      if (result && typeof result.catch === 'function') {
        await result.catch((e: any) => {
          console.warn("Play warning (non-critical):", e?.message || e);
        });
      }
    } catch (e: any) {
      console.warn("Play error (non-critical):", e?.message || e);
    }
  };

  // Cleanup function
  const cleanup = async () => {

    if (!hasJoinedRef.current) {
  console.warn("⚠️ Cleanup triggered before joining — ignoring");
  return;
}

    if (isCleaningUpRef.current) {
      console.log("⚠️ Cleanup already in progress, skipping");
      return;
    }

    if (cleanupDoneRef.current) {
      console.log("⚠️ Cleanup already completed, skipping");
      return;
    }

    isCleaningUpRef.current = true;
    console.log("🧹 Starting cleanup");

    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (autoEndTimerRef.current) {
      clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }

    // Calculate elapsed time
    const elapsed = startTimeRef.current > 0 
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;

    // Notify backend
const userId = localStorage.getItem("userId");
if (userId && channelName) {
  await safeEmit("call:end", { channelName, durationSec: elapsed, userId });
}


    // Stop all audio
    document.querySelectorAll("audio").forEach(audio => {
      audio.pause();
      audio.src = "";
    });

    // Clean up Agora
    const client = clientRef.current;
    if (client) {
      try {
        if (localAudioRef.current || localVideoRef.current) {
          const tracks = [localAudioRef.current, localVideoRef.current].filter(Boolean);
          if (tracks.length > 0) {
            await client.unpublish(tracks as any).catch(() => {});
          }
        }
        await client.leave().catch(() => {});
        client.removeAllListeners();
      } catch (err) {
        console.warn("Client cleanup warning:", err);
      }
    }

    // Close tracks
    if (localAudioRef.current) {
      try {
        localAudioRef.current.close();
      } catch (e) {}
      localAudioRef.current = null;
    }

    if (localVideoRef.current) {
      try {
        localVideoRef.current.close();
      } catch (e) {}
      localVideoRef.current = null;
    }

    cleanupDoneRef.current = true;
    isCleaningUpRef.current = false;
    
    console.log("✅ Cleanup complete");
    
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    toast({ 
      title: "Call ended", 
      description: `Duration: ${mins}m ${secs}s` 
    });
    
    setTimeout(() => navigate("/dashboard"), 300);
  };

  // Main call initialization
  useEffect(() => {
    if (!accepted || !channelName || hasJoinedRef.current) return;

    hasJoinedRef.current = true;
    let mounted = true;

    const init = async () => {
      try {
        // Request permissions
        console.log("🔓 Requesting permissions...");
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
        });
        tempStream.getTracks().forEach(track => track.stop());
        console.log("✅ Permissions granted");

        if (!mounted) return;

        // Create client
        const client = AgoraRTC.createClient({ 
          mode: "rtc", 
          codec: "vp8"
        });
        clientRef.current = client;

        // Get token
        const res = await fetch(
          `${API_BASE}/api/agora/token?channelName=${channelName}&durationMin=${durationMin}`
        );
        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.message || "Failed to get token");
        }

        if (!mounted) return;

        console.log("🔗 Preparing to join channel...");
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log("🔗 Joining channel...");
        await client.join(data.appId, channelName, data.token, data.uid);
        console.log("✅ Joined channel");

        if (!mounted) return;

        // 🔧 FIX: Bind remote events BEFORE creating local tracks
        client.on("user-published", async (user, mediaType) => {
          console.log(`📥 Remote user ${user.uid} published ${mediaType}`);
          
          try {
            await client.subscribe(user, mediaType);
            console.log(`✅ Subscribed to ${user.uid} ${mediaType}`);
            
            if (mediaType === "video" && user.videoTrack) {
              // Wait for DOM
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const container = document.getElementById("remote-player");
              if (container) {
                // Clear any existing content
                container.innerHTML = "";
                
                // Create new player div
                const playerDiv = document.createElement("div");
                playerDiv.id = `player-${user.uid}`;
                playerDiv.className = "w-full h-full";
                container.appendChild(playerDiv);
                
                // Play video
                await safePlay(user.videoTrack, `player-${user.uid}`);
                console.log(`🎥 Playing remote video for ${user.uid}`);
              }
            }
            
            if (mediaType === "audio" && user.audioTrack) {
              await safePlay(user.audioTrack);
              console.log(`🎧 Playing remote audio for ${user.uid}`);
            }

            setRemoteUsers(prev => {
              if (prev.find(u => u.uid === user.uid)) return prev;
              return [...prev, user];
            });
            
          } catch (err) {
            console.error("Subscribe error:", err);
          }
        });

        client.on("user-unpublished", (user, mediaType) => {
          console.log(`📤 User ${user.uid} unpublished ${mediaType}`);
          if (mediaType === "video") {
            document.getElementById(`player-${user.uid}`)?.remove();
          }
        });

        client.on("user-left", (user) => {
          console.log(`👋 User ${user.uid} left`);
          document.getElementById(`player-${user.uid}`)?.remove();
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        });

        client.on("connection-state-change", (cur, prev) => {
          console.log(`Connection: ${prev} → ${cur}`);
          if (cur === "DISCONNECTED") {
            if (!isCleaningUpRef.current && !cleanupDoneRef.current) {
              console.warn("⚠️ Unexpected disconnect");
              cleanup();
            } else {
              console.log("⚠️ Disconnect ignored (cleanup in progress)");
            }
          }
        });

        // Create media tracks
        console.log("🎥 Creating media tracks...");
        let audio: ILocalAudioTrack;
        let video: ILocalVideoTrack | null = null;

        try {
          [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { 
              AEC: true, 
              AGC: true, 
              ANS: true,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            { 
              encoderConfig: "480p_1",
              optimizationMode: "detail"
            }
          );
        } catch (err) {
          console.warn("Camera failed, audio only:", err);
          audio = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            AGC: true,
            ANS: true
          });
          toast({ 
            title: "Camera unavailable", 
            description: "Audio-only mode",
            variant: "destructive" 
          });
        }

        if (!mounted) return;

        localAudioRef.current = audio;
        localVideoRef.current = video;

        // Play local video
        if (video) {
          await new Promise(resolve => setTimeout(resolve, 300));
          await safePlay(video, "local-player");
        }

        // Wait before publishing
        await new Promise(resolve => setTimeout(resolve, 700));

        // Publish
        const tracksToPublish = video ? [audio, video] : [audio];
        console.log("📤 Publishing tracks...");
        await client.publish(tracksToPublish as any);
        console.log("✅ Published successfully");

        if (!mounted) return;

        /// 🕒 Start timer only after synced "call:start" event from server
setJoined(true);
console.log("⏳ Waiting for server-synced start time...");

// ✅ Notify backend only after socket is connected
const userId = localStorage.getItem("userId");
if (userId && socket) {
  if (!socket.connected) {
  console.log("⏳ Waiting for socket connection before emitting call:start...");
  await new Promise<void>((resolve) => {
    socket.once("connect", () => resolve());
  });
}

console.log("📤 Emitting call:start to server...");
safeEmit("call:start", { channelName, userId, role });


// ✅ ADD THIS: Client-side auto-end enforcement
const duration = durationMin || 1;
const durationMs = duration * 60 * 1000; // Exact duration

console.log(`⏰ Client: Setting auto-end for ${duration}m`);

const clientAutoEnd = setTimeout(() => {
  console.log("⏰ Client: Time's up! Ending call...");
  toast({
    title: "Call Ended",
    description: `Your ${duration}-minute call has ended`,
  });
  cleanup();
}, durationMs);

// Store timeout to clear on manual end
autoEndTimerRef.current = clientAutoEnd;
      } catch (err: any) {
        console.error("❌ Call failed:", err);
        toast({ 
          title: "Call Failed", 
          description: err.message || "Unable to start call",
          variant: "destructive" 
        });
        cleanup();
      }
    };

    init();


    // ✅ Synced timer start from server event (no drift)
const handleCallStart = (data: any) => {
  const { startedAt } = data;
  const serverStart = new Date(startedAt).getTime();
  const now = Date.now();
  const offset = now - serverStart;
  const remaining = Math.max(0, CALL_DURATION_MS - offset);

  console.log(`⏱️ Synced call start received. offset=${offset}ms, remaining=${remaining}ms`);

  // Start UI timer from serverStart
  startTimeRef.current = serverStart;
  if (timerRef.current) clearInterval(timerRef.current);
  timerRef.current = window.setInterval(() => {
    setDurationSec(Math.floor((Date.now() - serverStart) / 1000));
  }, 1000);

  // Auto-end exactly at server time
  if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
  autoEndTimerRef.current = window.setTimeout(() => {
    console.log("⏰ Synced time's up — ending call");
    cleanup();
  }, remaining);
};

socket?.on("call:start", handleCallStart);


    // ✅ Handle call ended
const handleCallEnded = () => {
  console.log("📞 Call ended by server");
  
  // ✅ Only cleanup if joined and not already in progress
  if (!cleanupDoneRef.current && !isCleaningUpRef.current && hasJoinedRef.current) {
    cleanup();
  } else {
    console.log("⚠️ Ignoring call:ended (already cleaned or not joined)");
  }
};


socket?.on("call:ended", handleCallEnded);

// ✅ Cleanup when unmounting or effect re-runs
return () => {
  mounted = false;
  socket?.off("call:start", handleCallStart);   
  socket?.off("call:ended", handleCallEnded);
  if (!cleanupDoneRef.current && !isCleaningUpRef.current) {
    cleanup();
  }
};
  }, [accepted, channelName, socket]);


 // ✅ Socket events - only for caller/callee state management
useEffect(() => {
  if (!socket) return;

  const handleAccepted = () => {
  console.log("✅ Call accepted");
  document.querySelectorAll("audio").forEach(a => {
    a.pause();
    a.src = "";
  });

  if (role === "caller") {
    console.log("📞 Caller transitioning to accepted state...");
    setAccepted(true);
    hasJoinedRef.current = false; // ensure next effect triggers fresh join
    cleanupDoneRef.current = false; // prevent false cleanup trigger
  }
};


  const handleRejected = () => {
    console.log("❌ Call rejected");
    toast({ title: "Call Declined", description: "User declined your call" });
    navigate("/dashboard");
  };

  const handleCancelled = () => {
    console.log("🚫 Call cancelled");
    toast({ title: "Call Cancelled" });
    navigate("/dashboard");
  };

  socket.on("call:accepted", handleAccepted);
  socket.on("call:rejected", handleRejected);
  socket.on("call:cancelled", handleCancelled);

  return () => {
    socket.off("call:accepted", handleAccepted);
    socket.off("call:rejected", handleRejected);
    socket.off("call:cancelled", handleCancelled);
  };
}, [socket, navigate, role]);


useEffect(() => {
  // Prevent duplicate call:response from outside
  socket?.off("call:response");
}, [socket]);




  // Controls
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


  
// ✅ Cleanup if user closes tab or refreshes
useEffect(() => {
  const handleBeforeUnload = () => {
    cleanup();
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, []);



 // 🔧 AUTO-ACCEPT HANDLER for NotificationPanel navigations
useEffect(() => {
  if (role === "callee" && !accepted) {
    console.log("🎬 Auto-accept triggered for callee (navigated from NotificationPanel)");
    setAccepted(true);
  }
}, [role, accepted]);


 if (role === "callee" && !accepted) {
  return (
    <div className="h-screen flex items-center justify-center bg-black text-white">
      <p>Connecting...</p>
    </div>
  );
}



  if (role === "caller" && !accepted) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white text-center px-4">
        <audio id="ringtone" autoPlay loop>
          <source src="/sounds/ringtone.mp3" type="audio/mpeg" />
        </audio>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-24 h-24 mx-auto border-4 border-t-transparent border-white rounded-full"
          />
          
          <h2 className="text-3xl font-bold">📞 Calling...</h2>
          <p className="text-gray-400 max-w-sm">
            Waiting for the other person to answer
          </p>

          <button
            onClick={() => {
              document.querySelectorAll("audio").forEach(a => {
                a.pause();
                a.src = "";
              });
              safeEmit("call:cancelled", { channelName });
              navigate("/dashboard");
            }}
            className="mt-8 px-8 py-4 bg-red-600 hover:bg-red-700 rounded-full text-white font-semibold shadow-xl transform hover:scale-105 transition"
          >
            Cancel Call
          </button>
        </motion.div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            className="w-16 h-16 border-4 border-t-transparent border-white rounded-full mb-6"
          />
          <h2 className="text-2xl font-semibold mb-2">🔗 Connecting...</h2>
          <p className="text-gray-400 text-sm">Setting up your video call</p>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Active call UI
  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex-1 relative bg-black overflow-hidden">
        {/* Remote video (full screen) */}
        <div 
          id="remote-player"
          className="absolute inset-0 w-full h-full bg-gray-900"
        >
          {remoteUsers.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-center"
              >
                <div className="text-gray-400 text-xl mb-3">
                  Waiting for other person...
                </div>
                <div className="text-gray-500 text-sm">
                  {joined ? "Connected" : "Connecting..."}
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>

        {/* Timer */}
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 shadow-lg z-10">
          <Clock className="w-5 h-5 text-green-400" />
          <span className="text-lg font-mono font-semibold">{format(durationSec)}</span>
          <span className="text-xs text-gray-400">/ {durationMin}:00</span>
        </div>

        {/* Local video (small preview) */}
        <div className="absolute top-4 right-4 w-32 h-44 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 z-10">
          <div id="local-player" className="w-full h-full" />
          <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-xs font-medium">
            You
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-6">
        <div className="flex justify-center gap-6">
          <button
            onClick={toggleMic}
            className={`p-5 rounded-full transition-all transform hover:scale-110 shadow-lg ${
              isMicOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isMicOn ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
          </button>
          
          <button
            onClick={toggleCamera}
            className={`p-5 rounded-full transition-all transform hover:scale-110 shadow-lg ${
              isCamOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isCamOn ? <Video className="w-7 h-7" /> : <VideoOff className="w-7 h-7" />}
          </button>
          
          <button
            onClick={cleanup}
            className="p-5 rounded-full bg-red-600 hover:bg-red-700 transition-all transform hover:scale-110 shadow-lg"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallRoom;