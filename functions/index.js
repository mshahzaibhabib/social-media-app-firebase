const functions = require('firebase-functions');

const express = require('express');

const { getAllScreams, createScream, getScream, commentOnScream, likeScream, unlikeScream, deleteScream } = require('./handlers/screams');
const { FBAuth, signup, login, uploadImage, addUserDetails, getAuthenticatedUser } = require('./handlers/authentication');



const app = express();

// Scream Routes
app.get('/screams', getAllScreams);
app.post('/screams', FBAuth, createScream);
app.get('/screams/:screamId', getScream);
app.post('/screams/:screamId/comments', FBAuth, commentOnScream);
app.get('/screams/:screamId/like', FBAuth, likeScream);
app.get('/screams/:screamId/unlike', FBAuth, unlikeScream);
app.delete('/screams/:screamId', FBAuth, deleteScream);

// User Routes
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
// Authentication Routes
app.post('/signup', signup);
app.post('/login', login);

exports.api = functions.https.onRequest(app);