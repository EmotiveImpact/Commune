export default function Slide3Solution() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#f5f3ef]">
      <div
        className="absolute top-0 left-0 w-[0.5vw] h-full bg-[#2d6a4f]"
      />

      <div
        className="absolute top-[8vh] left-[6vw] right-[6vw] bottom-[8vh] flex"
        style={{ gap: "6vw" }}
      >
        <div
          className="flex flex-col justify-center"
          style={{ width: "46vw" }}
        >
          <p
            className="font-body text-[#2d6a4f] font-bold tracking-[0.28em] uppercase"
            style={{ fontSize: "1vw", marginBottom: "2.5vh" }}
          >
            The Solution
          </p>
          <h2
            className="font-display text-[#1a1e2e] tracking-tight leading-[1.0]"
            style={{
              fontSize: "5.2vw",
              textWrap: "balance",
              marginBottom: "3.5vh",
            }}
          >
            One place for every cost, every responsibility, every person.
          </h2>
          <p
            className="font-body text-[#888880] font-normal"
            style={{
              fontSize: "1.65vw",
              lineHeight: "1.65",
              maxWidth: "40vw",
            }}
          >
            Commune brings your shared finances, space management, and group
            coordination into a single, clear hub — no spreadsheets, no
            chasing messages.
          </p>
        </div>

        <div
          className="flex flex-col justify-center"
          style={{ flex: 1 }}
        >
          <div
            className="bg-[#1a1e2e] rounded-[1.2vw]"
            style={{ padding: "4.5vh 3.5vw" }}
          >
            <p
              className="font-body text-white/35 font-bold tracking-[0.22em] uppercase"
              style={{ fontSize: "0.85vw", marginBottom: "1.5vh" }}
            >
              About Commune
            </p>
            <p
              className="font-display text-white leading-[1.25]"
              style={{ fontSize: "2.1vw", marginBottom: "3vh" }}
            >
              Managing shared money and shared spaces shouldn't be complicated.
            </p>
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                paddingTop: "2.5vh",
                display: "flex",
                flexDirection: "column",
                gap: "1.4vh",
              }}
            >
              <p
                className="font-body text-white/50 font-normal"
                style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
              >
                Track costs &amp; splits
              </p>
              <p
                className="font-body text-white/50 font-normal"
                style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
              >
                Manage spaces &amp; members
              </p>
              <p
                className="font-body text-white/50 font-normal"
                style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
              >
                Assign responsibilities
              </p>
              <p
                className="font-body text-white/50 font-normal"
                style={{ fontSize: "1.5vw", lineHeight: "1.5" }}
              >
                Switch between all your spaces at once
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute right-[6vw] bottom-[3vh] font-body text-[#1a1e2e]/20 font-medium tracking-[0.15em]"
        style={{ fontSize: "1vw" }}
      >
        03
      </div>
    </div>
  );
}
