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
import { createContext, stepContext } from "./MidiUtils";

function App() {
  const [piano, setPiano] = useState();
  const [midi, setMidi] = useState();
  const [context, setContext] = useState(createContext(null));

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
      piano.keyDown.bind(piano),
      piano.keyUp.bind(piano),
      piano.pedalDown.bind(piano),
      piano.pedalUp.bind(piano),
      setContext
    );
  }, [piano, context]);

  function renderHeader() {
    return (
      <header className="header">
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
      <section className="inputs">
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
    <div className="container">
      <Suspense fallback={<div>Loading...</div>}>
        {renderHeader()}
        {renderFileInput()}
        {renderPiano()}
      </Suspense>
    </div>
  );
}

export default App;
