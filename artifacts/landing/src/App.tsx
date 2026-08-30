import { Router, Route, Switch } from "wouter";
import StudioPage from "@/landing/StudioPage";
import PaperPage from "@/landing/PaperPage";
import InkPage from "@/landing/InkPage";
import ProductPage from "@/landing/ProductPage";

const rawBase = import.meta.env.BASE_URL ?? "/";
const base = rawBase === "/" ? "" : rawBase.replace(/\/$/, "");

export default function App() {
  return (
    <Router base={base || undefined}>
      <Switch>
        <Route path="/" component={StudioPage} />
        <Route path="/paper" component={PaperPage} />
        <Route path="/ink" component={InkPage} />
        <Route path="/product" component={ProductPage} />
      </Switch>
    </Router>
  );
}
