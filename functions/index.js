const functions = require('firebase-functions');

const express = require('express');

const { getAllScreams, createScream } = require('./handlers/screams');
const { signup, login, FBAuth } = require('./handlers/authentication');



const app = express();

app.get('/screams', getAllScreams);
app.post('/screams', FBAuth, createScream);
// Sign-Up Route
app.post('/signup', signup);
app.post('/login', login);

exports.api = functions.https.onRequest(app);