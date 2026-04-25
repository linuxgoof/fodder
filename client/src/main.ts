import { Application } from 'pixi.js';
import { startAmbienceOnUserIntent, setAmbienceVolume } from './audio/ambience';
import { Game } from './game';
import { mountOverlays } from './ui/overlayController';
import { mountGameHud } from './ui/gameHud';

async function boot() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#0a0a0a',
    antialias: true,
  });

  const appEl = document.getElementById('app');
  if (!appEl) throw new Error('no #app element');
  appEl.appendChild(app.canvas);

  const ui = document.getElementById('fodder-ui');
  if (!ui) throw new Error('no #fodder-ui');

  let gameStarted = false;
  const startGame = async () => {
    if (gameStarted) return;
    gameStarted = true;
    ui.classList.add('fodder-ui--gone');
    document.body.classList.add('fodder-playing');
    const game = new Game(app);
    if (localStorage.getItem('fodder_sound') !== '0') {
      startAmbienceOnUserIntent();
      setAmbienceVolume(0.12);
    } else {
      setAmbienceVolume(0);
    }
    await game.start();
    mountGameHud(game);
  };

  mountOverlays(() => {
    void startGame();
  });
}

boot().catch((err) => {
  console.error('fodder failed to boot:', err);
});
