// Public web app identifiers. Database access is controlled by Firestore rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyCIBt-796pe14nd0WpOYsklMasqMLGfMlk',
  authDomain: 'cash-handling-quiz.firebaseapp.com',
  projectId: 'cash-handling-quiz',
  storageBucket: 'cash-handling-quiz.firebasestorage.app',
  messagingSenderId: '534385557401',
  appId: '1:534385557401:web:a65be2674f3240e29d9d08',
};
// Verified against the project's admin configuration during deployment.
export const authProviders = { emailPassword: true, google: false };
