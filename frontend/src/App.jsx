import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:3000";

function secondsLeft(expiresAt) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function App() {
  const [longUrl, setLongUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!expiresAt) return undefined;

    function tick() {
      setRemaining(secondsLeft(expiresAt));
    }

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setShortUrl("");
    setExpiresAt("");
    setRemaining(0);
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
      setExpiresAt(data.expires_at);
      setRemaining(data.expires_in_seconds ?? secondsLeft(data.expires_at));
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
          Turn long links into clean, shareable short URLs. Each short link
          lasts 1 minute, then it is deleted.
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
                {remaining > 0 ? (
                  <a href={shortUrl} target="_blank" rel="noreferrer">
                    {shortUrl}
                  </a>
                ) : (
                  <span className="expired-url">{shortUrl}</span>
                )}
                <p className={remaining > 0 ? "ttl" : "ttl expired"}>
                  {remaining > 0
                    ? `Expires in ${remaining}s — then this link is removed`
                    : "Expired — this short link has been removed"}
                </p>
              </div>
              <button
                type="button"
                className="copy-btn"
                onClick={handleCopy}
                disabled={remaining <= 0}
              >
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
