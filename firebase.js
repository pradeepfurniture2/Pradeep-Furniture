// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcaWYO7AygVGPQJDJAp-eovL42zewZ8y0",
  authDomain: "pradeep-furniture.firebaseapp.com",
  projectId: "pradeep-furniture",
  storageBucket: "pradeep-furniture.firebasestorage.app",
  messagingSenderId: "441570353263",
  appId: "1:441570353263:web:e63a3798671f4169d36d9a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import { 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  OAuthProvider,
  TwitterAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('user:email');
export const twitterProvider = new TwitterAuthProvider();
