import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WalletProvider from "@/components/providers/WalletProvider";
import XmtpProvider from "@/components/providers/XmtpProvider";
import LandingPage from "@/pages/LandingPage";
import ChatLayout from "@/pages/ChatLayout";
import ChatPage from "@/pages/ChatPage";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import "@/index.css";

// Apply dark mode immediately (before React renders) to prevent flash
const darkPref = localStorage.getItem("clam-chat-dark-mode");
if (darkPref === "true" || (darkPref === null && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

// One-time migration: hollachat → clam-chat localStorage keys
for (const [oldKey, newKey] of [
  ["hollachat-dark-mode", "clam-chat-dark-mode"],
  ["hollachat-private-key", "clam-chat-private-key"],
  ["hollachat-network", "clam-chat-network"],
] as const) {
  const v = localStorage.getItem(oldKey);
  if (v !== null) {
    localStorage.setItem(newKey, v);
    localStorage.removeItem(oldKey);
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <XmtpProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/chat" element={<ChatLayout />}>
                <Route index element={<ChatPage />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </XmtpProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
