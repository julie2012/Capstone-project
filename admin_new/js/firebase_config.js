// js/firebase_config.js
const firebaseConfig = {
    apiKey: "AIzaSyAlIYMnR-XkQgpffpBYHca0NugpZicfatA",
    authDomain: "entrance-exam-a5625.firebaseapp.com",
    databaseURL: "https://entrance-exam-a5625-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "entrance-exam-a5625",
    storageBucket: "entrance-exam-a5625.firebasestorage.app",
    messagingSenderId: "714388520551",
    appId: "1:714388520551:web:3332dd2cac709880f59ec2"
};

// I-initialize ang Firebase
firebase.initializeApp(firebaseConfig);

// GUMAWA NG GLOBAL REFERENCE PARA SA IBANG JS FILES
window.db = firebase.database(); 
console.log("Firebase Global Connection Established!");