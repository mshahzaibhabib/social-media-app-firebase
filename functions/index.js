const functions = require('firebase-functions');

const express = require('express');

const { getAllScreams, createScream } = require('./handlers/screams');
const { FBAuth, signup, login, uploadImage, addUserDetails, getAuthenticatedUser } = require('./handlers/authentication');



const app = express();

// Scream Routes
app.get('/screams', getAllScreams);
app.post('/screams', FBAuth, createScream);
// User Routes
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
// Authentication Routes
app.post('/signup', signup);
app.post('/login', login);

exports.api = functions.https.onRequest(app);