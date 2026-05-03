export default function Slide2Problem() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#1a1e2e]">
      <div
        className="absolute top-0 right-0 w-[38vw] h-full"
        style={{
          background:
            "linear-gradient(to left, rgba(45,106,79,0.08) 0%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[9vw]">
        <p
          className="font-body text-[#2d6a4f] font-bold tracking-[0.28em] uppercase"
          style={{ fontSize: "1vw", marginBottom: "2.5vh" }}
        >
          The Problem
        </p>

        <h2
          className="font-display text-white tracking-tight leading-[1.0]"
          style={{
            fontSize: "5.5vw",
            maxWidth: "58vw",
            textWrap: "balance",
            marginBottom: "5vh",
          }}
        >
          Shared life runs on spreadsheets and group chats.
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "2.2vh" }}>
          <div className="flex items-start gap-[1.8vw]">
            <span
              className="font-body text-[#2d6a4f] font-bold flex-shrink-0"
              style={{ fontSize: "1.5vw", marginTop: "0.1vh" }}
            >
              01
            </span>
            <p
              className="font-body text-white/65 font-normal"
              style={{ fontSize: "1.65vw", lineHeight: "1.5" }}
            >
              Bills get missed, costs go untracked, and disputes turn awkward.
            </p>
          </div>
          <div className="flex items-start gap-[1.8vw]">
            <span
              className="font-body text-[#2d6a4f] font-bold flex-shrink-0"
              style={{ fontSize: "1.5vw", marginTop: "0.1vh" }}
            >
              02
            </span>
            <p
              className="font-body text-white/65 font-normal"
              style={{ fontSize: "1.65vw", lineHeight: "1.5" }}
            >
              Responsibilities fall through the cracks with no single source of truth.
            </p>
          </div>
          <div className="flex items-start gap-[1.8vw]">
            <span
              className="font-body text-[#2d6a4f] font-bold flex-shrink-0"
              style={{ fontSize: "1.5vw", marginTop: "0.1vh" }}
            >
              03
            </span>
            <p
              className="font-body text-white/65 font-normal"
              style={{ fontSize: "1.65vw", lineHeight: "1.5" }}
            >
              Whether it's a home, studio, or group trip — every shared context needs its own system.
            </p>
          </div>
        </div>
      </div>

      <div
        className="absolute right-[6vw] bottom-[5vh] font-body text-white/15 font-medium tracking-[0.15em]"
        style={{ fontSize: "1vw" }}
      >
        02
      </div>
    </div>
  );
}
