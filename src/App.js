import { FaPause } from "@react-icons/all-files/fa/FaPause";
import { FaPlay } from "@react-icons/all-files/fa/FaPlay";
import { Midi } from "@tonejs/midi";
import { Piano as TonePiano } from "@tonejs/piano";
import React, {
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Piano as EtudePiano } from "react-etude-piano";
import "./App.css";
import {
  clearIntermediateContext,
  createContext,
  setContextPaused,
  skipContext,
  stepContext,
} from "./MidiUtils";

function App() {
  const [piano, setPiano] = useState();
  const [midi, setMidi] = useState();
  const [context, setContext] = useState(createContext(null));
  const [volume, setVolume] = useState(1);

  const pressPitch = useCallback(
    (pitch) => {
      piano.keyDown({ midi: pitch.getProgramNumber() });
    },
    [piano]
  );

  const releasePitch = useCallback(
    (pitch) => {
      piano.keyUp({ midi: pitch.getProgramNumber() });
    },
    [piano]
  );

  const Piano = useMemo(() => {
    return lazy(async () => {
      if (piano == null) {
        const piano = await getPiano();
        setPiano(piano);
      }
      return { default: EtudePiano };
    });
  }, [piano]);

  async function getPiano() {
    const piano = new TonePiano({ maxPolyphony: Infinity });
    piano.toDestination();
    await piano.load();

    return piano;
  }

  useMemo(() => {
    if (midi == null) {
      return;
    }

    setContext(createContext(midi));
  }, [midi]);

  useEffect(() => {
    if (piano == null) {
      return;
    }

    return stepContext(
      context,
      (key) => piano.keyDown({ ...key, velocity: key.velocity * volume }),
      (key) => piano.keyUp({ ...key, velocity: key.velocity * volume }),
      piano.pedalDown.bind(piano),
      piano.pedalUp.bind(piano),
      setContext
    );
  }, [piano, context, volume]);

  function renderHeader() {
    return (
      <header className="header flex-column justify-center align-center">
        <h1>Pianola</h1>
        <span>
          <label>by </label>
          <a
            href="https://andrewhan.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            andrewhan
          </a>
        </span>
      </header>
    );
  }

  function renderFileInput() {
    async function handleUpload(e) {
      const file = e.target.files[0];
      if (file == null) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setMidi(new Midi(reader.result));
      reader.readAsArrayBuffer(file);
    }

    return (
      <section className="flex-column justify-center align-center">
        <label>Upload MIDI file:</label>
        <input
          className="file-input"
          type="file"
          accept=".mid"
          onChange={handleUpload}
        />
      </section>
    );
  }

  function renderMediaControls() {
    if (midi == null) {
      return;
    }

    function handleScrubChange(e) {
      clearIntermediateContext(
        context,
        (key) => piano.keyUp({ ...key, velocity: key.velocity * volume }),
        piano.pedalUp.bind(piano),
        setContext
      );

      const scrubIndex = parseInt(e.target.value);
      skipContext(context, scrubIndex, setContext);
    }

    function handlePlaybackButton() {
      setContextPaused(context, !context.paused, setContext);
    }

    function handleVolumeChange(e) {
      const volume = parseFloat(e.target.value);
      setVolume(volume);
    }

    return (
      <section className="flex-column justify-center align-stretch">
        <section className="media-control flex-column justify-center align-stretch">
          <section className="flex-row">
            <button className="icon-button" onClick={handlePlaybackButton}>
              {context.paused ? <FaPlay /> : <FaPause />}
            </button>
            <section className="flex-column justify-stretch flex">
              <label>
                Progress: {context.index}/{context.actions.length}
              </label>
              <input
                type="range"
                className="scrubber"
                value={context.index}
                min={0}
                max={context.actions.length - 1}
                onChange={handleScrubChange}
              />
            </section>
          </section>
        </section>
        <section className="media-control flex-column justify-center align-stretch">
          <label>Volume: {Math.round(volume * 100)}%</label>
          <input
            type="range"
            className="volume"
            value={volume}
            min={0}
            max={1}
            step="any"
            onChange={handleVolumeChange}
          />
        </section>
      </section>
    );
  }

  function renderPiano() {
    return (
      <Fragment>
        <Piano
          className="piano"
          start="A0"
          end="C8"
          onKeyPress={pressPitch}
          onKeyRelease={releasePitch}
          highlight={[...context.pressedNotes]}
        />
        <div className={context.sustain ? "pedal-down" : "pedal-up"}>
          Sustain pedal
        </div>
      </Fragment>
    );
  }

  return (
    <div className="container flex-column align-center">
      <Suspense fallback={<div>Loading...</div>}>
        {renderHeader()}
        {renderFileInput()}
        {renderMediaControls()}
        {renderPiano()}
      </Suspense>
    </div>
  );
}

export default App;
