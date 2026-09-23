import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import {
  startGenerationTool,
  reviseGenerationTool,
  getGenerationStatusTool,
  searchContentTool,
} from "./tools/generationTools.js";

const TOOLS = [startGenerationTool, reviseGenerationTool, getGenerationStatusTool, searchContentTool];

export function buildMcpServer() {
  const server = new McpServer({ name: "els-ai-generation", version: "1.0.0" });

  for (const tool of TOOLS) {
    server.tool(tool.name, tool.description, tool.inputSchema.shape, async (input: unknown) => {
      const result = await tool.handler(input as never);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    });
  }

  return server;
}

/**
 * Mounted at POST /mcp so an MCP-capable agent runtime (Claude with an MCP
 * connector, or any other MCP client) can call these tools directly instead
 * of going through the REST routes. Stateless mode: a fresh transport per
 * request, which is fine since tool handlers are themselves stateless
 * (jobStore/contentRepo hold the actual state).
 */
export async function handleMcpRequest(req: Request, res: Response) {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
