// IndexedDB(ブラウザ内蔵のデータベース)を扱うためのモジュール
// このファイルの中だけでDBの詳細を扱い、他のファイルからは
// わかりやすい関数（getExercises, addRecord など）を呼ぶだけで済むようにする

const DB_NAME = 'kinntore-db';
const DB_VERSION = 2;

// 部位の初期データ（アイコン画像はicons/bodyparts/配下）
const INITIAL_BODY_PARTS = [
  { id: 'chest', name: '胸', icon: 'icons/bodyparts/chest.svg', color: '#FF3B3B' },
  { id: 'back', name: '背中', icon: 'icons/bodyparts/back.svg', color: '#2979FF' },
  { id: 'shoulder', name: '肩', icon: 'icons/bodyparts/shoulder.svg', color: '#FF8C1A' },
  { id: 'biceps', name: '二頭筋', icon: 'icons/bodyparts/biceps.svg', color: '#FFD60A' },
  { id: 'triceps', name: '三頭筋', icon: 'icons/bodyparts/triceps.svg', color: '#B14EFF' },
  { id: 'abs', name: '腹筋', icon: 'icons/bodyparts/abs.svg', color: '#2ECC40' },
  { id: 'legs', name: '脚', icon: 'icons/bodyparts/legs.svg', color: '#22D3EE' },
];

// 部位ごとのよく使う種目の初期データ
const INITIAL_EXERCISES = [
  { name: 'ベンチプレス', bodyPartId: 'chest' },
  { name: 'ダンベルフライ', bodyPartId: 'chest' },
  { name: 'ラットプルダウン', bodyPartId: 'back' },
  { name: 'デッドリフト', bodyPartId: 'back' },
  { name: 'ショルダープレス', bodyPartId: 'shoulder' },
  { name: 'サイドレイズ', bodyPartId: 'shoulder' },
  { name: 'バーベルカール', bodyPartId: 'biceps' },
  { name: 'ハンマーカール', bodyPartId: 'biceps' },
  { name: 'トライセプスエクステンション', bodyPartId: 'triceps' },
  { name: 'ケーブルプレスダウン', bodyPartId: 'triceps' },
  { name: 'クランチ', bodyPartId: 'abs' },
  { name: 'レッグレイズ', bodyPartId: 'abs' },
  { name: 'スクワット', bodyPartId: 'legs' },
  { name: 'レッグプレス', bodyPartId: 'legs' },
];

let dbPromise = null;

// DBを開く（まだ開いていなければ開く。初回はテーブル作成＋初期データ投入も行う）
function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('bodyParts')) {
        db.createObjectStore('bodyParts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('exercises')) {
        const exStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
        exStore.createIndex('bodyPartId', 'bodyPartId');
      }
      if (!db.objectStoreNames.contains('records')) {
        const recStore = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
        recStore.createIndex('date', 'date');
        recStore.createIndex('bodyPartId', 'bodyPartId');
      }
      if (!db.objectStoreNames.contains('dailySessions')) {
        db.createObjectStore('dailySessions', { keyPath: 'date' });
      }
    };

    request.onsuccess = async (event) => {
      const db = event.target.result;
      await seedInitialDataIfNeeded(db);
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// 部位データ(bodyParts)は種目と違ってユーザーが編集する対象ではないため、
// アプリ起動のたびに最新の定義(アイコンや色)に同期する。
// 種目(exercises)は自分で追加・編集するデータなので、初回だけ初期値を入れる。
async function seedInitialDataIfNeeded(db) {
  await runTransaction(db, 'bodyParts', 'readwrite', (store) => {
    INITIAL_BODY_PARTS.forEach((bp) => store.put(bp));
  });

  const exercises = await getAll(db, 'exercises');
  if (exercises.length === 0) {
    await runTransaction(db, 'exercises', 'readwrite', (store) => {
      INITIAL_EXERCISES.forEach((ex) => store.add(ex));
    });
  }
}

// IDBRequestをPromiseに変換する共通ヘルパー
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// トランザクションをまとめて実行するための共通ヘルパー
function runTransaction(db, storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

function getAll(db, storeName) {
  return runTransaction(db, storeName, 'readonly', (store) => {
    return promisifyRequest(store.getAll());
  }).then((p) => p);
}

// ===== 公開する関数 =====

export async function getBodyParts() {
  const db = await openDB();
  return getAll(db, 'bodyParts');
}

export async function getExercises() {
  const db = await openDB();
  return getAll(db, 'exercises');
}

export async function addExercise(name, bodyPartId) {
  const db = await openDB();
  const tx = db.transaction('exercises', 'readwrite');
  const id = await promisifyRequest(tx.objectStore('exercises').add({ name, bodyPartId }));
  return id;
}

export async function updateExercise(id, name, bodyPartId) {
  const db = await openDB();
  const tx = db.transaction('exercises', 'readwrite');
  await promisifyRequest(tx.objectStore('exercises').put({ id, name, bodyPartId }));
}

export async function deleteExercise(id) {
  const db = await openDB();
  const tx = db.transaction('exercises', 'readwrite');
  await promisifyRequest(tx.objectStore('exercises').delete(id));
}

// 記録を1件追加する。sets は [{weight, reps, restSeconds}, ...] の配列
export async function addRecord(date, exerciseId, bodyPartId, sets) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  const id = await promisifyRequest(
    tx.objectStore('records').add({ date, exerciseId, bodyPartId, sets })
  );
  return id;
}

export async function updateRecord(id, date, exerciseId, bodyPartId, sets) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  await promisifyRequest(
    tx.objectStore('records').put({ id, date, exerciseId, bodyPartId, sets })
  );
}

export async function deleteRecord(id) {
  const db = await openDB();
  const tx = db.transaction('records', 'readwrite');
  await promisifyRequest(tx.objectStore('records').delete(id));
}

// 指定した日付範囲(両端含む、"YYYY-MM-DD"形式)の記録を取得する
export async function getRecordsByDateRange(startDate, endDate) {
  const db = await openDB();
  return runTransaction(db, 'records', 'readonly', (store) => {
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    return promisifyRequest(index.getAll(range));
  });
}

export async function getRecordsByDate(date) {
  return getRecordsByDateRange(date, date);
}

export async function getAllRecords() {
  const db = await openDB();
  return getAll(db, 'records');
}

// ===== 日付ごとのトレーニング時間(開始・終了時刻) =====

export async function getDailySession(date) {
  const db = await openDB();
  const tx = db.transaction('dailySessions', 'readonly');
  const session = await promisifyRequest(tx.objectStore('dailySessions').get(date));
  return session || { date, startTime: null, endTime: null };
}

export async function saveDailySession(date, startTime, endTime) {
  const db = await openDB();
  const tx = db.transaction('dailySessions', 'readwrite');
  await promisifyRequest(
    tx.objectStore('dailySessions').put({
      date,
      startTime: startTime || null,
      endTime: endTime || null,
    })
  );
}

async function getAllDailySessions() {
  const db = await openDB();
  return getAll(db, 'dailySessions');
}

// バックアップ用：全データをまとめて取得する
export async function exportAllData() {
  const [bodyParts, exercises, records, dailySessions] = await Promise.all([
    getBodyParts(),
    getExercises(),
    getAllRecords(),
    getAllDailySessions(),
  ]);
  return { bodyParts, exercises, records, dailySessions, exportedAt: new Date().toISOString() };
}

// バックアップからの復元：既存データを全部消してから読み込んだデータを入れ直す
export async function importAllData(data) {
  const db = await openDB();
  const storeNames = ['bodyParts', 'exercises', 'records', 'dailySessions'];
  const tx = db.transaction(storeNames, 'readwrite');

  storeNames.forEach((name) => tx.objectStore(name).clear());

  (data.bodyParts || []).forEach((bp) => tx.objectStore('bodyParts').put(bp));
  (data.exercises || []).forEach((ex) => tx.objectStore('exercises').put(ex));
  (data.records || []).forEach((rec) => tx.objectStore('records').put(rec));
  (data.dailySessions || []).forEach((s) => tx.objectStore('dailySessions').put(s));

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
