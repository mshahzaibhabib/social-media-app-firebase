const functions = require('firebase-functions');

const express = require('express');

const { db } = require('./util/admin');
const { getAllScreams, createScream, getScream, commentOnScream, likeScream, unlikeScream, deleteScream } = require('./handlers/screams');
const { FBAuth, signup, login, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead } = require('./handlers/authentication');



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
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);
// Authentication Routes
app.post('/signup', signup);
app.post('/login', login);

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions.firestore.document('likes/{id}').onCreate((snapshot) => {
    db.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
        if (doc.exists) {
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'like',
                read: false,
                screamId: doc.id
            });
        }
    }).then(() => {
        return;
    }).catch((err) => {
        console.error(err);
        return;
    });
});

exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}').onDelete((snapshot) => {
    db.doc(`/notifications/${snapshot.id}`).delete().then(() => {
        return;
    }).catch(err => {
        console.error(err);
        return;
    });
});

exports.createNotificationOnComment = functions.firestore.document('comments/{id}').onCreate((snapshot) => {
    db.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
        if (doc.exists) {
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'comment',
                read: false,
                screamId: doc.id
            });
        }
    }).then(() => {
        return;
    }).catch((err) => {
        console.error(err);
        return;
    });
});