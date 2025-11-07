import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { storeUserSession } from "@/utils/storage";

const AuthSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      navigate("/login");
      return;
    }

    // Save token immediately
    localStorage.setItem("userToken", token);

    // ✅ Fetch user info using the token
    const fetchUser = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "https://onevyou.onrender.com"}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (res.ok && data.success) {
          // ✅ Save full user session
      storeUserSession(data.user, token);

      // ✅ Always reset online state after login (Google or others)
      localStorage.setItem("isOnline", "false");
      console.log("🧊 User logged in — starting offline");


          // ✅ Decide where to go
          if (data.user.profileCompleted) {
            navigate("/dashboard");
          } else {
            navigate("/profile-setup");
          }
        } else {
          console.warn("Failed to fetch user info:", data.message);
          navigate("/dashboard");
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
        navigate("/dashboard");
      }
    };

    fetchUser();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-center text-lg font-medium">
      Signing you in securely...
    </div>
  );
};

export default AuthSuccess;
