'use client';

import React, { Component, ErrorInfo } from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * ErrorBoundary Component
 * Catches runtime errors in React tree and shows fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    maxWidth: '600px',
                    margin: '100px auto',
                    textAlign: 'center',
                    fontFamily: 'sans-serif'
                }}>
                    <h1 style={{ color: '#dc2626', marginBottom: '16px' }}>
                        ⚠️ Something Went Wrong
                    </h1>
                    <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                        The editor encountered an error. Please try refreshing the page.
                    </p>
                    <details style={{
                        textAlign: 'left',
                        background: '#f3f4f6',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '24px'
                    }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                            Error Details
                        </summary>
                        <pre style={{
                            marginTop: '12px',
                            fontSize: '12px',
                            overflow: 'auto'
                        }}>
                            {this.state.error?.toString()}
                        </pre>
                    </details>
                    <button
                        onClick={this.handleReset}
                        style={{
                            padding: '12px 24px',
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
