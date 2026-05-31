import type { Plugin } from "vite";

type LocalMoquiSignal = "checkLoginOptions" | "rest";

interface LocalMoquiServer {
  label: string;
  oms: string;
  port: number;
  signal: LocalMoquiSignal;
}

const DEFAULT_LOCAL_MOQUI_PORTS = [8080, 8443, 8081, 8082];
const LOCAL_MOQUI_HOST = "localhost";
const DISCOVERY_PATH = "/__accxui/local-moqui-servers";
const REQUEST_TIMEOUT_MS = 700;

const parsePortList = (value?: string) => {
  if (!value) return [];

  return value
    .split(",")
    .map((port) => Number(port.trim()))
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
};

const getProbePorts = () => {
  return [...new Set([
    ...parsePortList(process.env.VITE_LOCAL_MOQUI_PORTS),
    ...DEFAULT_LOCAL_MOQUI_PORTS
  ])];
};

const fetchWithTimeout = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

const isRestSignal = (response: Response) => {
  return response.ok || [401, 403, 405].includes(response.status);
};

const detectLocalMoquiServer = async (port: number): Promise<LocalMoquiServer | null> => {
  const oms = `http://${LOCAL_MOQUI_HOST}:${port}`;
  const baseRestUrl = `${oms}/rest/s1/`;

  try {
    const response = await fetchWithTimeout(`${baseRestUrl}admin/checkLoginOptions`);
    if (response.ok) {
      return {
        label: `Local Moqui ${port}`,
        oms,
        port,
        signal: "checkLoginOptions"
      };
    }
  } catch {
    // Try the base REST path before treating this port as unavailable.
  }

  try {
    const response = await fetchWithTimeout(baseRestUrl);
    if (isRestSignal(response)) {
      return {
        label: `Local Moqui ${port}`,
        oms,
        port,
        signal: "rest"
      };
    }
  } catch {
    return null;
  }

  return null;
};

const discoverLocalMoquiServers = async () => {
  const results = await Promise.all(getProbePorts().map(detectLocalMoquiServer));

  return results.filter(Boolean) as LocalMoquiServer[];
};

export const localMoquiDiscoveryPlugin = (): Plugin => ({
  name: "accxui-local-moqui-discovery",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use(DISCOVERY_PATH, async (req, res) => {
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.end();
        return;
      }

      const servers = await discoverLocalMoquiServers();
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(servers));
    });
  }
});
