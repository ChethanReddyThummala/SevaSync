// ================================================================
//  src/config/anthropic.js
//  Anthropic AI client singleton.
//  Returns null if no API key is set — callers must handle this.
// ================================================================
"use strict";

const Anthropic = require("@anthropic-ai/sdk");

let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

module.exports = { getClient };
