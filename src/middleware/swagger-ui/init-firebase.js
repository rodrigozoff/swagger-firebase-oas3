(function() {

    async function loadJsonFirebaseConfig(url) {

        let obj = null;

        try {
            obj = await (await fetch(url)).json();
        } catch (e) {
            console.log('error');
        }

        return obj;
    }

    window.initFirebase = async() => {


        setTimeout(async() => {
            if (!$) {
                window.initFirebase();
                return;
            }
            var buttonLoggin = $(".authorize");
            if (!buttonLoggin) {
                window.initFirebase();
                return;
            }
            buttonLoggin = $(buttonLoggin);


            var urlbase = window.location.href.replace(/docs.*/, "");

            var urlJsonFirebase = urlbase + "/firebase-conf.json";

            const firebaseConfig = await loadJsonFirebaseConfig(urlJsonFirebase)

            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);

            var uiFirebase = new firebaseui.auth.AuthUI(firebase.auth());

            var uiFirebaseConfig = {
                callbacks: {
                    signInSuccessWithAuthResult: function(authResult, redirectUrl) {
                        // User successfully signed in.
                        // Return type determines whether we continue the redirect automatically
                        // or whether we leave that to developer to handle.
                        console.log(authResult);
                        return true;
                    },
                    uiShown: function() {
                        // The widget is rendered.
                        // Hide the loader.
                        //    document.getElementById('loader').style.display = 'none';
                    }
                },
                //Start it here 
                credentialHelper: firebaseui.auth.CredentialHelper.NONE,
                // Will use popup for IDP Providers sign-in flow instead of the default, redirect.
                signInFlow: 'popup',
                signInSuccessUrl: document.location.origin + document.location.pathname,
                signInOptions: [
                    firebase.auth.EmailAuthProvider.PROVIDER_ID,
                ],
                // Terms of service url.
                tosUrl: urlbase + "/tos.html",
                // Privacy policy url.
                privacyPolicyUrl: urlbase + "/privacyPolicy.html"
            };

            // The start method will wait until the DOM is loaded.

            var cloneLogin = buttonLoggin.clone();
            var cloneLogout = buttonLoggin.clone();

            cloneLogout.first("span").text("Logout");

            var padreBotones = buttonLoggin.parent();
            buttonLoggin.detach();

            cloneLogin.click(() => {
                cloneLogin.detach();
                uiFirebase.start('#firebaseui-auth-container', uiFirebaseConfig);
            });

            cloneLogout.click(() => {
                cloneLogout.detach();
                firebase.auth().signOut();
            });

            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    cloneLogin.detach();
                    cloneLogout.appendTo(padreBotones);
                    user.getIdToken().then(function(data) {
                        if (data) {
                            ui.preauthorizeApiKey("firebaseAuth", data);
                        }
                    });
                } else {
                    ui.preauthorizeApiKey("firebaseAuth", null);
                    cloneLogout.detach();
                    cloneLogin.appendTo(padreBotones);
                }
            });
        }, 2000);
    }
})();
window.initFirebase();