export interface POSLayoutProps {
    header?: React.ReactNode;
    statusBar?: React.ReactNode;
    children: React.ReactNode;
}

export const POSLayout: React.FC<POSLayoutProps> = ({ header, statusBar, children }) => {
    return (
        <div className="dms-pos-layout">
            {header && <div className="dms-pos-layout__header">{header}</div>}
            <div className="dms-pos-layout__main">{children}</div>
            {statusBar && <div className="dms-pos-layout__status-bar">{statusBar}</div>}
        </div>
    );
};
