import React from 'react';
import './Table.css';

export interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (item: T) => React.ReactNode;
    width?: string;
    type?: 'numeric' | 'text';
}

export interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (item: T) => void;
    isLoading?: boolean;
}

export function Table<T extends { id?: string | number }>({ data, columns, onRowClick, isLoading }: TableProps<T>) {
    return (
        <div className="dms-table-container">
            <table className="dms-table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} style={{ width: col.width }}>{col.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? (
                        <tr>
                            <td colSpan={columns.length} className="dms-table-loading">Loading...</td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="dms-table-empty">No data found</td>
                        </tr>
                    ) : (
                        data.map((row, rowIdx) => (
                            <tr
                                key={row.id || rowIdx}
                                onClick={() => onRowClick?.(row)}
                                className={onRowClick ? 'clickable' : ''}
                            >
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx} className={col.type === 'numeric' ? 'numeric' : ''}>
                                        {col.cell ? col.cell(row) : (row as any)[col.accessorKey as string]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
