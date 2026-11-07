import { Component, type ReactNode } from "react";
import { Empty } from "../kit/index.ts";

/** A screen that throws shows one quiet line and "Try again" in its own column; the sidebar, ⌘K and the other screens stay. `resetKey` (the path) clears it on navigating. */
export class ErrorBoundary extends Component<
  { resetKey?: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Empty
        line="This screen hit a problem. Nothing was lost."
        action="Try again"
        onAction={() => this.setState({ failed: false })}
      />
    );
  }
}
