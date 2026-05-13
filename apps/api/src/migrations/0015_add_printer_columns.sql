-- Add new columns to printers table for USB/WINDOWS printer support
ALTER TABLE printers ADD COLUMN display_name TEXT;
ALTER TABLE printers ADD COLUMN windows_printer_name TEXT;
ALTER TABLE printers ADD COLUMN device_id TEXT;
ALTER TABLE printers ADD COLUMN paper_width INTEGER DEFAULT 80;