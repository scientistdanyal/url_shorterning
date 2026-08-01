import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:3000";

function App() {
  const [longUrl, setLongUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setShortUrl("");
    setCopied(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ long_url: longUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to shorten URL");
      }

      setShortUrl(data.short_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <h1 className="brand">
          Short<span>mark</span>
        </h1>
        <p className="tagline">
          Turn long links into clean, shareable short URLs in one step.
        </p>

        <section className="panel">
          <form className="form" onSubmit={handleSubmit}>
            <input
              type="url"
              placeholder="Paste a long URL"
              value={longUrl}
              onChange={(e) => setLongUrl(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Shortening..." : "Shorten"}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          {shortUrl && (
            <div className="result">
              <div>
                <span className="result-label">Your short link</span>
                <a href={shortUrl} target="_blank" rel="noreferrer">
                  {shortUrl}
                </a>
              </div>
              <button type="button" className="copy-btn" onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
