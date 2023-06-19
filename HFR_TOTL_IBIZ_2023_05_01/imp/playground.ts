import * as fs from 'fs';
import * as crypto from 'crypto';


function generateFileHash(filePath: string): string {
    const fileData = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileData).digest('hex');
    return hash;
}

function readRowsFromFile(filePath: string): string[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rows = fileContent.split('\n').map(row => row.trim());
    return rows;
}

function readRowsTableFromFile(filePath: string): string[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rows = fileContent.split('\n').map(row => row.trim());
    const tableStartIndex = rows.findIndex(row => row.startsWith('%TableStart:'));
    return rows.slice(tableStartIndex + 1);
}

function generateUniqueId(fileName: string, fileHash: string): string {
    const timestamp = Date.now().toString();
    const idString = `${fileName}-${timestamp}-${fileHash}`;

    const hash = crypto.createHash('sha256');
    hash.update(idString);
    const uniqueId = hash.digest('hex');

    return uniqueId;
}

function calculateMean(values: number[]): number {
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    return mean;
}

function calculateStandardDeviation(values: number[]): number {
    const mean = calculateMean(values);
    const squaredDifferences = values.map((val) => Math.pow(val - mean, 2));
    const sumOfSquaredDifferences = squaredDifferences.reduce((acc, val) => acc + val, 0);
    const variance = sumOfSquaredDifferences / values.length;
    const standardDeviation = Math.sqrt(variance);
    return standardDeviation;
}

type Statistics = {
    mean: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
    standardDeviation: Record<string, number>;
};

function generateStatistics(radarTable: Record<string, number[]>): Statistics {
    const statistics: Statistics = {
        mean: {},
        min: {},
        max: {},
        standardDeviation: {},
    };

    for (const key in radarTable) {
        const values = radarTable[key];
        statistics.mean[key] = calculateMean(values);
        statistics.min[key] = Math.min(...values);
        statistics.max[key] = Math.max(...values);
        statistics.standardDeviation[key] = calculateStandardDeviation(values);
    }

    return statistics;
}


try {
    const filehash = generateFileHash('TOTL_IBIZ_2023_05_01_0000.tuv')

    // Read the TUV file synchronously
    // const data = fs.readFileSync('TOTL_IBIZ_2023_05_01_0000.tuv', 'utf8');

    const rows = readRowsFromFile('TOTL_IBIZ_2023_05_01_0000.tuv')
    const commonVariables: { [key: string]: string } = {};

    for (const row of rows) {
        const delimiterIndex = row.indexOf(':');
        if (delimiterIndex !== -1) {
            const key = row.slice(0, delimiterIndex).trim().replace(/^%/, '');
            const value = row.slice(delimiterIndex + 1).trim();
            if (key === "SiteSource") {
                continue
            }
            commonVariables[key] = value;
        }
    }
    console.log(commonVariables);

    const tableRows = readRowsTableFromFile('TOTL_IBIZ_2023_05_01_0000.tuv')

    const colNames = [
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
    ]
    const dataArray = tableRows.slice(2, -8)
    type RadarTable = Record<string, number[]>;
    const radarTable: RadarTable = {};
    for (const colName of colNames) {
        radarTable[colName] = [];
    }

    for (const data of dataArray) {
        const values = data.split(/\s+/);
        for (let i = 0; i < colNames.length; i++) {
            radarTable[colNames[i]].push(parseFloat(values[i]));
        }
    }
    const statistics = generateStatistics(radarTable);
    const uniqueId = generateUniqueId('TOTL_IBIZ_2023_05_01_0000.tuv', filehash)
    const owner = "SOCIB"
    console.log("ID", uniqueId)
    console.log("Owner", owner)
    console.log("Filehash", filehash)
    console.log("FileuniqueID", uniqueId)
    console.log("FileCreationTime", commonVariables["TimeStamp"])
    console.log("CommonVariables", commonVariables)
    console.log("Longitude", radarTable["Longitude"])
    console.log("Latitude", radarTable["Latitude"])
    console.log("Time", commonVariables["ProcessedTimeStamp"])
    console.log("Mean", statistics["mean"])
    console.log("Min", statistics["min"])
    console.log("Max", statistics["max"])
    console.log("StandardDeviation", statistics["standardDeviation"])
    console.log("NumberOfSeries", commonVariables["TableRows"])
    console.log("SoftwareVersion", 1)
    console.log("Links", "")
} catch (error) {
    console.error('Error reading the TUV file:', error);
}