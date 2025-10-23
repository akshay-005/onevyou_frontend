// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import ProfileSetup from "./pages/ProfileSetup";
import UnifiedDashboard from "./pages/UnifiedDashboard";
import CallRoom from "./pages/CallRoom";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import HelpSupport from "./pages/HelpSupport";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

// ✅ Import this
import { SocketProvider } from "@/utils/socket";
import "./utils/debugHelper";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
          {/* ✅ Wrap the entire app inside SocketProvider */}
          <SocketProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Login />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/help" element={<HelpSupport />} />
              <Route path="/call/:channelName" element={<CallRoom />} />

              <Route
                path="/profile-setup"
                element={
                  <ProtectedRoute>
                    <ProfileSetup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <UnifiedDashboard />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </SocketProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
