"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var crypto = require("crypto");
function generateFileHash(filePath) {
    var fileData = fs.readFileSync(filePath);
    var hash = crypto.createHash('sha256').update(fileData).digest('hex');
    return hash;
}
function readRowsFromFile(filePath) {
    var fileContent = fs.readFileSync(filePath, 'utf-8');
    var rows = fileContent.split('\n').map(function (row) { return row.trim(); });
    return rows;
}
function readRowsTableFromFile(filePath) {
    var fileContent = fs.readFileSync(filePath, 'utf-8');
    var rows = fileContent.split('\n').map(function (row) { return row.trim(); });
    var tableStartIndex = rows.findIndex(function (row) { return row.startsWith('%TableStart:'); });
    return rows.slice(tableStartIndex + 1);
}
function generateUniqueId(fileName, fileHash) {
    var timestamp = Date.now().toString();
    var idString = "".concat(fileName, "-").concat(timestamp, "-").concat(fileHash);
    var hash = crypto.createHash('sha256');
    hash.update(idString);
    var uniqueId = hash.digest('hex');
    return uniqueId;
}
function calculateMean(values) {
    var sum = values.reduce(function (acc, val) { return acc + val; }, 0);
    var mean = sum / values.length;
    return mean;
}
function calculateStandardDeviation(values) {
    var mean = calculateMean(values);
    var squaredDifferences = values.map(function (val) { return Math.pow(val - mean, 2); });
    var sumOfSquaredDifferences = squaredDifferences.reduce(function (acc, val) { return acc + val; }, 0);
    var variance = sumOfSquaredDifferences / values.length;
    var standardDeviation = Math.sqrt(variance);
    return standardDeviation;
}
function generateStatistics(radarTable) {
    var statistics = {
        mean: {},
        min: {},
        max: {},
        standardDeviation: {},
    };
    for (var key in radarTable) {
        var values = radarTable[key];
        statistics.mean[key] = calculateMean(values);
        statistics.min[key] = Math.min.apply(Math, values);
        statistics.max[key] = Math.max.apply(Math, values);
        statistics.standardDeviation[key] = calculateStandardDeviation(values);
    }
    return statistics;
}
try {
    var filehash = generateFileHash('TOTL_IBIZ_2023_05_01_0000.tuv');
    // Read the TUV file synchronously
    // const data = fs.readFileSync('TOTL_IBIZ_2023_05_01_0000.tuv', 'utf8');
    var rows = readRowsFromFile('TOTL_IBIZ_2023_05_01_0000.tuv');
    var commonVariables = {};
    for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
        var row = rows_1[_i];
        var delimiterIndex = row.indexOf(':');
        if (delimiterIndex !== -1) {
            var key = row.slice(0, delimiterIndex).trim().replace(/^%/, '');
            var value = row.slice(delimiterIndex + 1).trim();
            if (key === "SiteSource") {
                continue;
            }
            commonVariables[key] = value;
        }
    }
    console.log(commonVariables);
    var tableRows = readRowsTableFromFile('TOTL_IBIZ_2023_05_01_0000.tuv');
    var colNames = [
        'Longitude', 'Latitude',
        'UComp',
        'VComp',
        'VectorFlag', 'UStdDev', 'VStdDev', 'Covariance',
        'XDistance',
        'YDistance',
        'Range', 'Bearing',
        'Velocity', 'Direction',
        'SiteContributers1', 'SiteContributers2', 'SiteContributers3',
        'SiteContributers4', 'SiteContributers5', 'SiteContributers6'
    ];
    var dataArray = tableRows.slice(2, -8);
    var radarTable = {};
    for (var _a = 0, colNames_1 = colNames; _a < colNames_1.length; _a++) {
        var colName = colNames_1[_a];
        radarTable[colName] = [];
    }
    for (var _b = 0, dataArray_1 = dataArray; _b < dataArray_1.length; _b++) {
        var data = dataArray_1[_b];
        var values = data.split(/\s+/);
        for (var i = 0; i < colNames.length; i++) {
            radarTable[colNames[i]].push(parseFloat(values[i]));
        }
    }
    var statistics = generateStatistics(radarTable);
    var uniqueId = generateUniqueId('TOTL_IBIZ_2023_05_01_0000.tuv', filehash);
    var owner = "SOCIB";
    console.log("ID", uniqueId);
    console.log("Owner", owner);
    console.log("Filehash", filehash);
    console.log("FileuniqueID", uniqueId);
    console.log("FileCreationTime", commonVariables["TimeStamp"]);
    console.log("CommonVariables", commonVariables);
    console.log("Longitude", radarTable["Longitude"]);
    console.log("Latitude", radarTable["Latitude"]);
    console.log("Time", commonVariables["ProcessedTimeStamp"]);
    console.log("Mean", statistics["mean"]);
    console.log("Min", statistics["min"]);
    console.log("Max", statistics["max"]);
    console.log("StandardDeviation", statistics["standardDeviation"]);
    console.log("NumberOfSeries", commonVariables["TableRows"]);
    console.log("SoftwareVersion", 1);
    console.log("Links", "");
}
catch (error) {
    console.error('Error reading the TUV file:', error);
}
