const admin = require("firebase-admin");

exports.securizar = async(req, res, next) => {

    let servicioPublico = false;
    let rolesRequeridos = [];

    if (!req.openapi) {
        res.status(403).send('Unauthorized / Falta nodo OpenApi');
    }
    if (!req.openapi.schema || !req.openapi.schema.security) {
        //Servicio publico
        servicioPublico = true;
    }
    if (req.openapi.schema && req.openapi.schema && req.openapi.schema["x-security-roles"]) {
        rolesRequeridos = req.openapi.schema["x-security-roles"];
    }

    if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
        !(req.cookies && req.cookies.__session)) {
        if (servicioPublico) {
            console.log("Servicio publico / Sin Bear Token");
            return next();
        }

        console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
            'Make sure you authorize your request by providing the following HTTP header:',
            'Authorization: Bearer <Firebase ID Token>',
            'or by passing a "__session" cookie.');

        res.status(403).send('Unauthorized');
        return;
    }

    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        console.log('Found "Authorization" header');
        // Read the ID Token from the Authorization header.
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else if (req.cookies) {
        console.log('Found "__session" cookie');
        // Read the ID Token from cookie.
        idToken = req.cookies.__session;
    } else {
        if (servicioPublico) {
            console.log("Servicio publico / Sin Bear Token");
            return next();
        }
        // No cookie
        res.status(403).send('Unauthorized');
        return;
    }

    try {
        const decodedIdToken = await admin.auth().verifyIdToken(idToken);
        //console.log('ID Token correctly decoded', decodedIdToken);
        req.userRequest = decodedIdToken;

        //Verifiar la seguridad
        if (servicioPublico) {
            return next();
        }

        next();
        return;
    } catch (error) {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
        return;
    }
}