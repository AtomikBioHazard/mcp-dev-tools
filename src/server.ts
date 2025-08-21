import express, { Request, Response } from 'express';
import { MCPServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// Initialize MCP Dev Tools Server
const server = new MCPServer({
  name: 'MCP Dev Tools Server',
  description: 'A server for MCP development tools',
  version: '1.0.0',
});

const app = express();
app.use(express.json());

// Initialize SSE transports
const transports: { [sessionId: string]: SSEServerTransport } = {};

// Initialize SSE endpoint
app.get("/sse", async (_: Request, res: Response) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on("close", () => delete transports[transport.sessionId]);
  await server.connect(transport);
});

// Initialize message handling
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (!transport) return res.status(404).send('No transport found for sessionId');
  await transport.handlePostMessage(req, res);
});

// JSON parse secure function
function safeJsonParse(str: string): any | null {
  if (typeof str !== "string") return null;

  // Basic validation for JSON: must start with { or [
  const first = str.trim()[0];
  if (first !== "{" && first !== "[") return null;

  // If not valid JSON, will throw at runtime, but we don't catch here
  return (0, eval)(`(${str})`);
}

// Dev Tools
server.tool(
  "handle_request", 
  "Handles JSON payloads and decides next steps",
  {},
  async (payload: string) => {
    if (!payload) return { error: "Empty payload" };
    const data = safeJsonParse(payload);
    if (!data) return { error: "Invalid JSON payload" };
    if (!data.intent) return { error: "Missing 'intent' field in payload" };
    return { parsed: data };
  }
)
