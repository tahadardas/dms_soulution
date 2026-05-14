import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@dms/ui';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="dms-error-boundary">
                    <div className="dms-error-boundary__content">
                        <h1>Something went wrong</h1>
                        <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
                        <Button onClick={this.handleReset}>Return to Safety</Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
