const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const express = require('express');
const app = express();

app.get('/screams', (req, res) => {
    // our functions needs access to DB, will be using adminSDK, import it, to use it we need to initialize
    // our application
    admin.firestore().collection('screams').orderBy('createdAt', 'desc').get().then((data) => {
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

    admin.firestore().collection('screams').add(newScream).then(doc => {
        res.json({ message: `document ${doc.id} created successfully` });
    }).catch(err => {
        res.status(500).json({ error: 'something went wrong' });
        console.error(err);
    })
})

exports.api = functions.https.onRequest(app);