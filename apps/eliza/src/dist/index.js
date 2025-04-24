#!/usr/bin/env node

// This file replicates the functionality of the Eliza CLI start command
// for use on render.com where the CLI cannot be used directly

import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { AgentServer } from '@elizaos/cli/dist/server/index.js';
import { startAgent } from '@elizaos/cli/dist/commands/start.js';
import { loadCharacterTryPath, jsonToCharacter } from '@elizaos/cli/dist/server/loader.js';
import { loadEnvironment, configureDatabaseSettings } from '@elizaos/cli/dist/utils/config-manager.js';
import { logger } from '@elizaos/core';
import { findNextAvailablePort } from '@elizaos/cli/dist/utils/port-handling.js';

// Import the ShapeShift character from the dist folder (compiled from shapeshift.json)
import { character as shapeshiftCharacter } from '../index.js';

// Make sure we handle all unhandled promise rejections correctly
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function main() {
  // Load environment variables from .env
  dotenv.config();
  
  // Show that the server is starting
  logger.info('Starting ShapeShift Eliza server for render.com deployment');
  
  // Load environment variables from project .env
  await loadEnvironment();

  // Configure database settings
  const postgresUrl = await configureDatabaseSettings(false);

  // Get PGLite data directory from environment (may have been set during configuration)
  const pgliteDataDir = process.env.PGLITE_DATA_DIR || './elizadb';

  // Create server instance with appropriate database settings
  const server = new AgentServer({
    dataDir: pgliteDataDir,
    postgresUrl,
  });

  // Set up server properties
  server.startAgent = async (character) => {
    logger.info(`Starting agent for character ${character.name}`);
    const runtime = await startAgent(character, server);
    logger.success(`Agent ${character.name} has been successfully started!`);
    console.log(`\x1b[32m✓ Agent ${character.name} started successfully!\x1b[0m`);
    return runtime;
  };
  
  server.stopAgent = (runtime) => {
    logger.info(`Stopping agent ${runtime.character.name}`);
    runtime.close();
    server.unregisterAgent(runtime.agentId);
    console.log(`\x1b[32m✓ Agent ${runtime.character.name} stopped successfully!\x1b[0m`);
  };
  
  server.loadCharacterTryPath = loadCharacterTryPath;
  server.jsonToCharacter = jsonToCharacter;

  // Get PORT from environment variable (render.com sets this)
  const desiredPort = process.env.PORT || process.env.SERVER_PORT || 3000;
  const serverPort = await findNextAvailablePort(Number(desiredPort));

  process.env.SERVER_PORT = serverPort.toString();

  // Initialize the server
  await server.initialize();

  // Start the server
  server.start(serverPort);

  // Check if we have specified character path in environment
  const characterPath = process.env.CHARACTER_PATH;
  
  if (characterPath) {
    try {
      logger.info(`Loading character from ${characterPath}`);
      const characterData = await loadCharacterTryPath(characterPath);
      await startAgent(characterData, server);
    } catch (error) {
      logger.error(`Error loading character: ${error}`);
      logger.info('Falling back to ShapeShift character');
      await startAgent(shapeshiftCharacter, server);
    }
  } else {
    // Use ShapeShift character from dist/index.js
    logger.info('Using ShapeShift character from dist/index.js');
    await startAgent(shapeshiftCharacter, server);
  }
}

// Start the server
main().catch((error) => {
  logger.error('Failed to start ShapeShift Eliza server:', error);
  process.exit(1);
});
