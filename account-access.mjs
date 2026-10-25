// Public identity selector, never a password. Firestore enforces this UID separately.
export const APPROVED_UID = 'OnQ06ebZW9QIV0BKhfeXgBvfheO2';
export const isApprovedUid = uid => uid === APPROVED_UID;
// Games that need a signed-in, approved account.
export const SIGNED_IN_GAMES = Object.freeze(['fraud-inspection', 'holds-verification']);
export const canPlayGame = (game,uid) => !SIGNED_IN_GAMES.includes(game) || isApprovedUid(uid);
