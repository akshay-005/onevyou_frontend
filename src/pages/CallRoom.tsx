// frontend/src/pages/CallRoom.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, Wifi, Maximize2 } from "lucide-react";
import { useSocket } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";

// Set Agora log level to reduce noise
AgoraRTC.setLogLevel(1); // 0=debug, 1=info, 2=warning, 3=error, 4=none

const CallRoom: React.FC = () => {
  const { channelName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const socket = useSocket();

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<ILocalAudioTrack | null>(null);
  const localVideoRef = useRef<ILocalVideoTrack | null>(null);
  const joinInProgress = useRef(false);
  const isCleaningUp = useRef(false);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const [joined, setJoined] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<"good" | "poor" | "bad">("good");
  const [isSwapped, setIsSwapped] = useState(false); // Track if views are swapped

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);

  const query = new URLSearchParams(window.location.search);
  const durationMin = Number(query.get("duration")) || 1;

  const stopTracks = async () => {
    try {
      if (localAudioRef.current) {
        localAudioRef.current.stop();
        localAudioRef.current.close();
        localAudioRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.stop();
        localVideoRef.current.close();
        localVideoRef.current = null;
      }
    } catch (err) {
      console.warn("Track cleanup error:", err);
    }
  };

  useEffect(() => {
    if (!channelName || joinInProgress.current || isCleaningUp.current) return;

    const initCall = async () => {
      joinInProgress.current = true;
      await stopTracks();

      const client = AgoraRTC.createClient({ 
        mode: "rtc", 
        codec: "vp8" // VP8 is more stable than H264 on most devices
      });
      clientRef.current = client;

      try {
        // Fetch token
        const res = await fetch(`${API_BASE}/api/agora/token?channelName=${channelName}`);
        const data = await res.json();
        if (!data.success) throw new Error("Failed to get Agora token");

        // Join channel
        await client.join(data.appId, data.channelName, data.token, data.uid);

        // Network quality monitoring
        client.on("network-quality", (stats) => {
          const quality = stats.uplinkNetworkQuality;
          if (quality <= 2) setNetworkQuality("good");
          else if (quality <= 4) setNetworkQuality("poor");
          else setNetworkQuality("bad");
        });

        // Enable dual stream for adaptive quality
        await client.enableDualStream();
        client.setLowStreamParameter({
          width: 320,
          height: 240,
          framerate: 15,
          bitrate: 140,
        });

        // Create local tracks with optimized settings
        let audio: ILocalAudioTrack | null = null;
        let video: ILocalVideoTrack | null = null;

        try {
          [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks(
            {
              AEC: true, // Acoustic Echo Cancellation
              AGC: true, // Auto Gain Control
              ANS: true, // Automatic Noise Suppression
            },
            {
              encoderConfig: {
                width: 640,
                height: 480,
                frameRate: 24, // Lower from 30 to reduce load
                bitrateMin: 400,
                bitrateMax: 800, // Reduced from 900 for stability
              },
              optimizationMode: "detail", // Better for faces
            }
          );
        } catch (err: any) {
          console.error("Track creation error:", err);
          toast({ 
            title: "Camera/Mic Error", 
            description: "Trying audio-only mode...", 
            variant: "destructive" 
          });
          try {
            audio = await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,
              AGC: true,
              ANS: true,
            });
          } catch (audioErr) {
            throw new Error("Could not access microphone");
          }
        }

        localAudioRef.current = audio;
        localVideoRef.current = video;

        // Play local video in small view
        if (video) {
          await video.play("local-player");
        }

        // Publish tracks
        const publishArr = [audio, video].filter(Boolean) as any[];
        if (publishArr.length > 0) {
          await client.publish(publishArr);
        }

        // Remote user handling with improved error recovery
        client.on("user-published", async (user, mediaType) => {
          try {
            await client.subscribe(user, mediaType);

            if (mediaType === "video") {
              // Request low stream for better stability on weak networks
              if (networkQuality !== "good") {
                await client.setRemoteVideoStreamType(user.uid, 1); // 1 = low stream
              }

              // Create player element
              const existingPlayer = document.getElementById(`player-${user.uid}`);
              if (existingPlayer) existingPlayer.remove();

              const el = document.createElement("div");
              el.id = `player-${user.uid}`;
              el.className = "w-full h-full";
              document.getElementById("remote-player")?.append(el);

              // Play with retry logic
              const playVideo = async (retries = 3) => {
                for (let i = 0; i < retries; i++) {
                  try {
                    await new Promise(r => setTimeout(r, 300 * (i + 1))); // Increasing delay
                    user.videoTrack?.play(`player-${user.uid}`);
                    break;
                  } catch (err) {
                    console.warn(`Video play attempt ${i + 1} failed:`, err);
                    if (i === retries - 1) {
                      toast({ 
                        title: "Video Issue", 
                        description: "Remote video may not display properly",
                        variant: "destructive"
                      });
                    }
                  }
                }
              };
              await playVideo();
            }

            if (mediaType === "audio") {
              user.audioTrack?.play();
            }

            setRemoteUsers((prev) => {
              const filtered = prev.filter((u) => u.uid !== user.uid);
              return [...filtered, user];
            });
          } catch (err) {
            console.error("Subscribe error:", err);
            toast({ 
              title: "Connection Issue", 
              description: "Failed to receive remote stream",
              variant: "destructive"
            });
          }
        });

        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "video") {
            document.getElementById(`player-${user.uid}`)?.remove();
          }
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });

        // Handle user leaving
        client.on("user-left", (user) => {
          document.getElementById(`player-${user.uid}`)?.remove();
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });

        // Exception handling
        client.on("exception", (event) => {
          console.warn("Agora exception:", event);
          if (event.code === 1005) { // RECV_VIDEO_DECODE_FAILED
            console.log("Attempting to recover from decode failure...");
          }
        });

        // Connection state monitoring
        client.on("connection-state-change", (curState, prevState, reason) => {
          console.log(`Connection: ${prevState} -> ${curState}, reason: ${reason}`);
          if (curState === "DISCONNECTED" || curState === "DISCONNECTING") {
            toast({ 
              title: "Connection Lost", 
              description: "Attempting to reconnect...",
              variant: "destructive"
            });
          }
        });

        // Notify socket
        socket?.emit("call:start", { 
          channelName, 
          userId: localStorage.getItem("userId") 
        });

        // Start timer
        startTime.current = Date.now();
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
          setDurationSec(elapsed);
        }, 1000);
        setJoined(true);

        // Auto-end after time limit
        const msLimit = durationMin * 60 * 1000;
        callLimitTimeoutRef.current = setTimeout(() => {
          toast({ 
            title: "⏰ Time's up", 
            description: "The paid time has ended." 
          });
          endCall(false);
        }, msLimit);

      } catch (err: any) {
        console.error("Join error:", err);
        toast({ 
          title: "Call Failed", 
          description: err.message || "Could not join call.", 
          variant: "destructive" 
        });
        navigate("/dashboard");
      } finally {
        joinInProgress.current = false;
      }
    };

    initCall();

    // Socket listener for remote end
    const handleCallEnded = (payload: any) => {
      if (payload.channelName === channelName) {
        endCall(true);
      }
    };
    socket?.on("call:ended", handleCallEnded);

    return () => {
      socket?.off("call:ended", handleCallEnded);
      if (timerRef.current) clearInterval(timerRef.current);
      if (callLimitTimeoutRef.current) clearTimeout(callLimitTimeoutRef.current);
      endCall(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  const toggleMic = async () => {
    const audio = localAudioRef.current;
    if (!audio) {
      toast({ title: "No microphone available" });
      return;
    }
    try {
      const newState = !isMicOn;
      await audio.setEnabled(newState);
      setIsMicOn(newState);
    } catch (err) {
      console.error("Mic toggle error:", err);
      toast({ title: "Failed to toggle microphone", variant: "destructive" });
    }
  };

  const toggleCamera = async () => {
    const video = localVideoRef.current;
    if (!video) {
      toast({ title: "No camera available" });
      return;
    }
    try {
      const newState = !isCamOn;
      await video.setEnabled(newState);
      setIsCamOn(newState);
    } catch (err) {
      console.error("Camera toggle error:", err);
      toast({ title: "Failed to toggle camera", variant: "destructive" });
    }
  };

  const swapViews = () => {
    setIsSwapped(!isSwapped);
    
    // Re-render videos in their new positions
    setTimeout(() => {
      if (localVideoRef.current) {
        const targetId = isSwapped ? "remote-player" : "local-player";
        localVideoRef.current.play(targetId);
      }
      
      remoteUsers.forEach(user => {
        if (user.videoTrack) {
          const targetId = isSwapped ? "local-player" : `player-${user.uid}`;
          user.videoTrack.play(targetId);
        }
      });
    }, 100);
  };

  const endCall = async (silent = false) => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    try {
      // Clear timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callLimitTimeoutRef.current) {
        clearTimeout(callLimitTimeoutRef.current);
        callLimitTimeoutRef.current = null;
      }

      // Unpublish and leave
      const client = clientRef.current;
      if (client) {
        try {
          await client.unpublish();
        } catch (err) {
          console.warn("Unpublish error:", err);
        }

        try {
          await client.leave();
        } catch (err) {
          console.warn("Leave error:", err);
        }

        client.removeAllListeners();
        clientRef.current = null;
      }

      // Stop tracks
      await stopTracks();

      // Update state
      setJoined(false);
      setRemoteUsers([]);

      // Notify backend
      socket?.emit("call:end", { channelName, durationSec });

      if (!silent) {
        toast({ title: "Call Ended" });
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("End call error:", err);
    } finally {
      isCleaningUp.current = false;
    }
  };

  const format = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getNetworkIcon = () => {
    switch (networkQuality) {
      case "good": return <Wifi className="w-4 h-4 text-green-500" />;
      case "poor": return <Wifi className="w-4 h-4 text-yellow-500" />;
      case "bad": return <Wifi className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden">
      {/* Main Video (Remote user by default, or local if swapped) */}
      <div className="flex-1 relative bg-black">
        <div 
          id={isSwapped ? "local-player" : "remote-player"}
          className="w-full h-full flex items-center justify-center"
        >
          {!isSwapped && remoteUsers.length === 0 && (
            <div className="text-center">
              <div className="text-gray-400 text-lg mb-2 animate-pulse">
                Waiting for remote user...
              </div>
              <div className="text-gray-500 text-sm">
                {joined ? "Connected" : "Connecting..."}
              </div>
            </div>
          )}
        </div>

        {/* Top Info Bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
              <Clock className="w-4 h-4" /> 
              <span className="text-sm font-medium">{format(durationSec)}</span>
            </div>
            <div 
              className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full" 
              title={`Network: ${networkQuality}`}
            >
              {getNetworkIcon()}
            </div>
          </div>
        </div>

        {/* Small Floating Video (Local by default, or remote if swapped) */}
        <div className="absolute top-20 right-4 w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-44 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          <div 
            id={isSwapped ? "remote-player" : "local-player"}
            className="w-full h-full"
          >
            {!joined && !isSwapped && (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                Connecting...
              </div>
            )}
          </div>
          
          {/* Swap button on small video */}
          <button
            onClick={swapViews}
            className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 p-1.5 rounded-full transition-all"
            title="Swap views"
          >
            <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>

          {/* Label */}
          <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs">
            {isSwapped ? "Remote" : "You"}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 pb-6 safe-area-bottom">
        <div className="flex justify-center items-center gap-3 sm:gap-4 max-w-md mx-auto">
          {/* Mic Button */}
          <button
            onClick={toggleMic}
            className={`p-3 sm:p-4 rounded-full transition-all ${
              isMicOn 
                ? "bg-gray-700 hover:bg-gray-600" 
                : "bg-red-600 hover:bg-red-700"
            }`}
            title={isMicOn ? "Mute" : "Unmute"}
          >
            {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleCamera}
            className={`p-3 sm:p-4 rounded-full transition-all ${
              isCamOn 
                ? "bg-gray-700 hover:bg-gray-600" 
                : "bg-red-600 hover:bg-red-700"
            }`}
            title={isCamOn ? "Turn off camera" : "Turn on camera"}
          >
            {isCamOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={() => endCall(false)}
            className="p-3 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
            title="End call"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallRoom;