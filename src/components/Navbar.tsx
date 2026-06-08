import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <span className="nav-logo-mark">F</span>
        Feen
      </Link>
      <div className="nav-links">
        <Link to="/" className={pathname === "/" ? "active" : ""}>
          Home
        </Link>
        <Link
          to="/tools/taptitan"
          className={pathname.startsWith("/tools") ? "active" : ""}
        >
          TaptitanTools
        </Link>
      </div>
    </nav>
  );
}
