
"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { ErrorState, RetryButton } from "@/components/layout/page-state";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by React's Component contract
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in dashboard section:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="Section unavailable"
          description="This module hit an isolated error. Other HR and payroll areas remain available."
          action={<RetryButton onClick={() => this.setState({ hasError: false })} label="Restart section" />}
        />
      );
    }

    return this.props.children;
  }
}
