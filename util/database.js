const postgres = require("postgres");

function initializeSQLConnection() {
    return postgres("postgres://postgres:superuser@localhost:5432/db-mal-auto-updater");
}

module.exports = {
    initializeSQLConnection
};