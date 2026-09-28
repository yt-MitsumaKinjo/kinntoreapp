// アプリ全体の初期化。ナビゲーション（画面切り替え）の配線もここで行う。

import { showScreen, goBack } from './ui.js';
import { initCalendar } from './calendar.js';
import { initRecordFlow } from './record.js';
import { initExercisesScreen, refreshExercisesScreen } from './exercises.js';
import { initBackupScreen } from './backup.js';

// Service Worker登録（オフラインで動くようにするための仕組み）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.error('Service Worker登録に失敗しました', err);
    });
  });
}

// 下部ナビゲーションのボタン
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.nav;
    showScreen(target);
    if (target === 'exercises') refreshExercisesScreen();
  });
});

// 「← 戻る」ボタン（複数画面で共通）
document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => goBack());
});

async function main() {
  await initCalendar();
  await initRecordFlow();
  await initExercisesScreen();
  initBackupScreen();
}

main();
