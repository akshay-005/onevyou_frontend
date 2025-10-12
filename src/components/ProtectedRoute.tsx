// frontend/src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate } from "react-router-dom";

type Props = {
  children: React.ReactElement;
};

/**
 * Simple protected route: checks for a token in localStorage.
 * It tolerates either "userToken" or "token" (some of your code used both).
 */
const ProtectedRoute = ({ children }: Props) => {
  const token = localStorage.getItem("userToken") || localStorage.getItem("token");
  if (!token) {
    // not authenticated -> go to login
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedRoute;
