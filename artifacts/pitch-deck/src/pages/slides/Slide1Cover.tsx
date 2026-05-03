const base = import.meta.env.BASE_URL;

export default function Slide1Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0d1117]">
      <img
        src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1920&q=85&auto=format&fit=crop"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,14,30,0.92) 0%, rgba(10,14,30,0.60) 45%, rgba(10,14,30,0.30) 100%)",
        }}
      />

      <div className="absolute top-[5.5vh] left-[6vw] flex items-center gap-[0.7vw]">
        <img
          src={`${base}logo.png`}
          crossOrigin="anonymous"
          alt="Commune"
          className="rounded-[0.4vw] object-cover"
          style={{ width: "2vw", height: "2vw" }}
        />
        <span
          className="font-body text-white font-bold tracking-[0.18em]"
          style={{ fontSize: "0.85vw" }}
        >
          COMMUNE
        </span>
      </div>

      <div className="absolute bottom-[11vh] left-[6vw]">
        <p
          className="font-body text-white/45 font-medium tracking-[0.24em] uppercase"
          style={{ fontSize: "1.1vw", marginBottom: "2.5vh" }}
        >
          Pitch Deck &middot; 2026
        </p>
        <h1
          className="font-display text-white tracking-tight leading-[0.93]"
          style={{ fontSize: "8vw", textWrap: "balance" }}
        >
          Live Clearly,
        </h1>
        <h1
          className="font-display text-white tracking-tight leading-[0.93]"
          style={{ fontSize: "8vw", marginBottom: "3.5vh" }}
        >
          Together.
        </h1>
        <p
          className="font-body text-white/60 font-light"
          style={{ fontSize: "1.65vw", maxWidth: "42vw", lineHeight: "1.55" }}
        >
          Shared money and shared spaces, managed in one place.
        </p>
      </div>

      <div className="absolute bottom-[5vh] right-[6vw]">
        <p
          className="font-body text-white/30 font-medium tracking-[0.08em]"
          style={{ fontSize: "1.1vw" }}
        >
          app.ourcommune.io
        </p>
      </div>
    </div>
  );
}
