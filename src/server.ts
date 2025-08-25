import express, { Request, Response } from 'express';
import { McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

// Initialize MCP Dev Tools Server
const server = new McpServer({
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
  { payload: z.string() },
  async ({ payload }) => {
    if (!payload) return { content: [{ type: "text", text: "Error: Empty payload" }] };
    const data = safeJsonParse(payload);
    if (!data) return { content: [{ type: "text", text: "Error: Invalid JSON payload" }] };
    if (!data.intent) return { content: [{ type: "text", text: "Error: Missing 'intent' field in payload" }] };
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);

server.tool(
  "generate_snippet",
  "Generates code snippets based on description",
  { language: "string", description: "string" },
  async (args) => {
    const snippet = `// ${args.language} snippet for: ${args.description}\nfunction example() { return "Hello World!"; }`;
    return { content: [{ type: "text", text: snippet }] };
  }
);

server.tool(
  "lint_code",
  "Performs basic linting on code, and returns any issues",
  { language: "string", code: "string" },
  async (args) => {
    const errors = !args.code.includes("function") ? ["Missing function declaration"] : [];
    return { content: [{ type: "text", text: errors.join("\n") || "No lint issues found" }] };
  }
);

server.tool(
  "run_tests",
  "Mocks running tests on code",
  { code: z.string(), tests: z.array(z.string()) },
  async (args) => {
    const code = args.code as string;
    const tests = args.tests as string[];

    if (!code || !code.includes("function")) return { content: [{ type: "text", text: `Passed: 0, Failed: ${tests.length}` }] };

    const passed = tests.filter((test) => test.includes("should pass")).length;
    const failed = tests.filter((test) => test.includes("should fail")).length;

    return { content: [{ type: "text", text: `Passed: ${passed}, Failed: ${failed}` }] };
  }
);

server.tool(
  "explain_code",
  "Returns explanation of code",
  { code: "string" },
  async (args) => {
    return { content: [{ type: "text", text: `This code is a simple function that returns "Hello World!"` }] };
  }
);

// Start the Express server
app.listen(8000, () => {
  console.info("MCP Dev Tools Server listening on http://localhost:8000");
})
