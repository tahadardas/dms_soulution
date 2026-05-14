import React from 'react';

export interface LoadingStateProps {
    message?: string;
    fullPage?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message, fullPage }) => {
    return (
        <div className={`dms-loading-state ${fullPage ? 'dms-loading-state--full' : ''}`}>
            <div className="dms-loading-spinner" />
            {message && <p className="dms-loading-message">{message}</p>}
        </div>
    );
};
