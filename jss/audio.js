"use strict";

/* ================= AUDIO SYSTEM ================= */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let isMuted = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type = 'sine', volume = 0.3, delay = 0) {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
  gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
}

function playNoise(duration, volume = 0.2, delay = 0) {
  if (!audioCtx || isMuted) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  source.connect(gain).connect(audioCtx.destination);
  source.start(audioCtx.currentTime + delay);
}

const SoundEffects = {
  click: () => { playTone(600, 0.1, 'square', 0.2); },
  select: () => { playTone(440, 0.12, 'sine', 0.3); playTone(660, 0.1, 'sine', 0.2, 0.1); },
  rotate: () => { playTone(330, 0.1, 'triangle', 0.3); playTone(550, 0.15, 'triangle', 0.25, 0.1); },
  dragStart: () => { playTone(220, 0.15, 'sawtooth', 0.2); playTone(330, 0.1, 'sawtooth', 0.15, 0.1); },
  dropValid: () => { playTone(523, 0.15, 'sine', 0.4); playTone(784, 0.2, 'sine', 0.3, 0.15); },
  dropInvalid: () => { playTone(150, 0.3, 'sawtooth', 0.3); playTone(100, 0.3, 'sawtooth', 0.2, 0.1); },
  drawCard: () => { playNoise(0.2, 0.2); playTone(500, 0.1, 'sine', 0.3, 0.1); },
  place: () => { playTone(392, 0.15, 'triangle', 0.35); playTone(523, 0.15, 'triangle', 0.3, 0.1); playTone(659, 0.2, 'triangle', 0.25, 0.2); },
  win: () => {
    playTone(523, 0.15, 'sine', 0.4); playTone(659, 0.15, 'sine', 0.4, 0.15);
    playTone(784, 0.15, 'sine', 0.4, 0.3); playTone(1046, 0.5, 'sine', 0.45, 0.45);
  },
  lose: () => {
    playTone(392, 0.2, 'sine', 0.4); playTone(330, 0.2, 'sine', 0.4, 0.2);
    playTone(262, 0.3, 'sine', 0.4, 0.4); playTone(196, 0.6, 'sine', 0.3, 0.6);
  },
  draw: () => {
    playTone(440, 0.2, 'sine', 0.3); playTone(392, 0.2, 'sine', 0.3, 0.15);
    playTone(349, 0.2, 'sine', 0.3, 0.3); playTone(330, 0.5, 'sine', 0.3, 0.45);
  },
  zoom: () => { playTone(700, 0.08, 'sine', 0.2); },
  pan: () => { playTone(500, 0.06, 'sine', 0.15); }
};

/* ================= MUSIK CHIPTUNE MENU ================= */
let menuMusicInterval = null;
let menuMusicPlaying = false;

function scheduleMenuNote(freq, time, duration, volume = 0.2, type = 'square') {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(time);
  osc.stop(time + duration);
}

function playMenuMusic() {
  if (menuMusicPlaying) return;
  if (!audioCtx) return;
  
  menuMusicPlaying = true;
  const notes = [
    { freq: 523.25, dur: 0.12 }, { freq: 659.25, dur: 0.12 }, { freq: 783.99, dur: 0.12 }, { freq: 880.00, dur: 0.24 },
    { freq: 783.99, dur: 0.12 }, { freq: 659.25, dur: 0.12 }, { freq: 523.25, dur: 0.12 }, { freq: 587.33, dur: 0.24 },
  ];
  
  let nextNoteTime = audioCtx.currentTime + 0.1;
  
  function scheduleLoop() {
    const now = audioCtx.currentTime;
    if (nextNoteTime < now) nextNoteTime = now + 0.1;
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const start = nextNoteTime + (i * 0.25);
      scheduleMenuNote(note.freq, start, note.dur);
    }
    nextNoteTime += notes.length * 0.25;
  }
  
  scheduleLoop();
  menuMusicInterval = setInterval(scheduleLoop, 2500);
}

function stopMenuMusic() {
  if (menuMusicInterval) { clearInterval(menuMusicInterval); menuMusicInterval = null; }
  menuMusicPlaying = false;
}

function toggleMute() {
  isMuted = !isMuted;
  const btn = document.querySelector('[style*="grid-area: mute"]');
  if (btn) btn.textContent = isMuted ? '🔇' : '🔊';
  if (isMuted) stopMenuMusic();
  else if (menuMusicPlaying) playMenuMusic();
  else {
    if (!document.getElementById('gameScreen').style.display || document.getElementById('gameScreen').style.display === 'none') playMenuMusic();
  }
}
