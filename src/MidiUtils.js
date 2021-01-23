import { now } from "tone";
import { theory } from "etude";

const { Pitch } = theory;

export const Action = Object.freeze({
  RELEASE_SUSTAIN_PEDAL: 0,
  PRESS_SUSTAIN_PEDAL: 1,
  RELEASE_KEY: 2,
  PRESS_KEY: 3,
});

export function getActions(midi) {
  if (midi == null) {
    return [];
  }

  const notes = midi.tracks.map((track) => track.notes).flat();

  const notesDownByTime = notes.reduce((r, note) => {
    const key = note.time;
    r[key] = r[key] || [];
    r[key].push(note);
    return r;
  }, {});
  const notesDown = Object.keys(notesDownByTime).map((time) => ({
    time: parseFloat(time),
    action: Action.PRESS_KEY,
    notes: notesDownByTime[time].map(({ name, midi, velocity }) => ({
      name,
      midi,
      velocity,
    })),
  }));

  const notesUpByTime = notes.reduce((r, note) => {
    const key = note.time + note.duration;
    r[key] = r[key] || [];
    r[key].push(note);
    return r;
  }, {});
  const notesUp = Object.keys(notesUpByTime).map((time) => ({
    time: parseFloat(time),
    action: Action.RELEASE_KEY,
    notes: notesUpByTime[time].map(({ name, midi, velocity }) => ({
      name,
      midi,
      velocity,
    })),
  }));

  const sustainPedals = Array.from(
    midi.tracks
      .map((track) => track.controlChanges)
      .map((controlChanges) => controlChanges[64])
      .filter((o) => o != null)
      .flat()
  ).map(({ time, value }) => ({
    time,
    action:
      value === 0 ? Action.RELEASE_SUSTAIN_PEDAL : Action.PRESS_SUSTAIN_PEDAL,
  }));

  const actions = [...notesDown, ...notesUp, ...sustainPedals].sort((a, b) => {
    if (a.time !== b.time) {
      return a.time - b.time;
    }

    if (a.action !== b.action) {
      return a.action - b.action;
    }

    return 0;
  });

  return actions;
}

export function createContext(midi) {
  const actions = getActions(midi);
  return {
    actions,
    pressedNotes: new Set(),
    sustain: false,
    index: 0,
    startTime: now(),
  };
}

export function stepContext(
  context,
  pressKey,
  releaseKey,
  pressSustainPedal,
  releaseSustainPedal,
  setNextContext
) {
  const { actions, pressedNotes, sustain, index, startTime } = context;

  if (actions == null) {
    return;
  }

  if (index < 0 || index >= actions.length) {
    return;
  }

  const { time, action, notes } = actions[index];
  const id = setTimeout(() => {
    let nextSustain = sustain;
    switch (action) {
      case Action.PRESS_KEY:
        notes.forEach(({ name, midi, velocity }) => {
          pressedNotes.add(name);
          pressKey({ name, midi, velocity });
        });
        break;
      case Action.RELEASE_KEY:
        notes.forEach(({ name, midi, velocity }) => {
          pressedNotes.delete(name);
          releaseKey({ name, midi, velocity });
        });
        break;
      case Action.PRESS_SUSTAIN_PEDAL:
        nextSustain = true;
        pressSustainPedal();
        break;
      case Action.RELEASE_SUSTAIN_PEDAL:
        nextSustain = false;
        releaseSustainPedal();
        break;
      default:
        throw new Error(`Unrecognized action: ${action}`);
    }

    setNextContext({
      ...context,
      sustain: nextSustain,
      index: index + 1,
    });
  }, (time - (now() - startTime)) * 1000);

  return () => clearTimeout(id);
}

export function clearIntermediateContext(
  context,
  releaseKey,
  releasePedal,
  setNextContext
) {
  const { pressedNotes, sustain } = context;
  pressedNotes.forEach((name) =>
    releaseKey({
      name,
      midi: Pitch.fromString(name).get().getProgramNumber(),
    })
  );
  if (sustain) {
    releasePedal();
  }

  pressedNotes.clear();

  setNextContext({
    ...context,
    sustain: false,
    index: -1,
    startTime: now(),
  });
}

export function skipContext(context, index, setNextContext) {
  const { actions } = context;

  setNextContext({
    ...context,
    startTime: now() - actions[index].time - 0.1,
    index,
  });
}
