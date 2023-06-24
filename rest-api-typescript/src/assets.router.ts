/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * This sample is intended to work with the basic asset transfer
 * chaincode which imposes some constraints on what is possible here.
 *
 * For example,
 *  - There is no validation for Asset IDs
 *  - There are no error codes from the chaincode
 *
 * To avoid timeouts, long running tasks should be decoupled from HTTP request
 * processing
 *
 * Submit transactions can potentially be very long running, especially if the
 * transaction fails and needs to be retried one or more times
 *
 * To allow requests to respond quickly enough, this sample queues submit
 * requests for processing asynchronously and immediately returns 202 Accepted
 */

import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Contract } from 'fabric-network';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { Queue } from 'bullmq';
import { AssetNotFoundError } from './errors';
import { evatuateTransaction } from './fabric';
import { addSubmitTransactionJob } from './jobs';
import { logger } from './logger';
import crypto from 'crypto';
import fileUpload from 'express-fileupload';


function readRowsFromFileContent(fileContent: string): string[] {
  // const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rows = fileContent.split('\n').map(row => row.trim());
  return rows;
}

function readRowsTableFromFileContent(fileContent: string): string[] {
  // const fileContent = fs.readFileSync(filePath, 'utf-8');
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

function generateDataFromFileContent(fileData: string): Record<string, any> {

  // Create the file hash
  const hash = crypto.createHash('md5').update(fileData).digest('hex');

  const rows = readRowsFromFileContent(fileData)
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
  // console.log(commonVariables);

  const tableRows = readRowsTableFromFileContent(fileData)

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
  const uniqueId = generateUniqueId('TOTL_IBIZ_2023_05_01_0000.tuv', hash)
  const owner = "SOCIB"
  const data = {
    ID: uniqueId,
    Owner: owner,
    Filehash: hash,
    FileuniqueID: uniqueId,
    FileCreationTime: commonVariables["TimeStamp"],
    CommonVariables: commonVariables,
    Longitude: radarTable["Longitude"],
    Latitude: radarTable["Latitude"],
    Time: commonVariables["ProcessedTimeStamp"],
    Mean: statistics["mean"],
    Min: statistics["min"],
    Max: statistics["max"],
    StandardDeviation: statistics["standardDeviation"],
    NumberOfSeries: commonVariables["TableRows"],
    SoftwareVersion: 1,
    Links: "",
  };
  return data
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


const { ACCEPTED, BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } =
  StatusCodes;

interface CustomUploadedFile {
  name: string;
  data: Buffer;
  size: number;
  encoding: string;
  tempFilePath: string;
  truncated: boolean;
  mimetype: string;
  md5: string;
  mv: () => void;
}

export const assetsRouter = express.Router();
assetsRouter.use(fileUpload());


assetsRouter.get('/', async (req: Request, res: Response) => {
  logger.debug('Get all assets request received');
  try {
    const mspId = req.user as string;
    const contract = req.app.locals[mspId]?.assetContract as Contract;

    // const data = await evatuateTransaction(contract, 'GetAllAssets');
    const data = await evatuateTransaction(contract, 'GetAllSocibAssets');
    let assets = [];
    if (data.length > 0) {
      assets = JSON.parse(data.toString(), (key, value) => {
        // Check if the value is a string and if it can be parsed as JSON
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (error) {
            // If parsing fails, return the original value
            return value;
          }
        }
        return value;
      });
    }

    return res.status(OK).json(assets);
  } catch (err) {
    logger.error({ err }, 'Error processing get all assets request');
    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});


assetsRouter.post(
  '/',
  body().isObject().withMessage('body must contain an asset object'),
  async (req: Request, res: Response) => {
    logger.debug(req.body, 'Create asset request received');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });
    }

    const mspId = req.user as string;

    // Check if a file was uploaded
    if (!req.files?.file) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'FILE_REQUIRED',
        message: 'File upload is required',
        timestamp: new Date().toISOString(),
      });
    }

    const file = req.files.file as unknown as CustomUploadedFile;
    const fileData = Buffer.from(file.data).toString();
    // Get the filename
    const filename = file.name;

    const data = generateDataFromFileContent(fileData);

    try {
      const submitQueue = req.app.locals.jobq as Queue;
      const jobId = await addSubmitTransactionJob(
        submitQueue,
        mspId,
        'CreateSocibAsset',
        data.ID,
        data.Owner,
        data.Filehash,
        filename,
        data.FileuniqueID,
        data.FileCreationTime,
        JSON.stringify(data.CommonVariables),
        data.Longitude.toString(),
        data.Latitude.toString(),
        data.Time,
        JSON.stringify(data.Mean),
        JSON.stringify(data.Min),
        JSON.stringify(data.Max),
        JSON.stringify(data.StandardDeviation),
        parseInt(data.NumberOfSeries).toString(),
        data.SoftwareVersion.toString(),
        data.Links
      );

      return res.status(ACCEPTED).json({
        status: getReasonPhrase(ACCEPTED),
        id: data.ID,
        jobId: jobId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(
        { err },
        'Error processing create asset request',
      );

      return res.status(INTERNAL_SERVER_ERROR).json({
        status: getReasonPhrase(INTERNAL_SERVER_ERROR),
        timestamp: new Date().toISOString(),
      });
    }
  }
);


assetsRouter.options('/:assetId', async (req: Request, res: Response) => {
  const assetId = req.params.assetId;
  logger.debug('Asset options request received for asset ID %s', assetId);

  try {
    const mspId = req.user as string;
    const contract = req.app.locals[mspId]?.assetContract as Contract;

    const data = await evatuateTransaction(contract, 'SocibAssetExists', assetId);
    const exists = data.toString() === 'true';

    if (exists) {
      return res
        .status(OK)
        .set({
          Allow: 'DELETE,GET,OPTIONS,PATCH,PUT',
        })
        .json({
          status: getReasonPhrase(OK),
          timestamp: new Date().toISOString(),
        });
    } else {
      return res.status(NOT_FOUND).json({
        status: getReasonPhrase(NOT_FOUND),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error(
      { err },
      'Error processing asset options request for asset ID %s',
      assetId
    );
    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});

assetsRouter.get('/:assetId', async (req: Request, res: Response) => {
  const assetId = req.params.assetId;
  logger.debug('Read asset request received for asset ID %s', assetId);

  try {
    const mspId = req.user as string;
    const contract = req.app.locals[mspId]?.assetContract as Contract;

    const data = await evatuateTransaction(
      contract,
      'ReadSocibAsset',
      assetId
    );
    const asset = JSON.parse(data.toString(), (key, value) => {
      // Check if the value is a string and if it can be parsed as JSON
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (error) {
          // If parsing fails, return the original value
          return value;
        }
      }
      return value;
    });

    return res.status(OK).json(asset);
  } catch (err) {
    logger.error(
      { err },
      'Error processing read asset request for asset ID %s',
      assetId
    );

    if (err instanceof AssetNotFoundError) {
      return res.status(NOT_FOUND).json({
        status: getReasonPhrase(NOT_FOUND),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});


assetsRouter.get('/:assetId/history', async (req: Request, res: Response) => {
  const assetId = req.params.assetId;
  logger.debug('Read asset request received for asset ID %s', assetId);

  try {
    const mspId = req.user as string;
    const contract = req.app.locals[mspId]?.assetContract as Contract;

    const data = await evatuateTransaction(
      contract,
      'GetSocibAssetHistory',
      assetId
    );
    const asset = JSON.parse(data.toString(), (key, value) => {
      // Check if the value is a string and if it can be parsed as JSON
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (error) {
          // If parsing fails, return the original value
          return value;
        }
      }
      return value;
    });


    return res.status(OK).json(asset);
  } catch (err) {
    logger.error(
      { err },
      'Error processing read asset request for asset ID %s',
      assetId
    );

    if (err instanceof AssetNotFoundError) {
      return res.status(NOT_FOUND).json({
        status: getReasonPhrase(NOT_FOUND),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});


assetsRouter.put(
  '/:assetId',
  body().isObject().withMessage('body must contain an asset object'),
  async (req: Request, res: Response) => {
    logger.debug(req.body, 'Update asset request received');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });
    }

    const mspId = req.user as string;
    const assetId = req.params.assetId;
    const newOwner = req.query.newowner as string;
    if (!newOwner) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'INFORMATION_REQUIRED',
        message: 'New Owner info is required, for example: http://localhost:3000/assets/123?newowner=John%20Doe',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if a file was uploaded
    if (!req.files?.file) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'FILE_REQUIRED',
        message: 'File upload is required',
        timestamp: new Date().toISOString(),
      });
    }

    const contract = req.app.locals[mspId]?.assetContract as Contract;
    const oldData = await evatuateTransaction(
      contract,
      'ReadSocibAsset',
      assetId
    );

    const oldAsset = JSON.parse(oldData.toString());
    const oldFilehash = oldAsset.FileHash;

    const file = req.files.file as unknown as CustomUploadedFile;
    const fileData = Buffer.from(file.data).toString();
    const filename = file.name;
    const newData = generateDataFromFileContent(fileData);
    const newFileHash = newData.Filehash;

    if (newFileHash === oldFilehash) {
      // transfer
      try {
        const submitQueue = req.app.locals.jobq as Queue;
        const jobId = await addSubmitTransactionJob(
          submitQueue,
          mspId,
          'TransferSocibAsset',
          assetId,
          newOwner,
        );

        return res.status(ACCEPTED).json({
          status: getReasonPhrase(ACCEPTED),
          id: oldAsset.ID,
          jobId: jobId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error(
          { err },
          'Error processing update asset request for asset ID %s',
          req.params.assetId
        );

        return res.status(INTERNAL_SERVER_ERROR).json({
          status: getReasonPhrase(INTERNAL_SERVER_ERROR),
          timestamp: new Date().toISOString(),
        });
      }

    } else {
      // update
      try {
        const submitQueue = req.app.locals.jobq as Queue;
        const jobId = await addSubmitTransactionJob(
          submitQueue,
          mspId,
          'UpdateSocibAsset',
          oldAsset.ID,
          newOwner,
          newFileHash,
          filename,
          oldAsset.ID,
          newData.FileCreationTime,
          JSON.stringify(newData.CommonVariables),
          newData.Longitude.toString(),
          newData.Latitude.toString(),
          newData.Time,
          JSON.stringify(newData.Mean),
          JSON.stringify(newData.Min),
          JSON.stringify(newData.Max),
          JSON.stringify(newData.StandardDeviation),
          parseInt(newData.NumberOfSeries).toString(),
          newData.SoftwareVersion.toString(),
          newData.Links
        );

        return res.status(ACCEPTED).json({
          status: getReasonPhrase(ACCEPTED),
          id: oldAsset.ID,
          jobId: jobId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error(
          { err },
          'Error processing update asset request for asset ID %s',
          assetId
        );

        return res.status(INTERNAL_SERVER_ERROR).json({
          status: getReasonPhrase(INTERNAL_SERVER_ERROR),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
);


assetsRouter.delete('/:assetId', async (req: Request, res: Response) => {
  logger.debug(req.body, 'Delete asset request received');

  const mspId = req.user as string;
  const assetId = req.params.assetId;

  try {
    const submitQueue = req.app.locals.jobq as Queue;
    const jobId = await addSubmitTransactionJob(
      submitQueue,
      mspId,
      'DeleteSocibAsset',
      assetId
    );

    return res.status(ACCEPTED).json({
      status: getReasonPhrase(ACCEPTED),
      jobId: jobId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(
      { err },
      'Error processing delete asset request for asset ID %s',
      assetId
    );

    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});
