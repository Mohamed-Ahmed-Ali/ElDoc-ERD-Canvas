import { ErrorBoundary } from "./ErrorBoundary";
import { CanvasApp } from "./components/canvas/Canvas";

export function App() {
  return (
    <ErrorBoundary>
      <CanvasApp />
    </ErrorBoundary>
  );
}
