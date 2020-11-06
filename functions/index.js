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

const FBAuth = (req, res, next) => {
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No token found');
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // it is not enough that there is a token, we need to actually verify that this token was issued by 
    // our app. and not from somewhere else.
    admin.auth().verifyIdToken(idToken).then(decodedToken => {
        // this decoded token holds the data that is inside of our token and which is going to be user
        // data so we need to add this data to our request object so that when this request proceeds 
        // forward to 'POST /screams' our request there will have extra data that we have added from this
        // middleware in this case it is going to be user data
        req.user = decodedToken;
        console.log(decodedToken);
        return db.collection('users').where('userId', '==', req.user.uid).limit(1).get();
    }).then(data => {
        req.user.handle = data.docs[0].data().handle;
        return next();
    }).catch(err => {
        // if the token is either expired or blacklisted or from any other issue
        console.error('Error while verifying token', err);
        return res.status(403).json(err);
    });
}

app.post('/screams', FBAuth, (req, res) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({ body: 'Body must not be empty' });
    }

    const newScream = {
        body: req.body.body,
        userHandle: req.user.handle,
        createdAt: new Date().toDateString()
    };

    db.collection('screams').add(newScream).then(doc => {
        res.json({ message: `document ${doc.id} created successfully` });
    }).catch(err => {
        res.status(500).json({ error: 'something went wrong' });
        console.error(err);
    })
});

const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    if (email.match(regEx)) return true;
    else false;
}

const isEmpty = (string) => {
    if (string.trim() === '') return true;
    else return false;
}

// Sign-Up Route
app.post('/signup', (req, res) => {
    // STEP: extract form data from req body
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    // STEP: Validate data
    let errors = {};

    if (isEmpty(newUser.email)) {
        errors.email = 'Must not be empty';
    } else if (!isEmail(newUser.email)) {
        errors.email = 'Must be a valid email address';
    }

    if (isEmpty(newUser.password)) errors.password = 'Must not be empty';
    if (newUser.password !== newUser.confirmPassword) errors.confirmPassword = 'Passwords must match';
    if (isEmpty(newUser.handle)) errors.handle = 'Must not be empty';

    // we need to make sure that errors object is empty and we can proceed
    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    // STEP: Signing Up & returning token
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

app.post('/login', (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {};

    if (isEmpty(user.email)) errors.email = 'Must not be empty';
    if (isEmpty(user.password)) errors.password = 'Must not be empty';

    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password).then(data => {
        return data.user.getIdToken();
    }).then(token => {
        return res.status(200).json({ token });
    }).catch(err => {
        console.error(err);
        if (err.code === 'auth/wrong-password') {
            return res.status(403).json({ general: 'Wrong credentials, please try again' });
        } else return res.status(500).json({ error: err.code });
    });
});

exports.api = functions.https.onRequest(app);