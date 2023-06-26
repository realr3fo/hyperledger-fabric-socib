/*
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import passport from 'passport';
import pinoMiddleware from 'pino-http';
import { assetsRouter } from './assets.router';
import { authenticateApiKey, fabricAPIKeyStrategy } from './auth';
import { healthRouter } from './health.router';
import { jobsRouter } from './jobs.router';
import { logger } from './logger';
import { transactionsRouter } from './transactions.router';
import cors from 'cors';
import path from 'path';
import fs from 'fs';


const { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND } = StatusCodes;

export const createServer = async (): Promise<Application> => {
  const app = express();

  app.use(
    pinoMiddleware({
      logger,
      customLogLevel: function customLogLevel(res, err) {
        if (
          res.statusCode >= BAD_REQUEST &&
          res.statusCode < INTERNAL_SERVER_ERROR
        ) {
          return 'warn';
        }

        if (res.statusCode >= INTERNAL_SERVER_ERROR || err) {
          return 'error';
        }

        return 'debug';
      },
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // define passport startegy
  passport.use(fabricAPIKeyStrategy);

  // initialize passport js
  app.use(passport.initialize());

  if (process.env.NODE_ENV === 'development') {
    app.use(cors());
  }

  if (process.env.NODE_ENV === 'test') {
    // TBC
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(helmet());
  }
  const publicPath = path.join(__dirname, '../public');


  app.use('/api/health', healthRouter);
  app.use('/api/assets', authenticateApiKey, assetsRouter);
  app.use('/api/jobs', authenticateApiKey, jobsRouter);
  app.use('/api/transactions', authenticateApiKey, transactionsRouter);
  app.use(express.static('public')); // Serve static files from the "public" directory
  // Define routes
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });
  app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'about.html'));
  });
  app.get('/assets', (req, res) => {
    const htmlFilePath = path.join(publicPath, 'assets.html');
    // Read the HTML file
    fs.readFile(htmlFilePath, 'utf8', (err, html) => {
      if (err) {
        return res.status(500).send('Error reading HTML file');
      }

      // Inject the API key into the HTML
      const apiKey = process.env.ORG1_APIKEY || '';
      const injectedHtml = html.replace('{{API_KEY}}', apiKey);

      // Send the modified HTML response
      res.send(injectedHtml);
    });
  });
  app.get('/assets/detail/:assetId', (req, res) => {
    const htmlFilePath = path.join(publicPath, 'asset-detail.html');

    // Read the HTML file
    fs.readFile(htmlFilePath, 'utf8', (err, html) => {
      if (err) {
        return res.status(500).send('Error reading HTML file');
      }

      // Inject the API key into the HTML
      const apiKey = process.env.ORG1_APIKEY || '';
      const assetId = req.params.assetId;

      // Replace placeholders in the HTML with the assetId and API key
      const injectedHtml = html
        .replace('{{ASSET_ID}}', assetId)
        .replace('{{API_KEY}}', apiKey);

      // Send the modified HTML response
      res.send(injectedHtml);
    });
  });
  app.get('/assets/detail/:assetId/:historyNum', (req, res) => {
    const htmlFilePath = path.join(publicPath, 'asset-history.html');

    // Read the HTML file
    fs.readFile(htmlFilePath, 'utf8', (err, html) => {
      if (err) {
        return res.status(500).send('Error reading HTML file');
      }

      // Inject the API key into the HTML
      const apiKey = process.env.ORG1_APIKEY || '';
      const assetId = req.params.assetId;
      const historyNum = req.params.historyNum;

      // Replace placeholders in the HTML with the assetId and API key
      const injectedHtml = html
        .replace('{{ASSET_ID}}', assetId)
        .replace('{{API_KEY}}', apiKey)
        .replace('{{HISTORY_NUM}}', historyNum);

      // Send the modified HTML response
      res.send(injectedHtml);
    });
  });

  app.get('/asset-management', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'asset-management.html'));
  });
  app.get('/asset-detail', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'asset-detail.html'));
  });
  // For everything else
  app.use((_req, res) =>
    res.status(NOT_FOUND).json({
      status: getReasonPhrase(NOT_FOUND),
      timestamp: new Date().toISOString(),
    })
  );

  // Print API errors
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err);
    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  });

  return app;
};
