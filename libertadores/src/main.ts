import Phaser from 'phaser';
import { GAME_H, GAME_W } from './combat/types';
import { AudioManager } from './audio/AudioManager';
import { getSettings } from './systems/storage';
import { input } from './game/context';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { SettingsScene, RemapScene } from './scenes/SettingsScene';
import { HowToScene } from './scenes/HowToScene';
import { SelectScene } from './scenes/SelectScene';
import { SetupScene } from './scenes/SetupScene';
import { FightScene } from './scenes/FightScene';
import { TournamentScene } from './scenes/TournamentScene';
import { ResultsScene } from './scenes/ResultsScene';

const s = getSettings();
AudioManager.get().setVolumes({ master: s.master, sfx: s.sfx, music: s.music, voice: s.voice });
input.attach();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#050403',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: 'high-performance' },
  input: { gamepad: false, touch: true },
  scene: [BootScene, MenuScene, SettingsScene, RemapScene, HowToScene, SelectScene, SetupScene, FightScene, TournamentScene, ResultsScene],
});
// expose for debugging / automated tests
(window as unknown as { __game: Phaser.Game }).__game = game;
