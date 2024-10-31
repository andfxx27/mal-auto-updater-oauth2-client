const crypto = require("crypto");

async function generateCodeVerifier() {
    const uppercaseCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercaseCharacters = uppercaseCharacters.toLowerCase();
    const digits = "0123456789";
    const specialCharacters = "-._~";

    const codeVerifierComponentOrder = ["uppercaseCharacters", "lowercaseCharacters", "digits", "specialCharacters"];
    let codeVerifierComponentCurrentIndex = 0;
    const codeVerifierLength = 43;
    let codeVerifier = "";

    const date = new Date().toISOString().replaceAll(":", ".");

    for (let i = 0; i < codeVerifierLength; i++) {
        const codeVerifierComponent = codeVerifierComponentOrder[codeVerifierComponentCurrentIndex];
        let randomIndex = 0;
        switch (codeVerifierComponent) {
            case "uppercaseCharacters":
                randomIndex = Math.floor(Math.random() * (uppercaseCharacters.length));
                codeVerifier += uppercaseCharacters[randomIndex];
                break;
            case "lowercaseCharacters":
                randomIndex = Math.floor(Math.random() * (lowercaseCharacters.length));
                codeVerifier += lowercaseCharacters[randomIndex];
                break;
            case "digits":
                randomIndex = Math.floor(Math.random() * (digits.length));
                codeVerifier += digits[randomIndex];
                break;
            case "specialCharacters":
                randomIndex = Math.floor(Math.random() * (specialCharacters.length));
                codeVerifier += specialCharacters[randomIndex];
                break;
        }

        codeVerifierComponentCurrentIndex++;
        if (codeVerifierComponentCurrentIndex === 4) {
            codeVerifierComponentCurrentIndex = 0;
        }
    }

    codeVerifier += date;

    return codeVerifier;
}

async function generateOauth2State() {
    return crypto.randomBytes(8).toString("hex") + process.env.MAL_API_OAUTH2_STATE;
}

module.exports = {
    generateCodeVerifier,
    generateOauth2State
};