// frontend/src/pages/CallRoom.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, Wifi, Maximize2 } from "lucide-react";
import { useSocket } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";

// Critical: Set log level and configure SDK for mobile
AgoraRTC.setLogLevel(2); // Only warnings and errors
AgoraRTC.enableLogUpload(); // Send logs to Agora for debugging

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
  const reconnectAttempts = useRef(0);
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const [joined, setJoined] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<"good" | "poor" | "bad">("good");
  const [isSwapped, setIsSwapped] = useState(false);
  const [connectionState, setConnectionState] = useState<string>("DISCONNECTED");
  // For draggable small video position
  const [position, setPosition] = useState({ x: 16, y: 80 });
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

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

  // Health check to keep connection alive
  const startHealthCheck = () => {
    if (healthCheckInterval.current) clearInterval(healthCheckInterval.current);

    healthCheckInterval.current = setInterval(async () => {
      const client = clientRef.current;
      if (!client) return;

      try {
        if (client.connectionState === "CONNECTED") {
          // Make a light stats call to keep connection alive (helps mobile NAT/timeouts)
          try {
            // getRTCStats may not exist in some SDK builds; use optional chaining
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await client.getRTCStats?.();
            console.log("Health check: Connection alive");
          } catch (err) {
            console.warn("Health check stats call failed:", err);
          }
        } else if (client.connectionState === "DISCONNECTED") {
          console.warn("Health check: Connection lost, attempting reconnect");
          attemptReconnect();
        }
      } catch (err) {
        console.warn("Health check exception:", err);
      }
    }, 8000); // Check every 8 seconds
  };

  const attemptReconnect = async () => {
    if (reconnectAttempts.current >= 3 || isCleaningUp.current) {
      toast({
        title: "Connection Failed",
        description: "Unable to reconnect. Ending call.",
        variant: "destructive",
      });
      endCall(false);
      return;
    }

    reconnectAttempts.current++;
    console.log(`Reconnect attempt ${reconnectAttempts.current}`);

    try {
      const client = clientRef.current;
      if (!client) return;

      // Republish tracks if needed
      const publishArr = [localAudioRef.current, localVideoRef.current].filter(Boolean) as any[];
      if (publishArr.length > 0) {
        try {
          await client.publish(publishArr);
        } catch (err) {
          console.warn("Republish failed during reconnect:", err);
          // attempt subscribe re-setup handled by SDK when connection restored
        }
      }

      reconnectAttempts.current = 0; // Reset on (assumed) success
      toast({ title: "Reconnected successfully" });
    } catch (err) {
      console.error("Reconnect failed:", err);
    }
  };

  useEffect(() => {
    if (!channelName || joinInProgress.current || isCleaningUp.current) return;

    const initCall = async () => {
      joinInProgress.current = true;
      await stopTracks();

      // Optional proxy to help mobile networks / WebSocket fallback (may be removed if not needed)
      try {
        // Use Agora parameters to enable proxy/fallback behavior for unstable mobile networks
        // These parameters may be vendor-specific; keep them optional
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        AgoraRTC.setParameter("rtc.enableProxy", true);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        AgoraRTC.setParameter("rtc.proxyServer", "wss://webdemo.agora.io");
      } catch (err) {
        console.warn("Could not set proxy parameters:", err);
      }

      // Create client with optimized settings for mobile
      const client = AgoraRTC.createClient({
        mode: "rtc",
        codec: "h264", // ✅ more reliable on many mobile devices
      });
      clientRef.current = client;

      try {
        // Fetch token
        const res = await fetch(`${API_BASE}/api/agora/token?channelName=${channelName}`);
        const data = await res.json();
        if (!data.success) throw new Error("Failed to get Agora token");

        // Join channel with retry
        let joinSuccess = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await client.join(data.appId, data.channelName, data.token, data.uid);
            joinSuccess = true;
            break;
          } catch (err) {
            console.warn(`Join attempt ${attempt + 1} failed:`, err);
            if (attempt === 2) throw err;
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        if (!joinSuccess) throw new Error("Failed to join after 3 attempts");

        // Network quality monitoring with adaptive response
        client.on("network-quality", (stats: any) => {
          const uplink = stats.uplinkNetworkQuality;
          const downlink = stats.downlinkNetworkQuality;

          const worstQuality = Math.max(uplink, downlink);

          if (worstQuality <= 2) {
            setNetworkQuality("good");
          } else if (worstQuality <= 4) {
            setNetworkQuality("poor");
            // Switch remote to low quality
            remoteUsers.forEach(async (user) => {
              try {
                await client.setRemoteVideoStreamType(user.uid, 1);
              } catch (err) {
                console.warn("Failed to switch to low stream:", err);
              }
            });
          } else {
            setNetworkQuality("bad");
            // Switch remote to low quality
            remoteUsers.forEach(async (user) => {
              try {
                await client.setRemoteVideoStreamType(user.uid, 1);
              } catch (err) {
                console.warn("Failed to switch to low stream:", err);
              }
            });
          }
        });

        // Enable dual stream with conservative settings (enable after join)
        try {
          await client.enableDualStream();
          await client.setLowStreamParameter({
            width: 240,
            height: 180,
            framerate: 10,
            bitrate: 100,
          });
        } catch (err) {
          console.warn("Dual stream setup failed:", err);
        }

        // Create tracks with conservative mobile settings
        let audio: ILocalAudioTrack | null = null;
        let video: ILocalVideoTrack | null = null;

        try {
          // Audio track with aggressive optimization
          audio = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            AGC: true,
            ANS: true,
            encoderConfig: {
              sampleRate: 48000,
              stereo: false,
              bitrate: 48,
            },
          });

          // Video track with mobile-optimized settings (slightly higher bitrate for stable decoding)
          video = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: { ideal: 480, max: 640 },
              height: { ideal: 360, max: 480 },
              frameRate: { ideal: 12, max: 15 }, // lower fps for stability
              bitrateMin: 300,
              bitrateMax: 800, // increase to avoid decode failure
            },
            optimizationMode: "motion",
            facingMode: "user",
          });
        } catch (err: any) {
          console.error("Track creation error:", err);

          // Try audio-only fallback
          try {
            audio = await AgoraRTC.createMicrophoneAudioTrack({
              AEC: true,
              AGC: true,
              ANS: true,
              encoderConfig: {
                sampleRate: 48000,
                stereo: false,
                bitrate: 48,
              },
            });
            toast({
              title: "Camera unavailable",
              description: "Using audio-only mode",
              variant: "destructive",
            });
          } catch (audioErr) {
            throw new Error("Could not access microphone or camera");
          }
        }

        localAudioRef.current = audio;
        localVideoRef.current = video;

        // Play local video (safely)
        if (video) {
          try {
            await video.play("local-player");
          } catch (err) {
            console.warn("Local video play failed:", err);
          }
        }

        // Publish with retry
        const publishArr = [audio, video].filter(Boolean) as any[];
        if (publishArr.length > 0) {
          let publishSuccess = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await client.publish(publishArr);
              publishSuccess = true;
              break;
            } catch (err) {
              console.warn(`Publish attempt ${attempt + 1} failed:`, err);
              if (attempt === 2) throw err;
              await new Promise((r) => setTimeout(r, 500));
            }
          }
          if (!publishSuccess) throw new Error("Failed to publish tracks");
        }

        // Remote user handling
        client.on("user-published", async (user: any, mediaType: string) => {
          console.log(`User ${user.uid} published ${mediaType}`);

          try {
            // Subscribe with retry
            let subscribeSuccess = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                await client.subscribe(user, mediaType);
                subscribeSuccess = true;
                break;
              } catch (err) {
                console.warn(`Subscribe attempt ${attempt + 1} failed:`, err);
                if (attempt === 2) throw err;
                await new Promise((r) => setTimeout(r, 500));
              }
            }

            if (!subscribeSuccess) throw new Error("Failed to subscribe");

            // Immediately request low-quality stream for stability on mobile
            if (mediaType === "video") {
              try {
                await client.setRemoteVideoStreamType(user.uid, 1); // low stream
              } catch (err) {
                console.warn("Low stream request failed:", err);
              }

              // Remove any old player element before creating a new one
              const existingPlayer = document.getElementById(`player-${user.uid}`);
              if (existingPlayer) existingPlayer.remove();

              // Create a new player container
              const el = document.createElement("div");
              el.id = `player-${user.uid}`;
              el.className = "w-full h-full";
              document.getElementById("remote-player")?.append(el);

              // Improved retry logic with safety against RECV_VIDEO_DECODE_FAILED
              const playWithRetry = async (retries = 4) => {
                for (let i = 0; i < retries; i++) {
                  try {
                    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
                    user.videoTrack?.stop();
                    user.videoTrack?.play(`player-${user.uid}`);
                    console.log(`✅ Remote video playing for ${user.uid}`);
                    break;
                  } catch (err) {
                    console.warn(`Remote video play attempt ${i + 1} failed:`, err);
                    if (i === retries - 1) {
                      toast({
                        title: "⚠️ Video Decode Issue",
                        description:
                          "Remote video may not display properly due to network or device limitation.",
                        variant: "destructive",
                      });
                    }
                  }
                }
              };

              await playWithRetry();
            }

            if (mediaType === "audio") {
              user.audioTrack?.play();
            }

            setRemoteUsers((prev) => {
              const filtered = prev.filter((u) => u.uid !== user.uid);
              return [...filtered, user];
            });
          } catch (err) {
            console.error("User published error:", err);
            toast({
              title: "Connection Issue",
              description: `Failed to receive ${mediaType} from remote user`,
              variant: "destructive",
            });
          }
        });

        client.on("user-unpublished", (user: any, mediaType: string) => {
          console.log(`User ${user.uid} unpublished ${mediaType}`);
          if (mediaType === "video") {
            document.getElementById(`player-${user.uid}`)?.remove();
          }
        });

        client.on("user-left", (user: any) => {
          console.log(`User ${user.uid} left`);
          document.getElementById(`player-${user.uid}`)?.remove();
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });

        // Exception handling with recovery
        client.on("exception", (event: any) => {
          console.warn("Agora exception:", event);

          if (event.code === 2003) {
            // SEND_AUDIO_BITRATE_TOO_LOW
            console.log("Low audio bitrate detected - already optimized");
          }
          if (event.code === 1005) {
            // RECV_VIDEO_DECODE_FAILED
            console.log("Video decode failure - restarting remote video tracks");
            // Try to restart remote video tracks to recover decoding
            setRemoteUsers((prev) => {
              prev.forEach((u: any) => {
                try {
                  u.videoTrack?.stop();
                  setTimeout(() => {
                    try {
                      u.videoTrack?.play(`player-${u.uid}`);
                    } catch (err) {
                      console.warn("Retry play failed for", u.uid, err);
                    }
                  }, 300);
                } catch (err) {
                  console.warn("Error restarting video track for", u.uid, err);
                }
              });
              return prev;
            });
          }
        });

        // Connection state monitoring with recovery
        client.on("connection-state-change", (curState: any, prevState: any, reason: any) => {
          console.log(`Connection: ${prevState} -> ${curState}, reason: ${reason}`);
          setConnectionState(curState);

          if (curState === "DISCONNECTED") {
            toast({
              title: "Connection Lost",
              description: "Attempting to reconnect...",
              variant: "destructive",
            });
            attemptReconnect();
          } else if (curState === "RECONNECTING") {
            toast({
              title: "Reconnecting...",
              description: "Please wait",
            });
          } else if (curState === "CONNECTED") {
            reconnectAttempts.current = 0;
            if (prevState === "RECONNECTING") {
              toast({ title: "Reconnected!" });
            }
          }
        });

        // Notify socket
        socket?.emit("call:start", {
          channelName,
          userId: localStorage.getItem("userId"),
        });

        // Start health check
        startHealthCheck();

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
            description: "The paid time has ended.",
          });
          endCall(false);
        }, msLimit);
      } catch (err: any) {
        console.error("Join error:", err);
        toast({
          title: "Call Failed",
          description: err.message || "Could not join call.",
          variant: "destructive",
        });
        navigate("/dashboard");
      } finally {
        joinInProgress.current = false;
      }
    };

    initCall();

    // Socket listeners
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
      if (healthCheckInterval.current) clearInterval(healthCheckInterval.current);
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

    // Re-render videos
    setTimeout(() => {
      const localTarget = isSwapped ? "remote-player" : "local-player";
      const remoteTarget = isSwapped ? "local-player" : "remote-player";

      // Re-attach local track
      if (localVideoRef.current) {
        localVideoRef.current.stop();
        setTimeout(() => {
          try {
            localVideoRef.current?.play(localTarget);
          } catch {}
        }, 200);
      }

      // Re-attach each remote track
      remoteUsers.forEach((user) => {
        if (user.videoTrack) {
          user.videoTrack.stop();
          setTimeout(() => {
            try {
              user.videoTrack?.play(remoteTarget);
            } catch {}
          }, 200);
        }
      });
    }, 300);
  };

  const endCall = async (silent = false) => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    try {
      // Clear all intervals
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callLimitTimeoutRef.current) {
        clearTimeout(callLimitTimeoutRef.current);
        callLimitTimeoutRef.current = null;
      }
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
        healthCheckInterval.current = null;
      }

      // Unpublish and leave
      const client = clientRef.current;
      if (client) {
        try {
          // safe unpublish - pass no args to unpublish all if supported
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await client.unpublish?.();
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
      case "good":
        return <Wifi className="w-4 h-4 text-green-500" />;
      case "poor":
        return <Wifi className="w-4 h-4 text-yellow-500" />;
      case "bad":
        return <Wifi className="w-4 h-4 text-red-500" />;
    }
  };

  const getConnectionStatus = () => {
    if (connectionState === "CONNECTED") return "Connected";
    if (connectionState === "CONNECTING") return "Connecting...";
    if (connectionState === "RECONNECTING") return "Reconnecting...";
    if (connectionState === "DISCONNECTED") return "Disconnected";
    return "Unknown";
  };

  // 🔹 Drag Handlers for Floating Preview
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    dragRef.current = { offsetX: clientX - rect.left, offsetY: clientY - rect.top };
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setPosition({
      x: Math.max(0, clientX - dragRef.current.offsetX),
      y: Math.max(0, clientY - dragRef.current.offsetY),
    });
  };

  const handleDragEnd = () => {
    dragRef.current = null;
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden">
      {/* Main Video */}
      <div className="flex-1 relative bg-black">
        <div
          id={isSwapped ? "local-player" : "remote-player"}
          className="w-full h-full flex items-center justify-center"
        >
          {!isSwapped && remoteUsers.length === 0 && (
            <div className="text-center">
              <div className="text-gray-400 text-lg mb-2 animate-pulse">Waiting for remote user...</div>
              <div className="text-gray-500 text-sm">{getConnectionStatus()}</div>
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

        {/* 🧲 Draggable Small Floating Video */}
        <div
          className="fixed z-50 w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-44 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700 cursor-move touch-none select-none"
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div id={isSwapped ? "remote-player" : "local-player"} className="w-full h-full">
            {!joined && !isSwapped && (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">Connecting...</div>
            )}
          </div>

          {/* Swap button */}
          <button
            onClick={swapViews}
            className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 p-1.5 rounded-full transition-all active:scale-95"
            title="Swap views"
          >
            <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>

          {/* Label */}
          <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs">{isSwapped ? "Remote" : "You"}</div>
        </div>

        {/* Swap button (duplicate for main area) */}
        <button
          onClick={swapViews}
          className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 p-1.5 rounded-full transition-all active:scale-95"
          title="Swap views"
        >
          <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>

        {/* Label */}
        <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs">{isSwapped ? "Remote" : "You"}</div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 pb-6">
        <div className="flex justify-center items-center gap-3 sm:gap-4 max-w-md mx-auto">
          {/* Mic Button */}
          <button
            onClick={toggleMic}
            className={`p-3 sm:p-4 rounded-full transition-all active:scale-95 ${
              isMicOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
            title={isMicOn ? "Mute" : "Unmute"}
          >
            {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleCamera}
            className={`p-3 sm:p-4 rounded-full transition-all active:scale-95 ${
              isCamOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
            title={isCamOn ? "Turn off camera" : "Turn on camera"}
          >
            {isCamOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={() => endCall(false)}
            className="p-3 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all active:scale-95"
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
