import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/styles.css";
import Landing from "./pages/Landing";
import TapTitan from "./pages/TapTitan";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tools/taptitan" element={<TapTitan />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
  
);
