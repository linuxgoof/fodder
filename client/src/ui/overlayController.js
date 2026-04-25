import { tutorialSections, tutorialTitle } from '../tutorialContent';
const TUTORIAL_HTML = `
  <h2 class="fodder-overlay__h2" id="tutorialHead">${tutorialTitle}</h2>
  <div class="fodder-tutorial" id="tutorialBody"></div>
`;
/**
 * Binds DOM for splash + tutorial; returns a function to show sections.
 */
export function mountOverlays(onPlay) {
    const root = document.getElementById('fodder-ui');
    if (!root)
        throw new Error('missing #fodder-ui');
    root.innerHTML = `
    <div class="fodder-splash" id="fodderSplash" aria-hidden="false">
      <div class="fodder-splash__inner">
        <h1 class="fodder-splash__title">fodder</h1>
        <p class="fodder-splash__sub">a climb that remembers</p>
        <div class="fodder-splash__actions">
          <button type="button" class="fodder-btn fodder-btn--primary" id="fodderPlay">play</button>
          <button type="button" class="fodder-btn fodder-btn--ghost" id="fodderTutorialOpen">how to climb</button>
        </div>
      </div>
    </div>
    <div class="fodder-overlay fodder-overlay--hidden" id="fodderTutorial" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="tutorialHead">
      <div class="fodder-overlay__card">
        ${TUTORIAL_HTML}
        <div class="fodder-overlay__row">
          <button type="button" class="fodder-btn fodder-btn--ghost" id="fodderTutorialBack">back</button>
          <button type="button" class="fodder-btn fodder-btn--primary" id="fodderPlayFromTutorial">play</button>
        </div>
      </div>
    </div>
  `;
    const tutorial = document.getElementById('fodderTutorial');
    const tutorialBody = document.getElementById('tutorialBody');
    const play = document.getElementById('fodderPlay');
    const openTut = document.getElementById('fodderTutorialOpen');
    const backTut = document.getElementById('fodderTutorialBack');
    const playTut = document.getElementById('fodderPlayFromTutorial');
    function buildTutorial() {
        tutorialBody.innerHTML = tutorialSections
            .map((s) => `
      <section class="fodder-tutorial__sec">
        <h3 class="fodder-tutorial__h">${escapeHtml(s.title)}</h3>
        <div class="fodder-tutorial__p">${formatBody(s.body)}</div>
      </section>
    `)
            .join('');
    }
    const onPlayClick = (e) => {
        e.preventDefault();
        onPlay();
    };
    const onOpenTutorial = (e) => {
        e.preventDefault();
        buildTutorial();
        tutorial.classList.remove('fodder-overlay--hidden');
        tutorial.setAttribute('aria-hidden', 'false');
    };
    const onBackTutorial = (e) => {
        e.preventDefault();
        tutorial.classList.add('fodder-overlay--hidden');
        tutorial.setAttribute('aria-hidden', 'true');
    };
    play.addEventListener('click', onPlayClick);
    playTut.addEventListener('click', onPlayClick);
    openTut.addEventListener('click', onOpenTutorial);
    backTut.addEventListener('click', onBackTutorial);
    return {
        destroy() {
            play.removeEventListener('click', onPlayClick);
            playTut.removeEventListener('click', onPlayClick);
            openTut.removeEventListener('click', onOpenTutorial);
            backTut.removeEventListener('click', onBackTutorial);
            root.innerHTML = '';
        },
    };
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function formatBody(s) {
    return escapeHtml(s)
        .split('\n\n')
        .map((p) => `<p>${p.replace(/\n/g, ' ')}</p>`)
        .join('');
}
