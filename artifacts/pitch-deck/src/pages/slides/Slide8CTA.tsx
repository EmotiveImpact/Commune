const base = import.meta.env.BASE_URL;

export default function Slide8CTA() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0d1117]">
      <img
        src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1920&q=85&auto=format&fit=crop"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(10,14,30,0.88) 0%, rgba(26,30,46,0.70) 50%, rgba(45,106,79,0.35) 100%)",
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

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p
          className="font-body text-[#2d6a4f] font-bold tracking-[0.28em] uppercase"
          style={{ fontSize: "1.1vw", marginBottom: "3vh" }}
        >
          Get Started
        </p>
        <h2
          className="font-display text-white tracking-tight leading-[0.93]"
          style={{ fontSize: "8.5vw", textWrap: "balance", marginBottom: "3.5vh" }}
        >
          Start your space.
        </h2>
        <p
          className="font-body text-white/55 font-normal"
          style={{ fontSize: "1.7vw", marginBottom: "4.5vh" }}
        >
          7-day free trial. No card required. Takes under a minute.
        </p>
        <p
          className="font-body text-white/80 font-medium tracking-[0.06em]"
          style={{
            fontSize: "1.5vw",
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.22)",
            padding: "1.2vh 2.4vw",
            borderRadius: "999px",
          }}
        >
          app.ourcommune.io
        </p>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <p
          className="font-body text-white/25"
          style={{ fontSize: "1.1vw" }}
        >
          support@ourcommune.io
        </p>
        <p
          className="font-body text-white/25"
          style={{ fontSize: "1.1vw" }}
        >
          &copy; 2026 Commune. All rights reserved.
        </p>
      </div>
    </div>
  );
}
