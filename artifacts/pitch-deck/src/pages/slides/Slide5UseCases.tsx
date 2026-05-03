export default function Slide5UseCases() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#f5f3ef]">
      <div
        className="absolute top-0 left-0 w-[0.5vw] h-full bg-[#2d6a4f]"
      />

      <div
        className="absolute inset-0 flex flex-col"
        style={{ padding: "7vh 7vw 7vh 8vw" }}
      >
        <div style={{ marginBottom: "4vh" }}>
          <p
            className="font-body text-[#2d6a4f] font-bold tracking-[0.28em] uppercase"
            style={{ fontSize: "1vw", marginBottom: "1.5vh" }}
          >
            Use Cases
          </p>
          <h2
            className="font-display text-[#1a1e2e] tracking-tight leading-[1.0]"
            style={{ fontSize: "4.2vw" }}
          >
            Built for every way people share space.
          </h2>
        </div>

        <div
          className="flex"
          style={{ gap: "1.5vw", flex: 1 }}
        >
          <div
            className="flex flex-col overflow-hidden rounded-[0.8vw]"
            style={{ flex: 1, background: "#fff" }}
          >
            <div style={{ flex: 1, overflow: "hidden" }}>
              <img
                src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=700&q=80&auto=format&fit=crop"
                alt="House shares"
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            </div>
            <div style={{ padding: "1.8vh 1.5vw 2vh" }}>
              <p
                className="font-body text-[#1a1e2e] font-bold"
                style={{ fontSize: "1.5vw", marginBottom: "0.4vh" }}
              >
                House Shares
              </p>
              <p
                className="font-body text-[#888880]"
                style={{ fontSize: "1.2vw" }}
              >
                Rent &middot; Bills &middot; Chores
              </p>
            </div>
          </div>

          <div
            className="flex flex-col overflow-hidden rounded-[0.8vw]"
            style={{ flex: 1, background: "#fff" }}
          >
            <div style={{ flex: 1, overflow: "hidden" }}>
              <img
                src="https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=700&q=80&auto=format&fit=crop"
                alt="Couples"
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            </div>
            <div style={{ padding: "1.8vh 1.5vw 2vh" }}>
              <p
                className="font-body text-[#1a1e2e] font-bold"
                style={{ fontSize: "1.5vw", marginBottom: "0.4vh" }}
              >
                Couples
              </p>
              <p
                className="font-body text-[#888880]"
                style={{ fontSize: "1.2vw" }}
              >
                Budgets &middot; Joint expenses
              </p>
            </div>
          </div>

          <div
            className="flex flex-col overflow-hidden rounded-[0.8vw]"
            style={{ flex: 1, background: "#fff" }}
          >
            <div style={{ flex: 1, overflow: "hidden" }}>
              <img
                src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=700&q=80&auto=format&fit=crop"
                alt="Studios and offices"
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            </div>
            <div style={{ padding: "1.8vh 1.5vw 2vh" }}>
              <p
                className="font-body text-[#1a1e2e] font-bold"
                style={{ fontSize: "1.5vw", marginBottom: "0.4vh" }}
              >
                Studios &amp; Offices
              </p>
              <p
                className="font-body text-[#888880]"
                style={{ fontSize: "1.2vw" }}
              >
                Costs &middot; Tools &middot; Roles
              </p>
            </div>
          </div>

          <div
            className="flex flex-col overflow-hidden rounded-[0.8vw]"
            style={{ flex: 1, background: "#fff" }}
          >
            <div style={{ flex: 1, overflow: "hidden" }}>
              <img
                src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=700&q=80&auto=format&fit=crop"
                alt="Group trips"
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            </div>
            <div style={{ padding: "1.8vh 1.5vw 2vh" }}>
              <p
                className="font-body text-[#1a1e2e] font-bold"
                style={{ fontSize: "1.5vw", marginBottom: "0.4vh" }}
              >
                Group Trips
              </p>
              <p
                className="font-body text-[#888880]"
                style={{ fontSize: "1.2vw" }}
              >
                On the go &middot; Settle up
              </p>
            </div>
          </div>

          <div
            className="flex flex-col overflow-hidden rounded-[0.8vw]"
            style={{ flex: 1, background: "#fff" }}
          >
            <div style={{ flex: 1, overflow: "hidden" }}>
              <img
                src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=700&q=80&auto=format&fit=crop"
                alt="Creative projects"
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            </div>
            <div style={{ padding: "1.8vh 1.5vw 2vh" }}>
              <p
                className="font-body text-[#1a1e2e] font-bold"
                style={{ fontSize: "1.5vw", marginBottom: "0.4vh" }}
              >
                Creative Projects
              </p>
              <p
                className="font-body text-[#888880]"
                style={{ fontSize: "1.2vw" }}
              >
                Budget &middot; Ownership
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute right-[6vw] bottom-[3vh] font-body text-[#1a1e2e]/20 font-medium tracking-[0.15em]"
        style={{ fontSize: "1vw" }}
      >
        05
      </div>
    </div>
  );
}
