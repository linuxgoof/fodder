import { setAmbienceVolume, startAmbienceOnUserIntent, } from '../audio/ambience';
const HEIGHT_KEY = 'fodder_show_height';
const SOUND_KEY = 'fodder_sound';
const HUD = `
  <div id="fodder-hud" class="fodder-hud fodder-hud--hidden" role="complementary" aria-label="hud">
    <div class="fodder-hud__row">
      <span id="fodderRidge" class="fodder-hud__ridge" aria-live="polite" title="not distance — only where you are">the mouth</span>
    </div>
    <div class="fodder-hud__row">
      <span id="fodderHeightLabel" class="fodder-hud__height--hidden" aria-live="polite">0 px</span>
      <label class="fodder-hud__tog"><input type="checkbox" id="fodderTogHeight"/> show height</label>
      <label class="fodder-hud__tog"><input type="checkbox" id="fodderTogSound" checked/> sound</label>
    </div>
    <div class="fodder-hud__row">
      <button type="button" id="fodderBtnPause" class="fodder-hud__btn" title="or Escape">pause</button>
      <button type="button" id="fodderBtnHand" class="fodder-hud__btn" title="Space / right click">hand</button>
    </div>
  </div>
  <div id="fodder-pause" class="fodder-pause fodder-pause--hidden" role="dialog" aria-modal="true" aria-labelledby="fodderPauseH">
    <div class="fodder-pause__card">
      <p id="fodderPauseH" class="fodder-pause__p">the tower is waiting</p>
      <div class="fodder-pause__actions">
        <button type="button" id="fodderResume" class="fodder-hud__btn">resume</button>
        <button type="button" id="fodderToLedge" class="fodder-hud__btn fodder-hud__btn--danger">return to the ledge</button>
      </div>
    </div>
  </div>
`;
let rafHudLoop = { alive: false, handle: 0 };
function readBoolKey(key, defaultVal) {
    const v = localStorage.getItem(key);
    if (v === null)
        return defaultVal;
    return v === '1';
}
export function mountGameHud(game) {
    const el = document.getElementById('fodder-game-shell') ?? document.body;
    el.insertAdjacentHTML('afterbegin', HUD);
    const hud = document.getElementById('fodder-hud');
    const pause = document.getElementById('fodder-pause');
    pause.classList.add('fodder-pause--hidden');
    const ridgeEl = document.getElementById('fodderRidge');
    const heightEl = document.getElementById('fodderHeightLabel');
    const togH = document.getElementById('fodderTogHeight');
    const togS = document.getElementById('fodderTogSound');
    togH.checked = readBoolKey(HEIGHT_KEY, false);
    togS.checked = readBoolKey(SOUND_KEY, true);
    hud.classList.remove('fodder-hud--hidden');
    const syncHeightVis = () => {
        togH.checked
            ? heightEl.classList.remove('fodder-hud__height--hidden')
            : heightEl.classList.add('fodder-hud__height--hidden');
    };
    rafHudLoop.alive = true;
    const onTickHeight = () => {
        if (!game.isPaused() && !game.isRebuildLocked()) {
            ridgeEl.textContent = game.getRidgeName();
        }
        if (!game.isPaused() && !game.isRebuildLocked() && togH.checked) {
            heightEl.textContent = `${game.getClimbedHeightPx()} px`;
        }
    };
    const raf = () => {
        if (!rafHudLoop.alive)
            return;
        onTickHeight();
        rafHudLoop.handle = requestAnimationFrame(raf);
    };
    raf();
    togH.addEventListener('change', () => {
        syncHeightVis();
        localStorage.setItem(HEIGHT_KEY, togH.checked ? '1' : '0');
    });
    syncHeightVis();
    togS.addEventListener('change', () => {
        localStorage.setItem(SOUND_KEY, togS.checked ? '1' : '0');
        if (!togS.checked) {
            setAmbienceVolume(0);
        }
        else {
            startAmbienceOnUserIntent();
            setAmbienceVolume(0.12);
        }
    });
    const showPause = () => {
        pause.classList.remove('fodder-pause--hidden');
    };
    const hidePause = () => {
        pause.classList.add('fodder-pause--hidden');
    };
    document.getElementById('fodderBtnPause').addEventListener('click', () => {
        if (game.isPaused()) {
            game.setPaused(false);
            hidePause();
        }
        else {
            game.setPaused(true);
            showPause();
        }
    });
    document.getElementById('fodderResume').addEventListener('click', () => {
        game.setPaused(false);
        hidePause();
    });
    document.getElementById('fodderToLedge').addEventListener('click', () => {
        if (!window.confirm('Return to the starting ledge? This clears the shared fall marks (the dots) for this tower for everyone, and restarts your climb from here.')) {
            return;
        }
        hidePause();
        void game.restartFromLedge();
    });
    document.getElementById('fodderBtnHand').addEventListener('click', () => {
        game.input.switchHandFromUi();
    });
    const onKey = (e) => {
        if (e.code === 'Escape' && !game.isRebuildLocked()) {
            e.preventDefault();
            if (game.isPaused()) {
                game.setPaused(false);
                hidePause();
            }
            else {
                game.setPaused(true);
                showPause();
            }
        }
    };
    window.addEventListener('keydown', onKey);
    return {
        unmount: () => {
            rafHudLoop.alive = false;
            cancelAnimationFrame(rafHudLoop.handle);
            window.removeEventListener('keydown', onKey);
            hud.remove();
            pause.remove();
        },
    };
}
