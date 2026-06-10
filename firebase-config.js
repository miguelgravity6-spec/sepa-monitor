// ===== FIREBASE CONFIGURATION =====
// Reemplaza estos valores con la configuración de tu proyecto Firebase.
// Obtén estos datos desde Firebase Console > Configuración del proyecto > Tus apps > Web

const firebaseConfig = {
    apiKey: "PENDING_CONFIG",
    authDomain: "PENDING_CONFIG",
    databaseURL: "PENDING_CONFIG",
    projectId: "PENDING_CONFIG",
    storageBucket: "PENDING_CONFIG",
    messagingSenderId: "PENDING_CONFIG",
    appId: "PENDING_CONFIG"
};

// Initialize Firebase
let firebaseApp = null;
let db = null;

function initFirebase() {
    try {
        if (firebaseConfig.apiKey === "PENDING_CONFIG") {
            console.warn('⚠️ Firebase no está configurado. Los datos se guardarán solo en localStorage.');
            console.warn('   Edita firebase-config.js con tu configuración de Firebase.');
            return false;
        }
        firebaseApp = firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log('✅ Firebase inicializado correctamente.');
        return true;
    } catch (error) {
        console.error('❌ Error al inicializar Firebase:', error);
        return false;
    }
}

// ===== FIREBASE DATABASE HELPERS =====

// Write data to a specific path
function firebaseSet(path, data) {
    if (!db) return Promise.resolve();
    return db.ref(path).set(data).catch(err => {
        console.error(`Firebase write error at ${path}:`, err);
    });
}

// Push data (auto-generated key) to a path
function firebasePush(path, data) {
    if (!db) return Promise.resolve();
    return db.ref(path).push(data).catch(err => {
        console.error(`Firebase push error at ${path}:`, err);
    });
}

// Read data once from a path
function firebaseGet(path) {
    if (!db) return Promise.resolve(null);
    return db.ref(path).once('value').then(snapshot => snapshot.val()).catch(err => {
        console.error(`Firebase read error at ${path}:`, err);
        return null;
    });
}

// Remove data at a path
function firebaseRemove(path) {
    if (!db) return Promise.resolve();
    return db.ref(path).remove().catch(err => {
        console.error(`Firebase remove error at ${path}:`, err);
    });
}

// Listen for real-time changes at a path
function firebaseListen(path, callback) {
    if (!db) return;
    db.ref(path).on('value', snapshot => {
        callback(snapshot.val());
    });
}

// Check if Firebase is available
function isFirebaseReady() {
    return db !== null;
}
