// frontend/src/pages/CallRoom.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, Wifi, Maximize2 } from "lucide-react";
import { useSocket } from "@/utils/socket";
import { useToast } from "@/hooks/use-toast";

AgoraRTC.setLogLevel(3); // Errors only

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
  const wsHealthInterval = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<{ token: string; expireTime: number } | null>(null);
  const subscribedUsers = useRef<Set<number>>(new Set());

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const [joined, setJoined] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<"good" | "poor" | "bad">("good");
  const [isSwapped, setIsSwapped] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);
  const lastPingTime = useRef<number>(Date.now());

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
      console.warn("Track cleanup:", err);
    }
  };

  // Refresh token before expiry (token is valid for 24 hours, refresh every 20 hours)
  const refreshTokenIfNeeded = async () => {
    try {
      if (!tokenRef.current) return;
      const now = Date.now();
      const timeUntilExpiry = tokenRef.current.expireTime - now;

      // If less than 30 minutes left, refresh
      if (timeUntilExpiry < 30 * 60 * 1000) {
        console.log("Refreshing Agora token...");
        const res = await fetch(
          `${API_BASE}/api/agora/token?channelName=${channelName}&durationMin=${durationMin}`
        );
        const data = await res.json();
        if (data.success) {
          tokenRef.current = { token: data.token, expireTime: now + 24 * 60 * 60 * 1000 };
          const client = clientRef.current;
          if (client) {
            try {
              // Renew token in SDK
              await client.renewToken(data.token);
              console.log("Token refreshed successfully");
            } catch (err) {
              console.warn("Token renewal failed:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Token refresh error:", err);
    }
  };

  // WebSocket keep-alive with token refresh
  const startWebSocketHealth = () => {
    if (wsHealthInterval.current) clearInterval(wsHealthInterval.current);

    wsHealthInterval.current = setInterval(async () => {
      const client = clientRef.current;
      if (!client || client.connectionState !== "CONNECTED") return;

      const now = Date.now();
      const timeSinceLastPing = now - lastPingTime.current;

      if (timeSinceLastPing > 45000) {
        console.warn("WS appears stuck");
        lastPingTime.current = now;
      }

      try {
        // @ts-ignore
        client.getRTCStats?.();
      } catch (e) {
        console.warn("Health check failed:", e);
      }

      lastPingTime.current = now;
      await refreshTokenIfNeeded();
    }, 15000); // Every 15 seconds
  };

  useEffect(() => {
    if (!channelName || joinInProgress.current || isCleaningUp.current) return;

    const initCall = async () => {
      joinInProgress.current = true;
      await stopTracks();

      const client = AgoraRTC.createClient({
        mode: "rtc",
        codec: "h264",
      });
      clientRef.current = client;
      subscribedUsers.current.clear();

      try {
        // Fetch token WITH duration parameter
        const tokenRes = await fetch(
          `${API_BASE}/api/agora/token?channelName=${channelName}&durationMin=${durationMin}`
        );
        const tokenData = await tokenRes.json();
        if (!tokenData.success) throw new Error("Failed to get token");

        // Store token with expiry time
        const now = Date.now();
        tokenRef.current = { token: tokenData.token, expireTime: now + 24 * 60 * 60 * 1000 };

        // Join channel
        await client.join(tokenData.appId, channelName, tokenData.token, tokenData.uid);
        console.log("Joined channel successfully");

        // Network monitoring
        client.on("network-quality", (stats) => {
          const worst = Math.max(stats.uplinkNetworkQuality, stats.downlinkNetworkQuality);
          if (worst <= 2) setNetworkQuality("good");
          else if (worst <= 4) setNetworkQuality("poor");
          else setNetworkQuality("bad");

          // Auto-switch to low stream on poor network
          if (worst > 3) {
            remoteUsers.forEach(async (user) => {
              try {
                await client.setRemoteVideoStreamType(user.uid, 1);
              } catch {}
            });
          }
        });

        // Enable dual stream AFTER join
        try {
          await client.enableDualStream();
          client.setLowStreamParameter({
            width: 320,
            height: 240,
            framerate: 12,
            bitrate: 150,
          });
        } catch (err) {
          console.warn("Dual stream failed:", err);
        }

        // Create tracks
        let audio: ILocalAudioTrack | null = null;
        let video: ILocalVideoTrack | null = null;

        try {
          audio = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            AGC: true,
            ANS: true,
            encoderConfig: {
              sampleRate: 48000,
              stereo: false,
              bitrate: 64,
            },
          });

          video = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 640,
              height: 480,
              frameRate: 15,
              bitrateMin: 400,
              bitrateMax: 900,
            },
            optimizationMode: "motion",
            facingMode: "user",
          });
        } catch (err) {
          console.error("Track error:", err);
          try {
            if (!audio) {
              audio = await AgoraRTC.createMicrophoneAudioTrack({
                AEC: true,
                AGC: true,
                ANS: true,
              });
            }
            toast({
              title: "Camera unavailable",
              description: "Audio-only mode",
              variant: "destructive",
            });
          } catch {
            throw new Error("No media access");
          }
        }

        localAudioRef.current = audio;
        localVideoRef.current = video;

        if (video) {
          try {
            video.play("local-player");
          } catch (err) {
            console.warn("Local play failed:", err);
          }
        }

        // Publish tracks
        const tracks = [audio, video].filter(Boolean) as any[];
        if (tracks.length > 0) {
          await client.publish(tracks);
          console.log("Published tracks");
        }

        // Remote user handlers - CRITICAL: Wait for connection to be stable
        client.on("user-published", async (user, mediaType) => {
          console.log(`User ${user.uid} published ${mediaType}`);

          // Don't subscribe if already subscribed
          if (subscribedUsers.current.has(user.uid) && mediaType === "video") {
            console.log(`Already subscribed to ${user.uid}`);
            return;
          }

          try {
            // Wait a bit before subscribing to ensure connection is stable
            await new Promise((r) => setTimeout(r, 500));

            // Check connection state before subscribing
            if (client.connectionState !== "CONNECTED") {
              console.warn("Connection not ready for subscription");
              return;
            }

            await client.subscribe(user, mediaType);
            subscribedUsers.current.add(user.uid);

            if (mediaType === "video") {
              try {
                await client.setRemoteVideoStreamType(user.uid, 1);
              } catch {}

              // Clean up old player
              const old = document.getElementById(`player-${user.uid}`);
              if (old) old.remove();

              // Create new player
              const container = document.getElementById("remote-player");
              if (!container) return;

              const div = document.createElement("div");
              div.id = `player-${user.uid}`;
              div.className = "w-full h-full";
              container.appendChild(div);

              // Play with delay
              setTimeout(() => {
                try {
                  user.videoTrack?.play(`player-${user.uid}`);
                  console.log(`Playing video from ${user.uid}`);
                } catch (err) {
                  console.warn("Video play failed:", err);
                  // Retry
                  setTimeout(() => {
                    try {
                      user.videoTrack?.play(`player-${user.uid}`);
                    } catch (e) {
                      toast({
                        title: "Video issue",
                        description: "Remote video may not display",
                        variant: "destructive",
                      });
                    }
                  }, 1000);
                }
              }, 800);
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
            subscribedUsers.current.delete(user.uid);
          }
        });

        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "video") {
            document.getElementById(`player-${user.uid}`)?.remove();
            subscribedUsers.current.delete(user.uid);
          }
        });

        client.on("user-left", (user) => {
          console.log(`User ${user.uid} left`);
          document.getElementById(`player-${user.uid}`)?.remove();
          subscribedUsers.current.delete(user.uid);
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
        });

        client.on("exception", (event) => {
          if (event.code === 1005) {
            console.warn("Decode issue");
          }
        });

        // Connection state handler
        client.on("connection-state-change", (curState, prevState) => {
          console.log(`Connection: ${prevState} -> ${curState}`);

          if (curState === "DISCONNECTED" && prevState !== "DISCONNECTING") {
            toast({
              title: "Disconnected",
              description: "Call ended",
              variant: "destructive",
            });
            setTimeout(() => endCall(false), 2000);
          } else if (curState === "RECONNECTING") {
            toast({ title: "Reconnecting..." });
          } else if (curState === "CONNECTED" && prevState === "RECONNECTING") {
            toast({ title: "Reconnected" });
          }
        });

        // Notify backend
        socket?.emit("call:start", {
          channelName,
          userId: localStorage.getItem("userId"),
        });

        startWebSocketHealth();

        // Start timer
        startTime.current = Date.now();
        timerRef.current = setInterval(() => {
          setDurationSec(Math.floor((Date.now() - startTime.current) / 1000));
        }, 1000);
        setJoined(true);
        setCallAccepted(true);

        // Auto-end timer - CRITICAL: Only if duration is set
        if (durationMin > 0) {
          callLimitTimeoutRef.current = setTimeout(() => {
            toast({ title: "Time's up" });
            endCall(false);
          }, durationMin * 60 * 1000);
        }
      } catch (err: any) {
        console.error("Init error:", err);
        toast({
          title: "Call Failed",
          description: err.message || "Could not connect",
          variant: "destructive",
        });
        navigate("/dashboard");
      } finally {
        joinInProgress.current = false;
      }
    };

    initCall();

    const handleCallEnded = (payload: any) => {
      if (payload.channelName === channelName) {
        console.log("Received call:ended from server");
        endCall(true);
      }
    };
    socket?.on("call:ended", handleCallEnded);

    return () => {
      socket?.off("call:ended", handleCallEnded);
      if (timerRef.current) clearInterval(timerRef.current);
      if (callLimitTimeoutRef.current) clearTimeout(callLimitTimeoutRef.current);
      if (wsHealthInterval.current) clearInterval(wsHealthInterval.current);
      endCall(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  const toggleMic = async () => {
    const audio = localAudioRef.current;
    if (!audio) return;
    try {
      const newState = !isMicOn;
      await audio.setEnabled(newState);
      setIsMicOn(newState);
    } catch (err) {
      console.error("Mic toggle:", err);
    }
  };

  const toggleCamera = async () => {
    const video = localVideoRef.current;
    if (!video) return;
    try {
      const newState = !isCamOn;
      await video.setEnabled(newState);
      setIsCamOn(newState);
    } catch (err) {
      console.error("Camera toggle:", err);
    }
  };

  const swapViews = () => {
    const newSwapped = !isSwapped;
    setIsSwapped(newSwapped);

    setTimeout(() => {
      if (localVideoRef.current) {
        try {
          localVideoRef.current.stop();
          setTimeout(() => {
            localVideoRef.current?.play(newSwapped ? "remote-player" : "local-player");
          }, 100);
        } catch {}
      }

      remoteUsers.forEach((user) => {
        if (user.videoTrack) {
          try {
            user.videoTrack.stop();
            setTimeout(() => {
              const containerId = newSwapped ? "local-player" : `player-${user.uid}`;
              user.videoTrack?.play(containerId);
            }, 100);
          } catch {}
        }
      });
    }, 200);
  };

  const endCall = async (silent = false) => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callLimitTimeoutRef.current) clearTimeout(callLimitTimeoutRef.current);
      if (wsHealthInterval.current) clearInterval(wsHealthInterval.current);

      const client = clientRef.current;
      if (client) {
        try {
          await client.leave();
        } catch {}
        client.removeAllListeners();
        clientRef.current = null;
      }

      await stopTracks();
      setJoined(false);
      setRemoteUsers([]);
      setCallAccepted(false);
      subscribedUsers.current.clear();

      socket?.emit("call:end", { channelName, durationSec });

      if (!silent) {
        toast({ title: "Call ended" });
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("End call error:", err);
    } finally {
      isCleaningUp.current = false;
    }
  };

  const format = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getNetworkIcon = () => {
    if (networkQuality === "good") return <Wifi className="w-4 h-4 text-green-500" />;
    if (networkQuality === "poor") return <Wifi className="w-4 h-4 text-yellow-500" />;
    return <Wifi className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden">
      <div className="flex-1 relative bg-black">
        <div id={isSwapped ? "local-player" : "remote-player"} className="w-full h-full flex items-center justify-center">
          {!isSwapped && remoteUsers.length === 0 && (
            <div className="text-center">
              <div className="text-gray-400 text-lg mb-2 animate-pulse">Waiting for other person...</div>
              <div className="text-gray-500 text-sm">{joined ? "Connected" : "Connecting..."}</div>
            </div>
          )}
        </div>

        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{format(durationSec)}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full" title={`Network: ${networkQuality}`}>
              {getNetworkIcon()}
            </div>
          </div>
        </div>

        <div className="absolute top-20 right-4 w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-44 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          <div id={isSwapped ? "remote-player" : "local-player"} className="w-full h-full">
            {!joined && !isSwapped && (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">Connecting...</div>
            )}
          </div>

          <button
            onClick={swapViews}
            className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 p-1.5 rounded-full transition-all active:scale-95"
          >
            <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>

          <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs">{isSwapped ? "Remote" : "You"}</div>
        </div>
      </div>

      <div className="bg-gray-800 border-t border-gray-700 p-4 pb-6">
        <div className="flex justify-center items-center gap-3 sm:gap-4 max-w-md mx-auto">
          <button
            onClick={toggleMic}
            className={`p-3 sm:p-4 rounded-full transition-all active:scale-95 ${
              isMicOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isMicOn ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <button
            onClick={toggleCamera}
            className={`p-3 sm:p-4 rounded-full transition-all active:scale-95 ${
              isCamOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isCamOn ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <button onClick={() => endCall(false)} className="p-3 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all active:scale-95">
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallRoom;