import { Component, Suspense, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { lazyComponent, preloadAll } from "../src/shell/lazyComponent";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>Could not draw</p> : this.props.children; }
}
const show = (children: ReactNode) => render(<Boundary><Suspense fallback={<p>Loading</p>}>{children}</Suspense></Boundary>);
const unreachable = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("a component whose code loads on first use", () => {
  it("shows the loading state until its code arrives", async () => {
    let arrive = () => {};
    const arrived = new Promise<void>((resolve) => { arrive = resolve; });
    const Greeting = lazyComponent(async () => { await arrived; return ({ name }: { name: string }) => <p>Hello {name}</p>; });
    show(<Greeting name="Ada" />);
    expect(screen.getByText("Loading")).toBeTruthy();
    arrive();
    expect(await screen.findByText("Hello Ada")).toBeTruthy();
  });

  it("draws at once when its code was loaded ahead", async () => {
    const Greeting = lazyComponent(async () => ({ name }: { name: string }) => <p>Hello {name}</p>);
    await Greeting.preload();
    show(<Greeting name="Ada" />);
    expect(screen.getByText("Hello Ada")).toBeTruthy();
  });

  it("loads its code once, however often it is asked for", async () => {
    const load = vi.fn(async () => () => <p>Loaded</p>);
    const Loaded = lazyComponent(load);
    await Promise.all([Loaded.preload(), Loaded.preload()]);
    show(<><Loaded /><Loaded /></>);
    expect(screen.getAllByText("Loaded")).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads, with preloadAll, the code of every component and of those it brings", async () => {
    const Inner = { current: null as null | ReturnType<typeof lazyComponent<object>> };
    const inner = vi.fn(async () => () => <p>Inner</p>);
    const Outer = lazyComponent(async () => {
      Inner.current = lazyComponent(inner);
      return () => <p>Outer</p>;
    });
    await preloadAll();
    expect(inner).toHaveBeenCalledTimes(1);
    const Loaded = Inner.current!;
    show(<><Outer /><Loaded /></>);
    expect(screen.getByText("Outer")).toBeTruthy();
    expect(screen.getByText("Inner")).toBeTruthy();
  });

  it("reloads the page once when its code cannot load, and stays on the loading state meanwhile", async () => {
    const Broken = lazyComponent(unreachable);
    show(<Broken />);
    // The time of the reload is kept just before it. jsdom cannot load a
    // page (it says so on the console), so this one stays as it is.
    await waitFor(() => expect(sessionStorage.getItem("commune.codeReloadedAt")).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.queryByText("Could not draw")).toBeNull();
  });

  it("lets the error reach the recovery card when the page was reloaded for code moments ago", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sessionStorage.setItem("commune.codeReloadedAt", String(Date.now()));
    const Broken = lazyComponent(unreachable);
    show(<Broken />);
    expect(await screen.findByText("Could not draw")).toBeTruthy();
  });
});
