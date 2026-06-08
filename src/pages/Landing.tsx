import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Landing() {
  return (
    <div className="page">
      <Navbar />

      <section className="cta">
        <h2>Feen</h2>
        <Link to="/tools/taptitan" className="btn-primary">
          Taptitan 2 Tools
        </Link>
      </section>

      <footer className="footer">
        <span>Feen</span>
      </footer>
    </div>
  );
}
