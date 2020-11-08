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
    return db.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'like',
                read: false,
                screamId: doc.id
            });
        }
    }).catch((err) => {
        console.error(err);
    });
});

exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}').onDelete((snapshot) => {
    return db.doc(`/notifications/${snapshot.id}`).delete().catch(err => {
        console.error(err);
        return;
    });
});

exports.createNotificationOnComment = functions.firestore.document('comments/{id}').onCreate((snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`).get().then(doc => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'comment',
                read: false,
                screamId: doc.id
            });
        }
    }).catch((err) => {
        console.error(err);
        return;
    });
});

exports.onUserImageChange = functions.firestore.document('/users/{userId}').onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
        console.log('image has changed');
        const batch = db.batch();
        return db.collection('screams').where('userHandle', '==', change.before.data().handle).get().then((data) => {
            data.forEach((doc) => {
                const scream = db.doc(`/screams/${doc.id}`);
                batch.update(scream, { userImage: change.after.data().imageUrl });
            });
            return batch.commit();
        });
    } else return true;
});

exports.onScreamDelete = functions.firestore.document('/screams/{screamId}').onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db.collection('comments').where('screamId', '==', screamId).get().then((data) => {
        data.forEach((doc) => {
            batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection('likes').where('screamId', '==', screamId).get();
    }).then((data) => {
        data.forEach((doc) => {
            batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db.collection('notifications').where('screamId', '==', screamId).get();
    }).then((data) => {
        data.forEach((doc) => {
            batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
    }).catch((err) => console.error(err));
});