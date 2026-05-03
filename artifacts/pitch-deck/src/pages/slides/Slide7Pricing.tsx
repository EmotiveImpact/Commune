export default function Slide7Pricing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#f5f3ef]">
      <div
        className="absolute top-0 left-0 w-[0.5vw] h-full bg-[#2d6a4f]"
      />

      <div
        className="absolute inset-0 flex flex-col"
        style={{ padding: "7vh 7vw 7vh 8vw" }}
      >
        <div style={{ marginBottom: "4.5vh" }}>
          <p
            className="font-body text-[#2d6a4f] font-bold tracking-[0.28em] uppercase"
            style={{ fontSize: "1vw", marginBottom: "1.5vh" }}
          >
            Membership
          </p>
          <h2
            className="font-display text-[#1a1e2e] tracking-tight leading-[1.0]"
            style={{ fontSize: "4.2vw", marginBottom: "1.2vh" }}
          >
            Simple, transparent pricing.
          </h2>
          <p
            className="font-body text-[#888880]"
            style={{ fontSize: "1.5vw" }}
          >
            7-day free trial on your first space. No card required.
          </p>
        </div>

        <div
          className="flex"
          style={{ gap: "1.8vw", flex: 1 }}
        >
          <div
            className="flex flex-col rounded-[1vw]"
            style={{
              flex: 1,
              background: "#fff",
              border: "1px solid #e8e5e0",
              padding: "3.5vh 2.5vw",
            }}
          >
            <p
              className="font-body text-[#888880] font-bold tracking-[0.2em] uppercase"
              style={{ fontSize: "0.85vw", marginBottom: "2vh" }}
            >
              Standard
            </p>
            <div
              className="flex items-baseline"
              style={{ gap: "0.3vw", marginBottom: "2.5vh" }}
            >
              <span
                className="font-display text-[#1a1e2e] tracking-tight"
                style={{ fontSize: "4.5vw" }}
              >
                £4.99
              </span>
              <span
                className="font-body text-[#888880]"
                style={{ fontSize: "1.3vw" }}
              >
                /mo
              </span>
            </div>
            <div
              style={{
                borderTop: "1px solid #e8e5e0",
                paddingTop: "2.5vh",
                display: "flex",
                flexDirection: "column",
                gap: "1.4vh",
              }}
            >
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>1 space</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Up to 8 members</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Communal finance &amp; splits</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Responsibilities &amp; reminders</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Monthly breakdown</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Group hub</p>
            </div>
          </div>

          <div
            className="flex flex-col rounded-[1vw] relative"
            style={{
              flex: 1,
              background: "#1a1e2e",
              padding: "3.5vh 2.5vw",
            }}
          >
            <div
              className="absolute top-[-1.5vh] left-1/2 -translate-x-1/2 bg-white text-[#1a1e2e] font-body font-bold tracking-[0.16em] uppercase rounded-full"
              style={{ fontSize: "0.75vw", padding: "0.5vh 1.2vw", whiteSpace: "nowrap" }}
            >
              Most popular
            </div>
            <p
              className="font-body text-white/30 font-bold tracking-[0.2em] uppercase"
              style={{ fontSize: "0.85vw", marginBottom: "2vh" }}
            >
              Pro
            </p>
            <div
              className="flex items-baseline"
              style={{ gap: "0.3vw", marginBottom: "2.5vh" }}
            >
              <span
                className="font-display text-white tracking-tight"
                style={{ fontSize: "4.5vw" }}
              >
                £9.99
              </span>
              <span
                className="font-body text-white/30"
                style={{ fontSize: "1.3vw" }}
              >
                /mo
              </span>
            </div>
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: "2.5vh",
                display: "flex",
                flexDirection: "column",
                gap: "1.4vh",
              }}
            >
              <p className="font-body text-white/45" style={{ fontSize: "1.45vw" }}>Up to 3 spaces</p>
              <p className="font-body text-white/45" style={{ fontSize: "1.45vw" }}>Up to 15 members</p>
              <p className="font-body text-white/45" style={{ fontSize: "1.45vw" }}>Everything in Standard</p>
              <p className="font-body text-white/45" style={{ fontSize: "1.45vw" }}>Advanced analytics</p>
              <p className="font-body text-white/45" style={{ fontSize: "1.45vw" }}>Exports &amp; templates</p>
              <p className="font-body text-white/45" style={{ fontSize: "1.45vw" }}>Priority support</p>
            </div>
          </div>

          <div
            className="flex flex-col rounded-[1vw]"
            style={{
              flex: 1,
              background: "#fff",
              border: "1px solid #e8e5e0",
              padding: "3.5vh 2.5vw",
            }}
          >
            <p
              className="font-body text-[#888880] font-bold tracking-[0.2em] uppercase"
              style={{ fontSize: "0.85vw", marginBottom: "2vh" }}
            >
              Agency
            </p>
            <div
              className="flex items-baseline"
              style={{ gap: "0.3vw", marginBottom: "2.5vh" }}
            >
              <span
                className="font-display text-[#1a1e2e] tracking-tight"
                style={{ fontSize: "4.5vw" }}
              >
                £29.99
              </span>
              <span
                className="font-body text-[#888880]"
                style={{ fontSize: "1.3vw" }}
              >
                /mo
              </span>
            </div>
            <div
              style={{
                borderTop: "1px solid #e8e5e0",
                paddingTop: "2.5vh",
                display: "flex",
                flexDirection: "column",
                gap: "1.4vh",
              }}
            >
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Unlimited spaces</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Unlimited members</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Everything in Pro</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Priority workflows</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Dedicated onboarding</p>
              <p className="font-body text-[#888880]" style={{ fontSize: "1.45vw" }}>Operator-ready path</p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute right-[6vw] bottom-[3vh] font-body text-[#1a1e2e]/20 font-medium tracking-[0.15em]"
        style={{ fontSize: "1vw" }}
      >
        07
      </div>
    </div>
  );
}
