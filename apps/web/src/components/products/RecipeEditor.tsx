import React, { useMemo } from 'react';
import { Button, Input, Select, Table, Column } from '@dms/ui';
import { RecipeLine, Product, Unit } from '../../types/products';
import { useTranslation } from 'react-i18next';
import '../../styles/RecipeEditor.css';

export interface RecipeEditorProps {
    lines: RecipeLine[];
    ingredients: Product[];
    units: Unit[];
    disabled?: boolean;
    onChange: (lines: RecipeLine[]) => void;
    onCreateIngredient?: () => void;
}

const createLine = (): RecipeLine => ({
    id: `tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    ingredient_id: 0,
    quantity: 1,
    unit_id: null,
    waste_percent: 0,
    notes: ''
});

export const RecipeEditor: React.FC<RecipeEditorProps> = ({ lines, ingredients, units, disabled, onChange, onCreateIngredient }) => {
    const ingredientOptions = useMemo(() => ingredients.filter(item => (item.is_active ?? 1) === 1), [ingredients]);
    const { t } = useTranslation();

    const updateLine = (line: RecipeLine, updates: Partial<RecipeLine>) => {
        const index = lines.indexOf(line);
        if (index < 0) return;
        const next = [...lines];
        next[index] = { ...next[index], ...updates };
        onChange(next);
    };

    const handleAdd = () => {
        onChange([...lines, createLine()]);
    };

    const handleRemove = (line: RecipeLine) => {
        const next = lines.filter(item => item !== line);
        onChange(next);
    };

    const columns: Column<RecipeLine>[] = [
        {
            header: t('products.recipe.table.ingredient'),
            accessorKey: 'ingredient_id',
            cell: (line: RecipeLine) => (
                <Select
                    value={String(line.ingredient_id || '')}
                    onChange={(event) => updateLine(line, { ingredient_id: Number(event.target.value) })}
                    disabled={disabled}
                >
                    <option value="">{t('products.recipe.selectIngredient')}</option>
                    {ingredientOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                </Select>
            )
        },
        {
            header: t('products.recipe.table.quantity'),
            accessorKey: 'quantity',
            cell: (line: RecipeLine) => (
                <Input
                    type="number"
                    value={String(line.quantity || '')}
                    onChange={(event) => updateLine(line, { quantity: Number(event.target.value) })}
                    disabled={disabled}
                />
            )
        },
        {
            header: t('products.recipe.table.unit'),
            accessorKey: 'unit_id',
            cell: (line: RecipeLine) => (
                <Select
                    value={String(line.unit_id || '')}
                    onChange={(event) => updateLine(line, { unit_id: Number(event.target.value) })}
                    disabled={disabled}
                >
                    <option value="">{t('products.recipe.defaultUnit')}</option>
                    {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>
                    ))}
                </Select>
            )
        },
        {
            header: t('products.recipe.table.waste'),
            accessorKey: 'waste_percent',
            cell: (line: RecipeLine) => (
                <Input
                    type="number"
                    value={String(line.waste_percent ?? '')}
                    onChange={(event) => updateLine(line, { waste_percent: Number(event.target.value) })}
                    disabled={disabled}
                />
            )
        },
        {
            header: t('common.notes'),
            accessorKey: 'notes',
            cell: (line: RecipeLine) => (
                <Input
                    value={line.notes || ''}
                    onChange={(event) => updateLine(line, { notes: event.target.value })}
                    disabled={disabled}
                />
            )
        },
        {
            header: '',
            width: '50px',
            cell: (line: RecipeLine) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(line)}
                    disabled={disabled}
                >
                    {t('common.remove')}
                </Button>
            )
        }
    ];

    return (
        <div className="recipe-editor">
            <div className="recipe-editor__header">
                <p className="recipe-editor__subtitle">{t('products.recipe.subtitle')}</p>
                <Button variant="secondary" size="sm" onClick={handleAdd} disabled={disabled}>
                    {t('products.recipe.actions.addIngredient')}
                </Button>
            </div>

            {lines.length === 0 ? (
                <div className="recipe-editor__empty">
                    <p>{t('products.recipe.empty')}</p>
                    {ingredientOptions.length === 0 && onCreateIngredient && (
                        <Button variant="secondary" size="sm" onClick={onCreateIngredient}>
                            {t('products.recipe.createIngredient')}
                        </Button>
                    )}
                </div>
            ) : (
                <Table data={lines} columns={columns} />
            )}
        </div>
    );
};

export default RecipeEditor;
