# Cash session modes

Cash handling has two selectable session modes. Testing is the default and keeps
the existing timed scoring, cash builder, customer bill requests, feedback,
auto-continue, and reached-round history behavior.

Guided practice in the browser is untimed. Each question provides a customer
script, worked calculation, suggested response, answer instructions, and cash
breakdown. The learner still submits an answer through the normal scoring flow.
Impossible bill requests explain the flag or exact-cash fallback. Guidance is
cleared when starting a testing question. Saved rows and CSV include sessionMode.
History aggregate accuracy includes both modes; individual rows identify the mode.

In PowerShell, choose G at cash quiz setup for an untimed walkthrough before
starting the configured answer timer. Choose T or Enter for testing. The existing
typed and clickable controls remain available, and AnswerMode labels the session.
Other games retain their existing study and test flows.

Acceptance: cover exact, change, short, customer requests, mode switching,
submission, feedback, history persistence, and existing browser regression tests.
Private repositories run rule tests but skip public Pages deployment.
