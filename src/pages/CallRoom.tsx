// frontend/src/pages/CallRoom.tsx - PERMANENT FIX
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
  const joinInProgress = useRef(false);
  const isCleaningUp = useRef(false);
  const componentMounted = useRef(true); // Track if component is still mounted
  const wsHealthInterval = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<{ token: string; expiresAt: number } | null>(null);
  const subscriptionRef = useRef<Map<number, { audio?: boolean; video?: boolean }>>(new Map());

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const [joined, setJoined] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<"good" | "poor" | "bad">("good");
  const [isSwapped, setIsSwapped] = useState(false);

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
      console.warn("Track cleanup:", err);
    }
  };

  const refreshTokenIfNeeded = async () => {
    try {
      if (!tokenRef.current || !componentMounted.current) return;
      const now = Date.now();
      const timeUntilExpiry = tokenRef.current.expiresAt - now;

      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log("Refreshing token...");
        const res = await fetch(
          `${API_BASE}/api/agora/renew?channelName=${channelName}&durationMin=${durationMin}`,
          { method: "POST" }
        );
        const data = await res.json();
        if (data.success && componentMounted.current) {
          tokenRef.current = { token: data.token, expiresAt: data.expiresAt };
          const client = clientRef.current;
          if (client && client.connectionState === "CONNECTED") {
            await client.renewToken(data.token);
            console.log("✅ Token renewed");
          }
        }
      }
    } catch (err) {
      console.error("Token refresh error:", err);
    }
  };

  const startWebSocketHealth = () => {
    if (wsHealthInterval.current) clearInterval(wsHealthInterval.current);

    wsHealthInterval.current = setInterval(async () => {
      if (!componentMounted.current) return;
      const client = clientRef.current;
      if (!client || client.connectionState !== "CONNECTED") return;

      try {
        // @ts-ignore
        client.getRTCStats?.();
      } catch (e) {
        console.warn("Health check failed:", e);
      }

      await refreshTokenIfNeeded();
    }, 10000);
  };

  useEffect(() => {
    componentMounted.current = true;

    if (!channelName || joinInProgress.current || isCleaningUp.current) return;

    const initCall = async () => {
      joinInProgress.current = true;
      await stopTracks();
      subscriptionRef.current.clear();

      const client = AgoraRTC.createClient({
        mode: "rtc",
        codec: "h264",
      });
      clientRef.current = client;

      try {
        const tokenRes = await fetch(
          `${API_BASE}/api/agora/token?channelName=${channelName}&durationMin=${durationMin}`
        );
        const tokenData = await tokenRes.json();
        if (!tokenData.success) throw new Error("Failed to get token");

        tokenRef.current = { token: tokenData.token, expiresAt: tokenData.expiresAt };

        await client.join(tokenData.appId, channelName, tokenData.token, tokenData.uid);
        console.log("✅ Joined channel");

        // Subscribe to already present users
        if (client.remoteUsers && client.remoteUsers.length > 0) {
          console.log("Found existing users:", client.remoteUsers.map(u => u.uid));
          for (const user of client.remoteUsers) {
            try {
              if (user.hasAudio) {
                await client.subscribe(user, "audio");
                user.audioTrack?.play();
                console.log(`✅ Subscribed to existing audio from ${user.uid}`);
              }
              if (user.hasVideo) {
                await client.subscribe(user, "video");
                const container = document.getElementById("remote-player");
                if (container) {
                  const div = document.createElement("div");
                  div.id = `player-${user.uid}`;
                  div.className = "w-full h-full";
                  container.appendChild(div);
                  setTimeout(() => user.videoTrack?.play(`player-${user.uid}`), 300);
                }
                console.log(`✅ Subscribed to existing video from ${user.uid}`);
              }
              setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
            } catch (err) {
              console.warn("Auto-subscribe failed:", err);
            }
          }
        }

        client.on("network-quality", (stats) => {
          if (!componentMounted.current) return;
          const worst = Math.max(stats.uplinkNetworkQuality, stats.downlinkNetworkQuality);
          if (worst <= 2) setNetworkQuality("good");
          else if (worst <= 4) setNetworkQuality("poor");
          else setNetworkQuality("bad");
        });

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
        }

        localAudioRef.current = audio;
        localVideoRef.current = video;

        if (video) {
          try {
            const playPromise = video.play("local-player");
            if (playPromise && playPromise.catch) {
              playPromise.catch(e => console.warn("Local play failed:", e));
            }
          } catch (e) {
            console.warn("Local play failed:", e);
          }
        }

        const tracks = [audio, video].filter(Boolean) as any[];
        if (tracks.length > 0) {
          await client.publish(tracks);
          console.log("✅ Published tracks");
        }

        client.on("user-published", async (user, mediaType) => {
          if (!componentMounted.current) return;
          console.log(`📥 User ${user.uid} published ${mediaType}`);

          try {
            const subState = subscriptionRef.current.get(user.uid) || {};

            if ((mediaType === "video" && subState.video) || (mediaType === "audio" && subState.audio)) {
              console.log(`Already subscribed to ${mediaType} from ${user.uid}`);
              return;
            }

            await new Promise(r => setTimeout(r, 300));

            if (client.connectionState !== "CONNECTED") {
              console.warn("Connection not ready");
              return;
            }

            await client.subscribe(user, mediaType);
            console.log(`✅ Subscribed to ${mediaType} from ${user.uid}`);

            subState[mediaType === "video" ? "video" : "audio"] = true;
            subscriptionRef.current.set(user.uid, subState);

            if (mediaType === "video") {
              const old = document.getElementById(`player-${user.uid}`);
              if (old) old.remove();

              const container = document.getElementById("remote-player");
              if (!container) return;

              const div = document.createElement("div");
              div.id = `player-${user.uid}`;
              div.className = "w-full h-full";
              container.appendChild(div);

              setTimeout(() => {
                user.videoTrack?.play(`player-${user.uid}`).catch(e => console.warn("Video play failed:", e));
              }, 500);
            }

            if (mediaType === "audio") {
              user.audioTrack?.play().catch(e => console.warn("Audio play failed:", e));
            }

            if (componentMounted.current) {
              setRemoteUsers(prev => {
                const filtered = prev.filter(u => u.uid !== user.uid);
                return [...filtered, user];
              });
            }
          } catch (err) {
            console.error("Subscribe error:", err);
          }
        });

        client.on("user-unpublished", (user, mediaType) => {
          console.log(`User ${user.uid} unpublished ${mediaType}`);
          if (mediaType === "video") {
            document.getElementById(`player-${user.uid}`)?.remove();
            const subState = subscriptionRef.current.get(user.uid) || {};
            subState.video = false;
            subscriptionRef.current.set(user.uid, subState);
          }
        });

        client.on("user-left", (user) => {
          console.log(`User ${user.uid} left`);
          document.getElementById(`player-${user.uid}`)?.remove();
          subscriptionRef.current.delete(user.uid);
          if (componentMounted.current) {
            setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
          }
        });

        client.on("connection-state-change", (curState, prevState) => {
          console.log(`Connection: ${prevState} → ${curState}`);

          if (curState === "DISCONNECTED" && prevState !== "DISCONNECTING" && componentMounted.current) {
            toast({
              title: "Disconnected",
              description: "Call ended",
              variant: "destructive",
            });
            endCall(false);
          }
        });

        socket?.emit("call:start", {
          channelName,
          userId: localStorage.getItem("userId"),
        });

        startWebSocketHealth();

        startTime.current = Date.now();
        timerRef.current = setInterval(() => {
          if (!componentMounted.current) return;
          const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
          setDurationSec(elapsed);
        }, 1000);
        
        if (componentMounted.current) {
          setJoined(true);
        }

        if (durationMin > 0) {
          callLimitTimeoutRef.current = setTimeout(() => {
            if (componentMounted.current) {
              console.log("⏰ Time limit reached");
              endCall(false);
            }
          }, durationMin * 60 * 1000);
        }
      } catch (err: any) {
        console.error("Init error:", err);
        if (componentMounted.current) {
          toast({
            title: "Call Failed",
            description: err.message || "Could not connect",
            variant: "destructive",
          });
          navigate("/dashboard");
        }
      } finally {
        joinInProgress.current = false;
      }
    };

    initCall();

    const handleCallEnded = () => {
      if (componentMounted.current) {
        console.log("Call ended from server");
        endCall(true);
      }
    };
    socket?.on("call:ended", handleCallEnded);

    // 🔥 CRITICAL: Only cleanup timers, NOT the call itself
    return () => {
      componentMounted.current = false;
      socket?.off("call:ended", handleCallEnded);
      if (timerRef.current) clearInterval(timerRef.current);
      if (callLimitTimeoutRef.current) clearTimeout(callLimitTimeoutRef.current);
      if (wsHealthInterval.current) clearInterval(wsHealthInterval.current);
      // DO NOT call endCall() here - it will be called by user action or server event
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  // Separate cleanup effect for when user navigates away
  useEffect(() => {
    const handleBeforeUnload = () => {
      endCall(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Only end call when component is actually being unmounted (user left page)
      if (!componentMounted.current) {
        endCall(true);
      }
    };
  }, []);

  const toggleMic = async () => {
    const audio = localAudioRef.current;
    if (!audio) return;
    try {
      await audio.setEnabled(!isMicOn);
      setIsMicOn(!isMicOn);
    } catch (err) {
      console.error("Mic toggle:", err);
    }
  };

  const toggleCamera = async () => {
    const video = localVideoRef.current;
    if (!video) return;
    try {
      await video.setEnabled(!isCamOn);
      setIsCamOn(!isCamOn);
    } catch (err) {
      console.error("Camera toggle:", err);
    }
  };

  const swapViews = () => {
    setIsSwapped(!isSwapped);
  };

  const endCall = async (silent = false) => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;
    componentMounted.current = false;

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
      subscriptionRef.current.clear();

      const elapsedSec = Math.floor((Date.now() - (startTime.current || Date.now())) / 1000);
      socket?.emit("call:end", { channelName, durationSec: elapsedSec });

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
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
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
        <div
          id={isSwapped ? "local-player" : "remote-player"}
          className="w-full h-full flex items-center justify-center"
        >
          {!isSwapped && remoteUsers.length === 0 && (
            <div className="text-center">
              <div className="text-gray-400 text-lg mb-2 animate-pulse">
                Waiting for other person...
              </div>
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
            <div
              className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full"
              title={`Network: ${networkQuality}`}
            >
              {getNetworkIcon()}
            </div>
          </div>
        </div>

        <div className="absolute top-20 right-4 w-24 h-32 sm:w-28 sm:h-36 md:w-32 md:h-44 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
          <div id={isSwapped ? "remote-player" : "local-player"} className="w-full h-full">
            {!joined && !isSwapped && (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                Connecting...
              </div>
            )}
          </div>

          <button
            onClick={swapViews}
            className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 p-1.5 rounded-full transition-all active:scale-95"
          >
            <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>

          <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-xs">
            {isSwapped ? "Remote" : "You"}
          </div>
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
            {isMicOn ? (
              <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>

          <button
            onClick={toggleCamera}
            className={`p-3 sm:p-4 rounded-full transition-all active:scale-95 ${
              isCamOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isCamOn ? (
              <Video className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>

          <button
            onClick={() => endCall(false)}
            className="p-3 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all active:scale-95"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallRoom;