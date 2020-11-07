const { db } = require('./../util/admin');


exports.getAllScreams = (req, res) => {
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
};


exports.createScream = (req, res) => {
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
};

exports.getScream = (req, res) => {
    let screamData = {};

    db.doc(`/screams/${req.params.screamId}`).get().then(doc => {
        if (!doc.exists) {
            return res.status(404).json({ error: 'Scream not found' });
        }
        screamData = doc.data();
        // now we want to add the id of scream to the data because we will need it later
        screamData.screamId = doc.id;
        return db.collection('comments').orderBy('createdAt', 'desc').where('screamId', '==', req.params.screamId).get();
    }).then(data => {
        // we get a query snapshot because this can be multiple docs 
        screamData.comments = [];
        data.forEach(doc => {
            screamData.comments.push(doc.data())
        });
        return res.json(screamData);
    }).catch(err => {
        console.error(err);
        res.status(500).json({ error: err.code });
    })
};

exports.commentOnScream = (req, res) => {
    if (req.body.body.trim() === '') return res.status(400).json({ error: 'Must not be empty' });

    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        screamId: req.params.screamId,
        userHandle: req.user.handle,
        // we do need to store the user image because later when we fetch the comment we dont want to
        // fetch the comments and then depending on the comment as well fetch depending on the user 
        // handle of the comment as well fetch the profile image of the user
        userImage: req.user.imageUrl
    };

    // we need to confirm if the scream exists
    db.doc(`/screams/${req.params.screamId}`).get().then(doc => {
        if (!doc.exists) {
            return res.status(404).json({ error: 'Scream not found' });
        }
        return db.collection('comments').add(newComment);
    }).then(() => {
        res.json(newComment);
    }).catch(err => {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    })
};