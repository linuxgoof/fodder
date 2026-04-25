import { Container, Text } from 'pixi.js';

export class Narrator {
  container: Container;
  private text: Text;
  private showUntil = 0;
  private fadeMs = 1500;
  private holdMs = 4500;

  constructor() {
    this.container = new Container();
    this.text = new Text({
      text: '',
      style: {
        fontFamily: 'Georgia, serif',
        fontSize: 22,
        fill: 0xcccccc,
        fontStyle: 'italic',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 700,
      },
    });
    this.text.anchor.set(0.5, 0.5);
    this.text.alpha = 0;
    this.container.addChild(this.text);
  }

  say(line: string) {
    this.text.text = line;
    this.showUntil = performance.now() + this.holdMs + this.fadeMs;
  }

  update(now: number, screenW: number, screenH: number) {
    this.text.x = screenW / 2;
    this.text.y = screenH - 80;

    const remaining = this.showUntil - now;
    if (remaining <= 0) {
      this.text.alpha = 0;
      return;
    }
    if (remaining < this.fadeMs) {
      // Fading out.
      this.text.alpha = remaining / this.fadeMs;
    } else if (remaining > this.holdMs) {
      // Fading in.
      const fadeIn = this.fadeMs - (remaining - this.holdMs);
      this.text.alpha = Math.max(0, Math.min(1, fadeIn / this.fadeMs));
    } else {
      this.text.alpha = 1;
    }
  }
}
