// ================================================================
//  src/config/db.js
//  Database abstraction — Firebase Firestore with in-memory fallback.
//  All CRUD in the app goes through these 5 functions only.
//  Switch between Firestore and demo mode is fully automatic.
// ================================================================
"use strict";

const bcrypt = require("bcryptjs");

let admin = null;
let db    = null;

// ----------------------------------------------------------------
//  IN-MEMORY STORE  (used when Firebase is not configured)
// ----------------------------------------------------------------
const mem = {
  users:   [],
  surveys: [],
  reports: [],
  seq:     { users: 2, surveys: 1, reports: 1 },
};

// Pre-seed one admin so you can log in immediately in demo mode
mem.users.push({
  id:        "u1",
  name:      "Admin Rao",
  email:     "admin@sevasync.org",
  password:  bcrypt.hashSync("admin123", 10),
  role:      "admin",
  region:    "All",
  lang:      "English",
  status:    "active",
  createdAt: new Date().toISOString(),
});

// ----------------------------------------------------------------
//  FIREBASE INIT
// ----------------------------------------------------------------
function initFirebase() {
  try {
    admin = require("firebase-admin");
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require("../../serviceAccountKey.json");

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    console.log("Firebase / Firestore connected");
    return true;
  } catch (_) {
    console.warn("Firebase not configured — using in-memory store (demo mode)");
    return false;
  }
}

// ----------------------------------------------------------------
//  CRUD HELPERS
// ----------------------------------------------------------------

async function dbAdd(col, doc) {
  if (db) {
    const ref = await db.collection(col).add({
      ...doc,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id, ...doc, createdAt: new Date().toISOString() };
  }
  const id = col[0] + (mem.seq[col] || 1);
  mem.seq[col] = (mem.seq[col] || 1) + 1;
  const record = { id, ...doc, createdAt: new Date().toISOString() };
  if (!mem[col]) mem[col] = [];
  mem[col].push(record);
  return record;
}

async function dbGet(col, id) {
  if (db) {
    const snap = await db.collection(col).doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }
  return (mem[col] || []).find(r => r.id === id) || null;
}

async function dbQuery(col, filters = {}, opts = {}) {
  if (db) {
    let ref = db.collection(col);
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== "" && v !== "All") {
        ref = ref.where(k, "==", v);
      }
    }
    ref = ref.orderBy("createdAt", "desc");
    if (opts.limit) ref = ref.limit(opts.limit);
    const snap = await ref.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  let rows = [...(mem[col] || [])].reverse();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "" && v !== "All") {
      rows = rows.filter(r => r[k] === v);
    }
  }
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

async function dbUpdate(col, id, data) {
  if (db) {
    await db.collection(col).doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  }
  const arr = mem[col] || [];
  const i   = arr.findIndex(r => r.id === id);
  if (i === -1) return false;
  arr[i] = { ...arr[i], ...data, updatedAt: new Date().toISOString() };
  return true;
}

async function dbDelete(col, id) {
  if (db) {
    await db.collection(col).doc(id).delete();
    return true;
  }
  const arr = mem[col] || [];
  const i   = arr.findIndex(r => r.id === id);
  if (i === -1) return false;
  arr.splice(i, 1);
  return true;
}

function isFirestoreConnected() {
  return db !== null;
}

module.exports = { initFirebase, dbAdd, dbGet, dbQuery, dbUpdate, dbDelete, isFirestoreConnected };
