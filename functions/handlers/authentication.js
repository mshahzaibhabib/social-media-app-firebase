const firebase = require('firebase');

const { db, admin } = require('./../util/admin');
const config = require('./../util/config');
const { validateSignupData, validateLoginData, reduceUserDetails } = require('./../util/validators');


firebase.initializeApp(config);

exports.signup = (req, res) => {
    // STEP: extract form data from req body
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    // STEP: Validate data
    const { valid, errors } = validateSignupData(newUser);

    if (!valid) return res.status(400).json(errors);

    const noImage = 'no-image.png';

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
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImage}?alt=media`,
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
};

exports.login = (req, res) => {
    // STEP: extract form data from req body
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    // STEP: Validate data
    const { valid, errors } = validateLoginData(user);

    if (!valid) return res.status(400).json(errors);

    // STEP: Logging in & returning token
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
};

exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);

    // look for the document for that user
    db.doc(`/users/${req.user.handle}`).update(userDetails).then(() => {
        return res.json({ message: 'Details added successfully' });
    }).catch(err => {
        console.error(err);
        return res.status(500).json({ errors: err.code });
    });
};

exports.getAuthenticatedUser = (req, res) => {
    let userData = {};

    db.doc(`/users/${req.user.handle}`).get().then(doc => {
        if (doc.exists) {
            userData.credentials = doc.data();
            // get the likes of that user
            return db.collection('likes').where('userHandle', '==', req.user.handle).get();
        }
    }).then(data => {
        userData.likes = [];
        data.forEach(doc => {
            userData.likes.push(doc.data());
        });
        return res.json(userData);
    }).catch(err => {
        console.error(err);
        res.status(500).json({ error: err.code });
    })
};

exports.uploadImage = (req, res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = new BusBoy({ headers: req.headers });

    let imageFileName;
    let imageToBeUploaded;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        // we dont want files other than .png or .jpeg
        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.status(400).json({ error: 'Wrong file type submitted' });
        }
        console.log(fieldname);
        console.log(filename);
        console.log(mimetype);
        // image.png we need to get the png
        const imageExtension = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${Math.round(Math.random() * 100000000000)}.${imageExtension}`;
        const filePath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filePath, mimetype };
        file.pipe(fs.createWriteStream(filePath));
    });

    busboy.on('finish', () => {
        // here we upload the file we created
        admin.storage().bucket().upload(imageToBeUploaded.filePath, {
            // options object
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imageToBeUploaded.mimetype
                }
            }
        }).then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
            // we need to add this image URL in the user document
            return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
        }).then(() => {
            return res.json({ message: 'Image uploaded successfully' });
        }).catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
    });

    busboy.end(req.rawBody);
};

exports.FBAuth = (req, res, next) => {
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
        req.user.imageUrl = data.docs[0].data().imageUrl;
        return next();
    }).catch(err => {
        // if the token is either expired or blacklisted or from any other issue
        console.error('Error while verifying token', err);
        return res.status(403).json(err);
    });
};