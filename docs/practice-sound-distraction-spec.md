# Spec: Optional practice-mode distraction noises

## Objective

Add an off-by-default browser-only practice setting that produces continuous, level-changing synthetic noise during every timed practice mode: Cash Handling, Number Memory, Task Simulation, and Error Detection. It is a voluntary distraction aid, never an automatic sound effect.

## Tech stack and commands

The GitHub Pages trainer is dependency-free HTML, CSS, and JavaScript. Test with:

```powershell
& 'C:\Users\syg\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests\web-quiz-core.test.mjs
```

## Structure and style

- `index.html` owns one semantic, off-by-default opt-in control and an honest Windows mute limitation.
- `app.js` owns per-session settings and a small Web Audio implementation.
- `style.css` keeps the controls responsive and consistent with existing setup toggles.
- `tests/web-quiz-core.test.mjs` records the opt-in, safety, and mode-coverage contract.

Use named functions, a native input, and a looping 16-second Web Audio tonal collage from `distraction-sounds.mjs`. Alternate rhythmic and irregular phrases using chirps, warbles, two-tone alarms, buzzes, descending squeaks, and clangs; no static hiss. Randomly vary playback rate from 0.7 to 1.6 and gain among 0.009, 0.016, 0.027, and 0.04 while playing. The loop maintains playback even if browser timers are delayed. Each new quiz generates a fresh collage. Stop at the final answer or an explicit exit; no external samples, accounts, or runtime packages are added.

## Testing strategy

First add a failing deterministic test for the single-control contract, continuous start/stop lifecycle, and all four mode hooks. Then implement the smallest change that makes it pass. Perform a real-browser smoke with the option off and on, without relying on the browser to expose Windows settings.

## Boundaries

- Always: keep noises disabled by default, give the learner a clear Windows-mute limitation, cap in-page gain, stop on quiz completion or exit, and preserve existing modes when disabled.
- Ask first: any attempt to access operating-system settings, add a dependency, or modify the PowerShell application.
- Never: claim the website can read Windows 11 system mute, bypass browser autoplay rules, or play sound without an explicit user action.

## Success criteria

- The setup screen has one accessible, off-by-default sound option; no acknowledgement checkbox appears.
- The user is told that the website cannot verify Windows system mute.
- An enabled session starts one bounded, level-changing synthetic noise bed in each of the four practice modes and keeps it running through feedback, auto-advance, and question transitions.
- The sound stops immediately after the final answer (including timeout), at session results, or when the learner leaves the session. Cleanup disables pending audio starts as well as disconnecting active nodes.
- Audio setup begins from the Start Game click so it follows browser autoplay rules.
- The static test suite and real-browser smoke pass, and the GitHub Pages deployment receives the committed source.

## Implementation plan

1. Add the failing source-contract test.
2. Replace the acknowledgement gate with the one disabled-by-default setup control.
3. Add the compact looping Web Audio helper, invoke it at each practice-mode start, and stop it at session completion or exit.
4. Run tests, review the diff, exercise the page in a browser, then commit and push the approved work.

## Sources

- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API
- https://developer.mozilla.org/en-US/docs/Web/API/Audio_Output_Devices_API
