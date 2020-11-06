const functions = require('firebase-functions');
const admin = require('firebase-admin');
const firebase = require('firebase');

const express = require('express');


const app = express();
admin.initializeApp();

const firebaseConfig = {
    apiKey: "AIzaSyBnTF_5JmJ8AlC_gX5xa4yY82YKirSeDWw",
    authDomain: "social-media-app-2652f.firebaseapp.com",
    databaseURL: "https://social-media-app-2652f.firebaseio.com",
    projectId: "social-media-app-2652f",
    storageBucket: "social-media-app-2652f.appspot.com",
    messagingSenderId: "664497486434",
    appId: "1:664497486434:web:0f9462e9dda17a2fe1af3b",
    measurementId: "G-1VR1472NZX"
};

firebase.initializeApp(firebaseConfig);

const db = admin.firestore();

app.get('/screams', (req, res) => {
    // our functions needs access to DB, will be using adminSDK, import it, to use it we need to initialize
    // our application
    db.collection('screams').orderBy('createdAt', 'desc').get().then((data) => {
        let screams = [];
        data.forEach(doc => {
            screams.push({
                screamId: doc.id,
                ...doc.data()
            });
        });
        // res.json(screams);
        res.status(200).json(screams);
    }).catch((err) => console.error(err));
});


app.post('/screams', (req, res) => {
    const newScream = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        createdAt: new Date().toDateString()
    };

    db.collection('screams').add(newScream).then(doc => {
        res.json({ message: `document ${doc.id} created successfully` });
    }).catch(err => {
        res.status(500).json({ error: 'something went wrong' });
        console.error(err);
    })
});

// Sign-Up Route
app.post('/signup', (req, res) => {
    // Now we need to extract form data from req body
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    // TODO: Validate data
    let token, userId;
    db.doc(`/users/${newUser.handle}`).get().then(doc => {
        // even if the doc does not exist we will still have a snapshot
        if (doc.exists) {
            return res.status(400).json({ handle: 'This handle is already taken' });
        } else {
            return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
    }).then(data => {
        userId = data.user.uid;
        // we need to return a authentication token to the
        return data.user.getIdToken();
    }).then(idToken => {
        token = idToken;
        const userCredentials = {
            handle: newUser.handle,
            email: newUser.email,
            createdAt: new Date().toISOString(),
            userId
        };
        // persisting doc into user collection
        return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    }).then(() => {
        return res.status(201).json({ token });
    }).catch(err => {
        console.error(err);
        if (err.code === 'auth/email-already-in-use') {
            return res.status(400).json({ email: 'Email is already in use' });
        } else {
            return res.status(500).json({ error: err.code });
        }
    });
});

exports.api = functions.https.onRequest(app);