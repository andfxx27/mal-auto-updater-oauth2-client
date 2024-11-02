const express = require("express");
const axios = require("axios");
const schedule = require("node-schedule");
const {v4: uuidv4} = require("uuid");

const database = require("./util/database");
const logger = require("./util/logger");
const oauth2 = require("./util/oauth2");

const app = express();

app.use(express.json());

require("dotenv").config();

const port = process.env.SERVER_PORT || 3000;

const sql = database.initializeSQLConnection(process.env.DATABASE_CONN_STRING);
const log = logger.initializeLogger();

/*
* Endpoint for generating oauth2 authorization URL request.
*
* User need to allow authorization with MyAnimelist's oauth2 authorization server, before receiving oauth2 authorization code.
* */
app.post("/mal/oauth2-auth", async (req, res) => {
    log.info(`POST /mal/oauth2-auth starts executing at ${new Date()}!!!`);

    try {
        // Generate unique code verifier/ code challenge.
        const codeVerifier = await oauth2.generateCodeVerifier();

        // Get client id (generated from MAL API page).
        const clientId = process.env.MAL_API_CLIENT_ID;

        // Generate unique oauth2 state. For now, the state is hard coded from .env file.
        const state = await oauth2.generateOauth2State();

        // URI for MAL to redirects to after successful authentication.
        const redirectUri = process.env.MAL_API_OAUTH2_REDIRECT_URI;
        const oauth2AuthorizationURL = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&state=${state}&redirect_uri=${redirectUri}&code_challenge=${codeVerifier}&code_challenge_method=plain`;

        const id = uuidv4(null, null, null);
        await sql`
            insert into oauth2_authorization_request
                (id, code_verifier, state, status)
            values
                (${id}, ${codeVerifier}, ${state}, 'PENDING')
        `;

        log.info(`POST /mal/oauth2-auth finished executed [OK] at ${new Date()}!!!`);
        return res.status(200).json({
            "message": "Successfully request oauth2 authorization with MAL",
            "oauth2AuthorizationURL": oauth2AuthorizationURL
        });
    } catch (ex) {
        log.error(ex);
        log.info(`POST /mal/oauth2-auth finished executed [NOT OK] at ${new Date()}!!!`);

        return res.status(500).send({
            "message": "Failed to request oauth2 authorization with MAL"
        });
    }
});

/*
* Endpoint/ callback URL for receiving oauth2 authorization code from /mal/oauth2-auth endpoint.
* */
app.get("/mal/oauth2-auth/callback", async (req, res) => {
    log.info(`POST /mal/oauth2-auth/callback starts executing at ${new Date()}!!!`);

    try {
        const authorizationCode = req.query.code;
        const state = req.query.state;

        if (!authorizationCode) {
            return res.status(401).send({
                "message": "Failed to authenticate with MAL, oauth2 authorization code not exists.",
            });
        }

        if (!state) {
            return res.status(401).send({
                "message": "Failed to authenticate with MAL, oauth2 state not exists."
            });
        }

        const request = await sql`select * from oauth2_authorization_request where state = ${state}`;
        if (!request) {
            return res.status(401).send({
                "message": "Failed to authenticate with MAL, invalid authorization code or state",
            });
        }

        await sql`
            update oauth2_authorization_request
                set
            authorization_code = ${authorizationCode},
            status = 'ACKNOWLEDGED',
            updated_at = ${new Date()}
            where state = ${state}
        `;

        log.info(`POST /mal/oauth2-auth/callback finished executed [OK] at ${new Date()}!!!`);
        return res.status(200).send({
            "message": "Successfully authenticated with MAL",
            "code": authorizationCode,
            "state": state
        });
    } catch (ex) {
        log.error(ex);
        log.info(`POST /mal/oauth2-auth/callback finished executed [NOT OK] at ${new Date()}!!!`);

        return res.status(401).send({
            "message": "Failed to authenticate with MAL."
        });
    }
});

/*
* Endpoint for exchanging oauth2 authorization code with access and refresh token.
* */
app.post("/mal/oauth2-auth/token", async (req, res) => {
    log.info(`POST /mal/oauth2-auth/token starts executing at ${new Date()}!!!`);

    try {
        const reqBody = req.body;
        if (!reqBody.grant_type) {
            return res.status(400).send({
                "message": "Invalid oauth2 token request body",
            });
        }

        // Get the last oauth2 authorization request which status is already updated successfully
        const request = await sql`
            select * from oauth2_authorization_request 
            where updated_at is not null
            and status = 'ACKNOWLEDGED'
            order by updated_at desc
            limit 1
        `;

        const {
            code_verifier,
            authorization_code,
        } = request[0];

        const finalReqBody = {
            client_id: process.env.MAL_API_CLIENT_ID,
            client_secret: process.env.MAL_API_CLIENT_SECRET,
            grant_type: reqBody.grant_type,
            code: authorization_code,
            redirect_uri: process.env.MAL_API_OAUTH2_REDIRECT_URI,
            code_verifier: code_verifier,
        };

        const response = await axios.post("https://myanimelist.net/v1/oauth2/token", new URLSearchParams(finalReqBody));

        const {
            access_token,
            refresh_token
        } = response.data;

        const id = uuidv4(null, null, null);
        await sql`
            insert into oauth2_token
                (id, access_token, refresh_token)
            values
                (${id}, ${access_token}, ${refresh_token})
        `;

        log.info(`POST /mal/oauth2-auth/token finished executed [OK] at ${new Date()}!!!`);
        return res.status(200).send({
            "message": "MAL Oauth2 token OK",
            "result": response.data,
        });
    } catch (ex) {
        log.error(ex);
        log.info(`POST /mal/oauth2-auth/token finished executed [NOT OK] at ${new Date()}!!!`);

        return res.status(401).send({
            "message": "MAL Oauth2 token Not OK",
        });
    }
});

async function refreshToken(grantType) {
    // Get the last oauth2 token from the most recent success authentication request
    const token = await sql`
        select * from oauth2_token 
        order by created_at desc
        limit 1
    `;
    if (token.length === 0) {
        throw new Error("Failed to refresh token, no token found!");
    }

    const {
        refresh_token,
    } = token[0];

    const finalReqBody = {
        client_id: process.env.MAL_API_CLIENT_ID,
        client_secret: process.env.MAL_API_CLIENT_SECRET,
        grant_type: grantType,
        refresh_token: refresh_token,
    };

    const response = await axios.post(process.env.MAL_API_OAUTH2_TOKEN_URI, new URLSearchParams(finalReqBody));

    const {
        access_token,
        refresh_token: refreshToken
    } = response.data;

    const id = uuidv4(null, null, null);
    await sql`
        insert into oauth2_token
            (id, access_token, refresh_token)
        values
            (${id}, ${access_token}, ${refreshToken})
    `;

    return response;
}

/*
* Endpoint for refreshing oauth2 token
* */
app.post("/mal/oauth2-auth/token-refresh", async (req, res) => {
    log.info(`POST /mal/oauth2-auth/token-refresh starts executing at ${new Date()}!!!`);

    try {
        const reqBody = req.body;
        if (!reqBody.grant_type) {
            return res.status(400).send({
                "message": "Invalid oauth2 token request body",
            });
        }

        const response = await refreshToken(reqBody.grant_type);

        log.info(`POST /mal/oauth2-auth/token-refresh finished executed [OK] at ${new Date()}!!!`);
        return res.status(200).send({
            "message": "Successfully refreshed oauth2 token",
            "result": response.data,
        });
    } catch (ex) {
        log.error(ex);
        log.info(`POST /mal/oauth2-auth/token-refresh finished executed [NOT OK] at ${new Date()}!!!`);

        return res.status(401).send({
            "message": "Failed to refresh oauth2 token"
        });
    }
});

/*
* Scheduler for automatically refreshing the oauth2 token every sunday
* */
const jobRefreshOauth2Token = schedule.scheduleJob("* * * * * 7", async function (execDate) {
    log.info(`Job refresh oauth2 token is running at ${execDate}!!!`);

    try {
        await refreshToken(process.env.MAL_API_OAUTH2_REFRESH_TOKEN_GRANT_TYPE);

        log.error(`Job refresh oauth2 token finished executed [OK] at ${new Date()}!!!`);
    } catch (ex) {
        log.error(ex);
        log.error(`Job refresh oauth2 token finished executed [NOT OK] at ${new Date()}!!!`);
    }
});

app.listen(port, () => log.info(`Server started on port ${port}`));