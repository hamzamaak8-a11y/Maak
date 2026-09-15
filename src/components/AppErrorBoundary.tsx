import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

const CONFIG_ERROR = "Supabase frontend configuration is missing or invalid.";

export default class AppErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, errorMessage: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[maak-runtime] uncaught_render_error", {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const isConfigError = this.state.errorMessage === CONFIG_ERROR;

    return (
      <main
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        <section style={{ maxWidth: "520px" }}>
          <h1 style={{ marginBottom: "10px" }}>حدث خطأ غير متوقع</h1>
          <p style={{ marginBottom: "8px" }}>
            {isConfigError ? CONFIG_ERROR : "Une erreur inattendue s'est produite."}
          </p>
          <p style={{ marginBottom: "20px" }}>يمكنك إعادة تحميل الصفحة للمتابعة.</p>
          <button type="button" className="primary" onClick={this.handleReload}>
            إعادة تحميل الصفحة
          </button>
        </section>
      </main>
    );
  }
}
