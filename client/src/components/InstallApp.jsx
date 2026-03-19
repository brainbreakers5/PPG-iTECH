import { useEffect, useState } from "react";

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAiOpen, setIsAiOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const aiStatusHandler = (e) => {
      // Instantly update visibility based on AI status
      setIsAiOpen(e.detail.open);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("AI_STATUS", aiStatusHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("AI_STATUS", aiStatusHandler);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      console.log("App installed");
    }

    setDeferredPrompt(null);
  };

  // Hide button if AI is active OR if no install prompt
  if (!deferredPrompt || isAiOpen) return null;

  return (
    <button
      onClick={installApp}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        padding: "12px 18px",
        background: "#0ea5e9",
        color: "white",
        border: "none",
        borderRadius: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        zIndex: 9999
      }}
    >
      Install App 📱
    </button>
  );
};

export default InstallApp;
