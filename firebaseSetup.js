import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your complete Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwYtnta391lJqCanzObmpgqIqiSAJxNq4",
  authDomain: "adventist-tamil-tool.firebaseapp.com",
  databaseURL: "https://adventist-tamil-tool-default-rtdb.firebaseio.com/",
  projectId: "adventist-tamil-tool",
  storageBucket: "adventist-tamil-tool.firebasestorage.app",
  messagingSenderId: "7796354870",
  appId: "1:7796354870:web:4a104ef25bef118076cd97"
};

// Initialize Firebase and the Database
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
