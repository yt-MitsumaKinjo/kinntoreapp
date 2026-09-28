// データのエクスポート（保存）・インポート（復元）のロジック

import * as db from './db.js';
import { showToast, confirmDialog } from './ui.js';
import { refreshCalendar } from './calendar.js';
import { refreshExercisesScreen } from './exercises.js';
import { todayString } from './utils.js';

export function initBackupScreen() {
  document.getElementById('export-btn').addEventListener('click', exportData);

  const importBtn = document.getElementById('import-btn');
  const fileInput = document.getElementById('import-file');
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleImportFile);
}

async function exportData() {
  const data = await db.exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `kinntore-backup-${todayString()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast('エクスポートしました');
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = ''; // 同じファイルを連続で選べるようにリセット
  if (!file) return;

  if (!confirmDialog('現在の記録・種目データはすべて置き換えられます。復元してよいですか？')) {
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await db.importAllData(data);
    showToast('復元しました');
    await refreshCalendar();
    await refreshExercisesScreen();
  } catch (e) {
    showToast('ファイルの読み込みに失敗しました');
    console.error(e);
  }
}
