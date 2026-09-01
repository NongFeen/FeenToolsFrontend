import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/styles.css";
import "./styles/live-widgets-stack.css";
import Landing from "./pages/Landing";
import TapTitan from "./pages/TapTitan";
import PlayerRecommendations from "./pages/PlayerRecommendations";
import LiveBossWidget from "./components/LiveBossWidget";
import LiveAttackingPlayersWidget from "./components/LiveAttackingPlayersWidget";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <div className="live-widgets-stack">
        <LiveBossWidget />
        <LiveAttackingPlayersWidget />
      </div>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tools/taptitan" element={<TapTitan />} />
        <Route
          path="/tools/taptitan/players/:playerId"
          element={<PlayerRecommendations />}
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
  
);
