import { useEffect, useState } from 'react';
import { Button, Modal } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { CartItem } from '../../context/POSContext';

const QUICK_NOTES = [
    { key: 'no-spicy', en: 'No Spicy', ar: 'بدون شطة' },
    { key: 'extra-cheese', en: 'Extra Cheese', ar: 'جبنة زيادة' },
    { key: 'well-done', en: 'Well Done', ar: 'مطبوخ جيداً' },
    { key: 'no-onions', en: 'No Onions', ar: 'بدون بصل' }
];

export const LineNoteModal = ({
    isOpen,
    onClose,
    item,
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    item: CartItem | null;
    onSave: (note: string) => void;
}) => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.dir() === 'rtl';
    const [noteText, setNoteText] = useState('');

    useEffect(() => {
        if (item) setNoteText(item.note || '');
    }, [item, isOpen]);

    const handleChipClick = (chipText: string) => {
        setNoteText((prev) => {
            if (prev) return `${prev}, ${chipText}`;
            return chipText;
        });
    };

    const handleSave = () => {
        onSave(noteText);
        onClose();
    };

    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('pos.lineNote', 'Item Note')}>
            <div className="pos-line-note-modal">
                <p className="pos-line-note-modal__product">{item.name}</p>
                <textarea
                    className="pos-line-note-modal__textarea"
                    placeholder={t('pos.lineNotePlaceholder', 'Add a note...')}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    dir={isRTL ? 'rtl' : 'ltr'}
                />
                <div className="pos-line-note-modal__chips">
                    {QUICK_NOTES.map((chip) => (
                        <button
                            key={chip.key}
                            type="button"
                            className="pos-chip"
                            onClick={() => handleChipClick(isRTL ? chip.ar : chip.en)}
                        >
                            {isRTL ? chip.ar : chip.en}
                        </button>
                    ))}
                </div>
                <div className="pos-line-note-modal__actions">
                    <Button variant="secondary" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                        {t('common.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
