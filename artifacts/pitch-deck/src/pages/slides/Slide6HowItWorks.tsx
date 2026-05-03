export default function Slide6HowItWorks() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#1a1e2e]">
      <div
        className="absolute top-0 left-0 right-0 h-[0.5vh] bg-[#2d6a4f]"
      />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ padding: "8vh 8vw" }}
      >
        <div
          className="text-center"
          style={{ marginBottom: "6vh" }}
        >
          <p
            className="font-body text-[#2d6a4f] font-bold tracking-[0.28em] uppercase"
            style={{ fontSize: "1vw", marginBottom: "1.8vh" }}
          >
            How It Works
          </p>
          <h2
            className="font-display text-white tracking-tight leading-[1.0]"
            style={{ fontSize: "4.5vw" }}
          >
            Three steps to a well-run shared space.
          </h2>
        </div>

        <div
          className="w-full flex items-start"
          style={{ gap: "0" }}
        >
          <div
            className="flex flex-col items-center text-center"
            style={{ flex: 1, padding: "0 2.5vw" }}
          >
            <div
              className="flex items-center justify-center font-body text-[#2d6a4f] font-bold rounded-full bg-[#2d6a4f]/15"
              style={{
                width: "6vh",
                height: "6vh",
                fontSize: "1.5vw",
                marginBottom: "2.5vh",
              }}
            >
              1
            </div>
            <p
              className="font-display text-white leading-[1.1]"
              style={{ fontSize: "2.2vw", marginBottom: "1.8vh" }}
            >
              Create your space
            </p>
            <p
              className="font-body text-white/45"
              style={{ fontSize: "1.5vw", lineHeight: "1.55" }}
            >
              Set up a hub for your home, studio, trip, or project in under a minute.
            </p>
          </div>

          <div
            className="flex-shrink-0"
            style={{
              width: "1px",
              height: "20vh",
              background: "rgba(255,255,255,0.08)",
              marginTop: "3vh",
            }}
          />

          <div
            className="flex flex-col items-center text-center"
            style={{ flex: 1, padding: "0 2.5vw" }}
          >
            <div
              className="flex items-center justify-center font-body text-[#2d6a4f] font-bold rounded-full bg-[#2d6a4f]/15"
              style={{
                width: "6vh",
                height: "6vh",
                fontSize: "1.5vw",
                marginBottom: "2.5vh",
              }}
            >
              2
            </div>
            <p
              className="font-display text-white leading-[1.1]"
              style={{ fontSize: "2.2vw", marginBottom: "1.8vh" }}
            >
              Add your people
            </p>
            <p
              className="font-body text-white/45"
              style={{ fontSize: "1.5vw", lineHeight: "1.55" }}
            >
              Invite members, assign roles, and give everyone the right level of access.
            </p>
          </div>

          <div
            className="flex-shrink-0"
            style={{
              width: "1px",
              height: "20vh",
              background: "rgba(255,255,255,0.08)",
              marginTop: "3vh",
            }}
          />

          <div
            className="flex flex-col items-center text-center"
            style={{ flex: 1, padding: "0 2.5vw" }}
          >
            <div
              className="flex items-center justify-center font-body text-[#2d6a4f] font-bold rounded-full bg-[#2d6a4f]/15"
              style={{
                width: "6vh",
                height: "6vh",
                fontSize: "1.5vw",
                marginBottom: "2.5vh",
              }}
            >
              3
            </div>
            <p
              className="font-display text-white leading-[1.1]"
              style={{ fontSize: "2.2vw", marginBottom: "1.8vh" }}
            >
              Track and settle
            </p>
            <p
              className="font-body text-white/45"
              style={{ fontSize: "1.5vw", lineHeight: "1.55" }}
            >
              Log expenses, assign tasks, see monthly breakdowns, and settle balances fairly.
            </p>
          </div>
        </div>

        <div
          className="w-full text-center"
          style={{ marginTop: "5vh" }}
        >
          <p
            className="font-body text-white/25 font-normal"
            style={{ fontSize: "1.5vw" }}
          >
            2,400+ groups already doing this.
          </p>
        </div>
      </div>

      <div
        className="absolute right-[6vw] bottom-[3vh] font-body text-white/15 font-medium tracking-[0.15em]"
        style={{ fontSize: "1vw" }}
      >
        06
      </div>
    </div>
  );
}
