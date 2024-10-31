CREATE TYPE authorization_status AS ENUM ('PENDING', 'ACKNOWLEDGED', 'NULLIFIED');

CREATE TABLE IF NOT EXISTS oauth2_authorization_request (
    id CHAR (36) PRIMARY KEY,
    code_verifier VARCHAR (150) UNIQUE NOT NULL,
	state VARCHAR (50) UNIQUE NOT NULL,
	authorization_code TEXT,
	status authorization_status NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth2_token (
    id CHAR (36) PRIMARY KEY,
	access_token TEXT,
	refresh_token TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);