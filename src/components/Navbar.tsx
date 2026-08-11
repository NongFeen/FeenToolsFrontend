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
          className={
            pathname.startsWith("/tools/taptitan") &&
            !pathname.startsWith("/tools/taptitan/admin") &&
            !pathname.startsWith("/tools/taptitan/debug")
              ? "active"
              : ""
          }
        >
          Recommendations
        </Link>
        <Link
          to="/tools/taptitan/debug"
          className={pathname.startsWith("/tools/taptitan/debug") ? "active" : ""}
        >
          Sim Debug
        </Link>
        <Link
          to="/tools/taptitan/admin"
          className={pathname.startsWith("/tools/taptitan/admin") ? "active" : ""}
        >
          Admin
        </Link>
      </div>
    </nav>
  );
}
