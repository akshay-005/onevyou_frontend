import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { storeUserSession } from "@/utils/storage";

const AuthSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("token", token);
      // optional: fetch user info using token
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return <div className="text-center mt-10">Signing you in...</div>;
};

export default AuthSuccess;
