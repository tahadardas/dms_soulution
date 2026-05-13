const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { resetDB, getDB } = require('../src/database');
const { AuthService } = require('../src/services/auth');
const { getCorsOrigins, getJwtSecret } = require('../src/config/security');

const freshSingletonDb = () => {
    resetDB();
    return getDB();
};

test('default admin login is marked for password change and can change password', async () => {
    const db = freshSingletonDb();
    const login = await AuthService.login('admin', 'admin123');
    assert.equal(login.user.mustChangePassword, true);

    const changed = await AuthService.changePassword(login.user.id, 'admin123', 'StrongerPassword123!');
    assert.equal(changed.user.mustChangePassword, false);
    await assert.rejects(() => AuthService.login('admin', 'admin123'), /Invalid credentials/);
    const newLogin = await AuthService.login('admin', 'StrongerPassword123!');
    assert.equal(newLogin.user.mustChangePassword, false);
    resetDB();
});

test('login lockout is applied after repeated failed attempts', async () => {
    const db = freshSingletonDb();
    for (let attempt = 0; attempt < 5; attempt += 1) {
        await assert.rejects(() => AuthService.login('admin', 'wrong-password'), /Invalid credentials/);
    }
    await assert.rejects(() => AuthService.login('admin', 'admin123'), /temporarily locked/i);
    resetDB();
});

test('production rejects default secrets and open CORS', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalJwt = process.env.JWT_SECRET;
    const originalCors = process.env.DMS_CORS_ORIGINS;
    const originalDesktop = process.env.DMS_DESKTOP;

    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.DMS_CORS_ORIGINS;
    delete process.env.DMS_DESKTOP;
    assert.throws(() => getJwtSecret(), /JWT_SECRET/);
    assert.throws(() => getCorsOrigins(), /DMS_CORS_ORIGINS/);

    process.env.JWT_SECRET = 'a-strong-production-secret';
    process.env.DMS_CORS_ORIGINS = '*';
    assert.throws(() => getCorsOrigins(), /cannot contain/);

    process.env.NODE_ENV = originalNodeEnv;
    if (originalJwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalJwt;
    if (originalCors === undefined) delete process.env.DMS_CORS_ORIGINS; else process.env.DMS_CORS_ORIGINS = originalCors;
    if (originalDesktop === undefined) delete process.env.DMS_DESKTOP; else process.env.DMS_DESKTOP = originalDesktop;
});
