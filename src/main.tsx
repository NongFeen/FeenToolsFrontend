import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/styles.css";
import Landing from "./pages/Landing";
import TapTitan from "./pages/TapTitan";
import PlayerRecommendations from "./pages/PlayerRecommendations";
import TapTitanAdmin from "./pages/TapTitanAdmin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tools/taptitan" element={<TapTitan />} />
        <Route
          path="/tools/taptitan/players/:playerId"
          element={<PlayerRecommendations />}
        />
        <Route path="/tools/taptitan/admin" element={<TapTitanAdmin />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
  
);
