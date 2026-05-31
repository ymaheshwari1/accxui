import { describe, expect, it, vi } from "vitest";
import { discoverLocalApiServers } from "./localApiServerDiscovery";

const response = (status: number) => new Response(null, { status });

describe("discoverLocalApiServers", () => {
  it("detects a local API server through checkLoginOptions", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(200));

    const servers = await discoverLocalApiServers({ ports: [8080], fetcher });

    expect(servers).toEqual([
      {
        label: "Local API Server 8080",
        oms: "http://localhost:8080",
        port: 8080,
        signal: "loginOptions"
      }
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/rest/s1/admin/checkLoginOptions",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("does not treat checkLoginOptions 404 as a valid login-options signal", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(404))
      .mockResolvedValueOnce(response(200));

    const servers = await discoverLocalApiServers({ ports: [8080], fetcher });

    expect(servers).toEqual([
      {
        label: "Local API Server 8080",
        oms: "http://localhost:8080",
        port: 8080,
        signal: "rest"
      }
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8080/rest/s1/",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("ignores unavailable local ports", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(404))
      .mockRejectedValue(new Error("connection refused"));

    const servers = await discoverLocalApiServers({ ports: [8080], fetcher });

    expect(servers).toEqual([]);
  });
});
