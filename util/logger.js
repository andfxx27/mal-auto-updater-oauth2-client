const winston = require("winston");
require("winston-daily-rotate-file");

function initializeLogger() {
    const transport = new winston.transports.DailyRotateFile({
        level: "info",
        filename: "logs/application-%DATE%.log",
        datePattern: "YYYY-MM-DD-HH",
        zippedArchive: true,
        maxSize: "20m",
    });

    return winston.createLogger({
        level: "info",
        transports: [
            new winston.transports.Console(),
            transport
        ]
    });
}

module.exports = {
    initializeLogger
};