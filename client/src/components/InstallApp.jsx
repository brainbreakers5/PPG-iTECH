import { useEffect, useState } from "react";

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
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

  if (!deferredPrompt) return null;

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
