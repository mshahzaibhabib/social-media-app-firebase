const functions = require('firebase-functions');

const express = require('express');

const { getAllScreams, createScream } = require('./handlers/screams');
const { signup, login, uploadImage, FBAuth } = require('./handlers/authentication');



const app = express();

app.get('/screams', getAllScreams);
app.post('/screams', FBAuth, createScream);
// Sign-Up Route
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);

exports.api = functions.https.onRequest(app);