import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("App crashed:", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell landing-shell">
          <section className="card join-card">
            <p className="eyebrow">LAN Media Queue</p>
            <h1>Playback view reset</h1>
            <p className="muted">The app hit a rendering error and recovered into a safe fallback.</p>
            <button className="primary-button" type="button" onClick={this.handleReload}>
              Reload app
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
