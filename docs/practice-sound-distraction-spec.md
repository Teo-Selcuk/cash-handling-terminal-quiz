# Spec: Optional practice-mode distraction noises

## Objective

Add an off-by-default browser-only practice setting that produces short, harsh synthetic noises during every timed practice mode: Cash Handling, Number Memory, Task Simulation, and Error Detection. It is a voluntary distraction aid, never an automatic sound effect.

## Tech stack and commands

The GitHub Pages trainer is dependency-free HTML, CSS, and JavaScript. Test with:

```powershell
& 'C:\Users\syg\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests\web-quiz-core.test.mjs
```

## Structure and style

- `index.html` owns semantic opt-in and safety acknowledgement controls.
- `app.js` owns per-session settings and a small Web Audio implementation.
- `style.css` keeps the controls responsive and consistent with existing setup toggles.
- `tests/web-quiz-core.test.mjs` records the opt-in, safety, and mode-coverage contract.

Use named functions, native inputs, and short Web Audio oscillator bursts. The audio graph must route through a capped `GainNode`; no external samples, accounts, or runtime packages are added.

## Testing strategy

First add a failing deterministic test for the control contract and all four mode hooks. Then implement the smallest change that makes it pass. Perform a real-browser smoke with the option off and with the safety acknowledgement on, without relying on the browser to expose Windows settings.

## Boundaries

- Always: keep noises disabled by default, give the learner a clear warning, cap in-page gain, and preserve existing modes when disabled.
- Ask first: any attempt to access operating-system settings, add a dependency, or modify the PowerShell application.
- Never: claim the website can read Windows 11 system mute, bypass browser autoplay rules, or play sound without an explicit user action.

## Success criteria

- The setup screen has an accessible, off-by-default sound option and per-session acknowledgement that the device has been muted or lowered.
- The user is told that the website cannot verify Windows system mute; without acknowledgement, the option remains inactive.
- An enabled session can generate bounded synthetic distraction bursts in each of the four practice modes.
- Audio setup begins from the Start Game click so it follows browser autoplay rules.
- The static test suite and real-browser smoke pass, and the GitHub Pages deployment receives the committed source.

## Implementation plan

1. Add the failing source-contract test.
2. Add the setup controls, disabled-by-default state, and acknowledgement gate.
3. Add the compact Web Audio burst helper and invoke it at each practice-mode start.
4. Run tests, review the diff, exercise the page in a browser, then commit and push the approved work.

## Sources

- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API
- https://developer.mozilla.org/en-US/docs/Web/API/Audio_Output_Devices_API
