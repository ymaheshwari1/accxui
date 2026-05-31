export type LocalMoquiSignal = "checkLoginOptions" | "rest";

export interface LocalMoquiServer {
  label: string;
  oms: string;
  port: number;
  signal: LocalMoquiSignal;
}

interface DiscoverLocalMoquiServersOptions {
  ports?: number[];
  fetcher?: typeof fetch;
}

const DEFAULT_LOCAL_MOQUI_PORTS = [8080, 8443, 8081, 8082];
const LOCAL_MOQUI_HOST = "localhost";
const LOCAL_MOQUI_DISCOVERY_ENDPOINT = "/__accxui/local-moqui-servers";

const parsePortList = (value?: string) => {
  if (!value) return [];

  return value
    .split(",")
    .map((port) => Number(port.trim()))
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
};

const uniquePorts = (ports: number[]) => [...new Set(ports)];

const isRestSignal = (response: Response) => {
  return response.ok || [401, 403, 405].includes(response.status);
};

const probe = async (fetcher: typeof fetch, url: string, isSignal: (response: Response) => boolean) => {
  const response = await fetcher(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit"
  });

  return isSignal(response);
};

const detectLocalMoquiServer = async (port: number, fetcher: typeof fetch): Promise<LocalMoquiServer | null> => {
  const oms = `http://${LOCAL_MOQUI_HOST}:${port}`;
  const baseRestUrl = `${oms}/rest/s1/`;

  try {
    if (await probe(fetcher, `${baseRestUrl}admin/checkLoginOptions`, (response) => response.ok)) {
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
    if (await probe(fetcher, baseRestUrl, isRestSignal)) {
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

const getDevServerLocalMoquiServers = async (fetcher: typeof fetch) => {
  if (!import.meta.env.DEV) return null;

  try {
    const response = await fetcher(LOCAL_MOQUI_DISCOVERY_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!response.ok) return null;

    const servers = await response.json();
    if (!Array.isArray(servers)) return null;

    return servers.filter((server): server is LocalMoquiServer => {
      return Boolean(
        server
        && typeof server.label === "string"
        && typeof server.oms === "string"
        && typeof server.port === "number"
        && (server.signal === "checkLoginOptions" || server.signal === "rest")
      );
    });
  } catch {
    return null;
  }
};

export const getLocalMoquiProbePorts = () => {
  return uniquePorts([
    ...parsePortList(import.meta.env.VITE_LOCAL_MOQUI_PORTS),
    ...DEFAULT_LOCAL_MOQUI_PORTS
  ]);
};

export const discoverLocalMoquiServers = async (options: DiscoverLocalMoquiServersOptions = {}) => {
  const fetcher = options.fetcher || fetch;
  const devServerServers = await getDevServerLocalMoquiServers(fetcher);
  if (devServerServers) return devServerServers;

  const ports = options.ports || getLocalMoquiProbePorts();
  const results = await Promise.all(ports.map((port) => detectLocalMoquiServer(port, fetcher)));

  return results.filter(Boolean) as LocalMoquiServer[];
};
