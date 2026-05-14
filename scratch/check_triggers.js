const Database = require('better-sqlite3');
const db = new Database('C:\\DMS\\data\\dms.db');
const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='inventory_movements'").all();
console.log(JSON.stringify(triggers, null, 2));
db.close();
