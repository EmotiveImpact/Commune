export default function Slide4Features() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#1a1e2e]">
      <div
        className="absolute bottom-0 right-0 w-[40vw] h-[40vh] rounded-tl-[50%]"
        style={{ background: "rgba(45,106,79,0.06)" }}
      />

      <div
        className="absolute inset-0 flex flex-col"
        style={{ padding: "7vh 8vw 6vh 8vw" }}
      >
        <div style={{ marginBottom: "4vh" }}>
          <p
            className="font-body text-[#2d6a4f] font-bold tracking-[0.28em] uppercase"
            style={{ fontSize: "1vw", marginBottom: "1.5vh" }}
          >
            Core Features
          </p>
          <h2
            className="font-display text-white tracking-tight leading-[1.0]"
            style={{ fontSize: "4.2vw" }}
          >
            Four pillars of a well-run shared space.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2vh 3vw",
            flex: 1,
          }}
        >
          <div
            className="rounded-[0.8vw]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "3vh 2.5vw",
            }}
          >
            <p
              className="font-body text-[#2d6a4f] font-bold tracking-[0.2em]"
              style={{ fontSize: "0.85vw", marginBottom: "1.5vh" }}
            >
              01
            </p>
            <p
              className="font-display text-white leading-[1.1]"
              style={{ fontSize: "2vw", marginBottom: "1.2vh" }}
            >
              Communal Finance
            </p>
            <p
              className="font-body text-white/45 font-normal"
              style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
            >
              Track recurring bills, split costs fairly, and automate reimbursements across every member.
            </p>
          </div>

          <div
            className="rounded-[0.8vw]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "3vh 2.5vw",
            }}
          >
            <p
              className="font-body text-[#2d6a4f] font-bold tracking-[0.2em]"
              style={{ fontSize: "0.85vw", marginBottom: "1.5vh" }}
            >
              02
            </p>
            <p
              className="font-display text-white leading-[1.1]"
              style={{ fontSize: "2vw", marginBottom: "1.2vh" }}
            >
              Space Hubs
            </p>
            <p
              className="font-body text-white/45 font-normal"
              style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
            >
              Every space gets its own hub — members, roles, pinned notices, essentials, and shared identity.
            </p>
          </div>

          <div
            className="rounded-[0.8vw]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "3vh 2.5vw",
            }}
          >
            <p
              className="font-body text-[#2d6a4f] font-bold tracking-[0.2em]"
              style={{ fontSize: "0.85vw", marginBottom: "1.5vh" }}
            >
              03
            </p>
            <p
              className="font-display text-white leading-[1.1]"
              style={{ fontSize: "2vw", marginBottom: "1.2vh" }}
            >
              Responsibilities
            </p>
            <p
              className="font-body text-white/45 font-normal"
              style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
            >
              Assign tasks, track ownership, set reminders, and know what needs approval before it's a problem.
            </p>
          </div>

          <div
            className="rounded-[0.8vw]"
            style={{
              background: "rgba(45,106,79,0.15)",
              border: "1px solid rgba(45,106,79,0.25)",
              padding: "3vh 2.5vw",
            }}
          >
            <p
              className="font-body text-[#2d6a4f] font-bold tracking-[0.2em]"
              style={{ fontSize: "0.85vw", marginBottom: "1.5vh" }}
            >
              04
            </p>
            <p
              className="font-display text-white leading-[1.1]"
              style={{ fontSize: "2vw", marginBottom: "1.2vh" }}
            >
              Command Centre
            </p>
            <p
              className="font-body text-white/45 font-normal"
              style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
            >
              Switch between a home, studio, and trip in seconds. See what's owed across all spaces at once.
            </p>
          </div>
        </div>
      </div>

      <div
        className="absolute right-[6vw] bottom-[3vh] font-body text-white/15 font-medium tracking-[0.15em]"
        style={{ fontSize: "1vw" }}
      >
        04
      </div>
    </div>
  );
}
