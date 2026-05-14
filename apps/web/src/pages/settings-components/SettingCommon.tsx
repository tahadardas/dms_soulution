import React from 'react';
import { Card, CardContent } from '@dms/ui';

export const SettingSection: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="settings-section mb-6">
        <h3 className="settings-section__title text-lg font-semibold mb-2">{title}</h3>
        {description && <p className="settings-section__description text-sm text-gray-500 mb-4">{description}</p>}
        <Card>
            <CardContent>{children}</CardContent>
        </Card>
    </div>
);

export const SettingRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
    <div className="settings-row flex items-center justify-between py-4 border-b last:border-0">
        <div className="settings-row__label">
            <div className="settings-row__title font-medium">{label}</div>
            {description && <div className="settings-row__description text-xs text-gray-400">{description}</div>}
        </div>
        <div className="settings-row__control ml-4">{children}</div>
    </div>
);
