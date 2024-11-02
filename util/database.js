const postgres = require("postgres");

function initializeSQLConnection(connString) {
    return postgres(connString);
}

module.exports = {
    initializeSQLConnection
};