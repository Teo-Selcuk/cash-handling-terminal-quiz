// Public identity selector, never a password. Firestore enforces this UID separately.
export const APPROVED_UID = 'OnQ06ebZW9QIV0BKhfeXgBvfheO2';
export const isApprovedUid = uid => uid === APPROVED_UID;
export const canPlayGame = (game,uid) => game !== 'fraud-inspection' || isApprovedUid(uid);
